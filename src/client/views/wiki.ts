import { slugify } from "../../shared/chapters.ts";
import { baseName } from "../../shared/paths.ts";
import type { Tree } from "../../shared/tree.ts";
import {
  buildWikiIndex,
  newPageContent,
  templateForFolder,
  titleFromTarget,
  type WikiIndex,
} from "../../shared/wikilinks.ts";
import { fetchFile, fetchTree, fetchWikiPages, saveFile } from "../api.ts";
import { askNewPage } from "../dialog.ts";
import { createSplitEditor } from "../editor.ts";
import { createHistory } from "../history.ts";
import { renderMarkdown } from "../markdown.ts";
import { createSidebar } from "../sidebar.ts";
import { openablePaths, wikiSearch, wikiSections } from "../sidebar-model.ts";
import { loadSetting, saveSetting } from "../storage.ts";
import type { View, ViewContext } from "./types.ts";

const LAST_FILE_KEY = "last-file:wiki";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** The wiki/ subfolder a page is in, or "" for pages directly in wiki/. */
const folderOf = (path: string): string => {
  const parts = path.split("/");
  return parts.length > 2 ? (parts[1] ?? "") : "";
};

export function createWikiView(ctx: ViewContext): View {
  const element = el("div", "wiki-layout");

  let tree: Tree | null = null;
  // Saved text of every wiki page (not templates), which the link index is built from.
  const pages = new Map<string, string>();
  let index: WikiIndex = buildWikiIndex([]);
  const history = createHistory();

  // Left pane: back/forward, search, and the page tree.
  const left = el("div", "wiki-left");
  const navBar = el("div", "wiki-navbar");
  const backButton = el("button", "nav-button", "‹");
  const forwardButton = el("button", "nav-button", "›");
  backButton.type = forwardButton.type = "button";
  backButton.title = "Back";
  forwardButton.title = "Forward";
  backButton.setAttribute("aria-label", "Back");
  forwardButton.setAttribute("aria-label", "Forward");
  const search = el("input", "wiki-search");
  search.type = "search";
  search.placeholder = "Search pages";
  search.setAttribute("aria-label", "Search wiki pages");
  navBar.append(backButton, forwardButton, search);

  const sidebar = createSidebar({
    viewKey: "wiki",
    ariaLabel: "Wiki pages",
    onSelect: (path) => void go(path, "push"),
  });
  left.append(navBar, sidebar.element);

  // Right pane: links to and from the open page.
  const linksPanel = el("aside", "links-panel");
  linksPanel.setAttribute("aria-label", "Links");

  const editor = createSplitEditor({
    store: ctx.store,
    viewKey: "wiki",
    emptyMessage: "Choose a wiki page from the left.",
    onPathChange: ctx.refreshStatus,
    render: (text) => renderMarkdown(text, { resolveWikiLink: (target) => index.resolve(target), frontmatter: "strip" }),
    onPreviewClick: (event) => {
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("a.wikilink");
      if (!link) return;
      event.preventDefault();
      if (link.dataset.path) void go(link.dataset.path, "push");
      else if (link.dataset.target) void createFromLink(link.dataset.target);
    },
  });

  element.append(left, editor.element, linksPanel);

  async function go(path: string, mode: "push" | "back" | "forward"): Promise<void> {
    if (!(await editor.open(path))) return;
    if (mode === "push") history.push(path);
    else if (mode === "back") history.moveBack();
    else history.moveForward();
    saveSetting(LAST_FILE_KEY, path);
    sidebar.setActive(path);
    renderLinks();
    updateNavButtons();
  }

  function updateNavButtons(): void {
    backButton.disabled = history.peekBack() === null;
    forwardButton.disabled = history.peekForward() === null;
  }
  backButton.addEventListener("click", () => {
    const target = history.peekBack();
    if (target) void go(target, "back");
  });
  forwardButton.addEventListener("click", () => {
    const target = history.peekForward();
    if (target) void go(target, "forward");
  });

  function renderSidebar(): void {
    if (!tree) return;
    const query = search.value;
    sidebar.render(
      query.trim()
        ? [{ id: "results", title: "Results", items: wikiSearch(index, query), collapsible: false, defaultOpen: true }]
        : wikiSections(tree, index),
    );
    sidebar.setActive(editor.currentPath());
  }
  search.addEventListener("input", renderSidebar);
  search.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      const first = wikiSearch(index, search.value)[0];
      if (first?.path) void go(first.path, "push");
    } else if (event.key === "Escape") {
      search.value = "";
      renderSidebar();
    }
  });

  function linkButton(path: string): HTMLButtonElement {
    const button = el("button", "sidebar-item", baseName(path));
    button.type = "button";
    button.title = index.get(path)?.title ?? path;
    button.addEventListener("click", () => void go(path, "push"));
    return button;
  }

  function renderLinks(): void {
    const path = editor.currentPath();
    if (!path || !index.get(path)) {
      linksPanel.replaceChildren();
      return;
    }
    const here = index.backlinks(path);
    const out = index.linksOut(path);

    const section = (title: string, items: HTMLElement[], emptyText: string): HTMLElement => {
      const wrapper = el("section", "sidebar-section");
      wrapper.append(el("div", "sidebar-heading", `${title} (${items.length})`));
      if (items.length === 0) {
        wrapper.append(el("p", "links-empty", emptyText));
      } else {
        const list = el("ul", "sidebar-list");
        for (const item of items) {
          const li = document.createElement("li");
          li.append(item);
          list.append(li);
        }
        wrapper.append(list);
      }
      return wrapper;
    };

    const outItems = out.map(({ link, path: target }) => {
      if (target) return linkButton(target);
      const button = el("button", "sidebar-item missing", link.target);
      button.type = "button";
      button.title = "No page yet. Click to create it.";
      button.addEventListener("click", () => void createFromLink(link.target));
      return button;
    });

    linksPanel.replaceChildren(
      section("Links here", here.map(linkButton), "No pages link here yet."),
      section("Links out", outItems, "This page has no [[links]]."),
    );
  }

  function rebuildIndex(): void {
    index = buildWikiIndex([...pages].map(([path, text]) => ({ path, text })));
  }

  async function loadAll(): Promise<void> {
    try {
      const [nextTree, wikiPages] = await Promise.all([fetchTree(), fetchWikiPages()]);
      tree = nextTree;
      pages.clear();
      for (const page of wikiPages) pages.set(page.path, page.content);
      rebuildIndex();
      renderSidebar();
      renderLinks();
      editor.refreshPreview();
    } catch (error) {
      sidebar.element.textContent = `Couldn't load the wiki: ${errorText(error)}`;
    }
  }

  async function createFromLink(target: string): Promise<void> {
    if (!tree) return;
    const current = editor.currentPath();
    const folders = tree.wiki.folders.map((folder) => folder.name);
    const choice = await askNewPage(target, folders, current ? folderOf(current) : "");
    if (!choice) return;

    const path = choice.folder ? `wiki/${choice.folder}/${slugify(choice.name)}.md` : `wiki/${slugify(choice.name)}.md`;
    try {
      const templatePath = templateForFolder(choice.folder, tree.wiki.templates);
      const template = templatePath ? (await fetchFile(templatePath)).content : null;
      const result = await saveFile(path, newPageContent(template, titleFromTarget(choice.name)), null);
      // "conflict" here means a page with that file name already exists; just open it.
      if (result.kind === "error") throw new Error(result.message);
    } catch (error) {
      window.alert(`Couldn't create ${path}: ${errorText(error)}`);
      return;
    }
    await loadAll();
    await go(path, "push");
  }

  // Keep links and backlinks current when a wiki page is saved or reloaded.
  ctx.store.subscribe((path) => {
    if (!path.startsWith("wiki/") || path.startsWith("wiki/_templates/")) return;
    const doc = ctx.store.get(path);
    if (!doc || pages.get(path) === doc.savedText) return;
    pages.set(path, doc.savedText);
    rebuildIndex();
    renderSidebar();
    renderLinks();
    editor.refreshPreview();
  });

  updateNavButtons();
  void loadAll().then(() => {
    if (!tree) return;
    const paths = openablePaths(wikiSections(tree, index));
    const remembered = loadSetting<string>(LAST_FILE_KEY, "wiki/README.md");
    const first = paths.includes(remembered) ? remembered : paths[0];
    if (first) void go(first, "push");
  });

  // Pick up pages added, removed, or edited outside the app when the window comes back into focus.
  window.addEventListener("focus", () => void loadAll());

  return { element, activePath: editor.currentPath, save: editor.save };
}
