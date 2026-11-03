import { fetchFile } from "./api.ts";
import { askUnsaved } from "./dialog.ts";
import type { DocumentStore } from "./documents.ts";
import { renderMarkdown } from "./markdown.ts";
import { loadSetting, saveSetting } from "./storage.ts";

/** Which panes are visible: both, or only one of them. */
export type Layout = "both" | "source" | "preview";

export interface SplitEditor {
  element: HTMLElement;
  /** Opens a file, asking first if the current one has unsaved changes. Resolves false if it didn't switch. */
  open(path: string): Promise<boolean>;
  save(): Promise<void>;
  currentPath(): string | null;
  /** Re-renders the preview, for when something it depends on (like which wiki pages exist) changed. */
  refreshPreview(): void;
}

export interface SplitEditorOptions {
  store: DocumentStore;
  /** Remembers the pane layout separately for each view. */
  viewKey: string;
  emptyMessage: string;
  /** Called after the open file changes, so the top bar can update. */
  onPathChange: () => void;
  /** Preview renderer; defaults to plain Markdown. */
  render?: (text: string) => string;
  /** Clicks inside the preview (the Wiki view uses this for [[links]]). */
  onPreviewClick?: (event: MouseEvent) => void;
  /** Extra class on the editor, e.g. "prose-editor" for the manuscript's serif column. */
  className?: string;
}

/** Showing or hiding one pane, never hiding both: hiding the only visible pane shows the other instead. */
export function toggleLayout(layout: Layout, pane: "source" | "preview"): Layout {
  const visible = { source: layout !== "preview", preview: layout !== "source" };
  visible[pane] = !visible[pane];
  if (!visible.source && !visible.preview) return pane === "source" ? "preview" : "source";
  if (visible.source && visible.preview) return "both";
  return visible.source ? "source" : "preview";
}

function isLayout(value: unknown): value is Layout {
  return value === "both" || value === "source" || value === "preview";
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createSplitEditor(options: SplitEditorOptions): SplitEditor {
  const { store } = options;
  const layoutKey = `layout:${options.viewKey}`;
  const remembered = loadSetting<unknown>(layoutKey, "both");
  let layout: Layout = isLayout(remembered) ? remembered : "both";
  let path: string | null = null;

  const element = el("div", options.className ? `editor ${options.className}` : "editor");
  const toolbar = el("div", "editor-toolbar");
  const title = el("span", "editor-title");
  const toggles = el("div", "editor-toggles");
  const sourceToggle = el("button", "toggle", "Source");
  const previewToggle = el("button", "toggle", "Preview");
  sourceToggle.type = previewToggle.type = "button";
  sourceToggle.title = "Show or hide the Markdown source";
  previewToggle.title = "Show or hide the preview";
  toggles.append(sourceToggle, previewToggle);
  toolbar.append(title, toggles);

  const banner = el("div", "editor-banner");
  const bannerText = el("span", "editor-banner-text");
  const reloadButton = el("button", "", "Reload from disk");
  const keepMineButton = el("button", "", "Keep mine");
  reloadButton.type = keepMineButton.type = "button";
  banner.append(bannerText, reloadButton, keepMineButton);
  banner.hidden = true;

  const panes = el("div", "editor-panes");
  const source = el("textarea", "editor-source");
  source.spellcheck = true;
  source.disabled = true;
  source.setAttribute("aria-label", "Markdown source");
  const preview = el("div", "editor-preview markdown-body");
  preview.setAttribute("aria-label", "Preview");
  panes.append(source, preview);

  const empty = el("div", "editor-empty", options.emptyMessage);
  element.append(toolbar, banner, panes, empty);

  const applyLayout = (): void => {
    element.dataset.layout = layout;
    sourceToggle.setAttribute("aria-pressed", String(layout !== "preview"));
    previewToggle.setAttribute("aria-pressed", String(layout !== "source"));
  };
  const setLayout = (pane: "source" | "preview"): void => {
    layout = toggleLayout(layout, pane);
    saveSetting(layoutKey, layout);
    applyLayout();
    if (layout !== "preview") source.focus();
  };
  sourceToggle.addEventListener("click", () => setLayout("source"));
  previewToggle.addEventListener("click", () => setLayout("preview"));
  applyLayout();

  const render = options.render ?? ((text: string): string => renderMarkdown(text));
  let previewQueued = false;
  const renderPreview = (): void => {
    if (previewQueued) return;
    previewQueued = true;
    requestAnimationFrame(() => {
      previewQueued = false;
      preview.innerHTML = render(source.value);
    });
  };
  if (options.onPreviewClick) preview.addEventListener("click", options.onPreviewClick);

  const showEmpty = (message: string | null): void => {
    element.classList.toggle("is-empty", message !== null);
    if (message !== null) empty.textContent = message;
  };
  showEmpty(options.emptyMessage);

  const updateBanner = (): void => {
    const conflict = path ? store.get(path)?.conflict : null;
    banner.hidden = !conflict;
    if (!conflict) return;
    const deleted = conflict.mtimeMs === null;
    bannerText.textContent = deleted
      ? "This file was deleted on disk."
      : "This file changed on disk since you opened it.";
    reloadButton.hidden = deleted;
    keepMineButton.textContent = deleted ? "Recreate with my version" : "Overwrite with my version";
  };

  store.subscribe((changed) => {
    if (changed === path) updateBanner();
  });

  source.addEventListener("input", () => {
    if (path) store.edit(path, source.value);
    renderPreview();
  });

  reloadButton.addEventListener("click", async () => {
    if (!path) return;
    const target = path;
    try {
      const file = await fetchFile(target);
      store.reload(target, file.content, file.mtimeMs);
      if (path === target) {
        source.value = file.content;
        renderPreview();
      }
    } catch (error) {
      bannerText.textContent = error instanceof Error ? error.message : String(error);
    }
  });

  keepMineButton.addEventListener("click", () => {
    if (path) void store.keepMine(path);
  });

  async function open(nextPath: string): Promise<boolean> {
    if (nextPath === path) return true;
    if (path && store.isDirty(path)) {
      const choice = await askUnsaved(path);
      if (choice === "cancel") return false;
      if (choice === "save" && (await store.save(path)) !== "clean") return false;
      if (choice === "discard") {
        store.discard(path);
        // Keep the editor in step with the store in case the next file fails to open.
        source.value = store.get(path)?.text ?? "";
        renderPreview();
      }
    }

    let file;
    try {
      file = await fetchFile(nextPath);
    } catch (error) {
      const message = `Couldn't open ${nextPath}: ${error instanceof Error ? error.message : String(error)}`;
      // With a file already open, stay on it rather than hiding it behind the error.
      if (path) window.alert(message);
      else showEmpty(message);
      return false;
    }
    // Unsaved changes kept from earlier (for example in another view) win over the disk copy.
    const doc = store.open(nextPath, file.content, file.mtimeMs);
    path = nextPath;
    title.textContent = nextPath;
    source.disabled = false;
    source.value = doc.text;
    source.scrollTop = 0;
    preview.scrollTop = 0;
    showEmpty(null);
    renderPreview();
    updateBanner();
    options.onPathChange();
    return true;
  }

  return {
    element,
    open,
    save: async () => {
      if (path) await store.save(path);
    },
    currentPath: () => path,
    refreshPreview: () => {
      if (path) renderPreview();
    },
  };
}
