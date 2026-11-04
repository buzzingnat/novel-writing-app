import { resolveFromPlanning } from "../../shared/planning-links.ts";
import type { Tree } from "../../shared/tree.ts";
import { fetchTree } from "../api.ts";
import { createSplitEditor } from "../editor.ts";
import { getWikiIndex, refreshWikiIndex } from "../link-directory.ts";
import { renderMarkdown } from "../markdown.ts";
import { createSidebar } from "../sidebar.ts";
import { openablePaths, planningSections, type SidebarSection } from "../sidebar-model.ts";
import { loadSetting, saveSetting } from "../storage.ts";
import type { View, ViewContext } from "./types.ts";

const LAST_FILE_KEY = "last-file:planning";

export function createPlanningView(ctx: ViewContext): View {
  const element = document.createElement("div");
  element.className = "with-sidebar";

  // The planning files [[links]] can reach; refreshed whenever the tree reloads.
  let planning: Tree["planning"] | null = null;

  const editor = createSplitEditor({
    store: ctx.store,
    viewKey: "planning",
    emptyMessage: "Choose a file from the sidebar.",
    onPathChange: ctx.refreshStatus,
    render: (text) =>
      renderMarkdown(text, {
        resolveWikiLink: (target) => (planning ? resolveFromPlanning(target, planning, getWikiIndex()) : null),
        linkMarker: (path) => (path.startsWith("wiki/") ? { emoji: "\u{1F4DA}", title: "Wiki page" } : null),
        missingLinkHint: "No planning file matches this link.",
      }),
    onPreviewClick: (event) => {
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("a.wikilink");
      if (!link) return;
      // Links are href="#"; never let the browser follow them. A red link does nothing.
      event.preventDefault();
      const path = link.dataset.path;
      if (!path) return;
      if (path.startsWith("wiki/")) void ctx.openPath(path);
      else void openFile(path);
    },
  });

  const openFile = async (path: string): Promise<void> => {
    if (await editor.open(path)) {
      saveSetting(LAST_FILE_KEY, path);
      sidebar.setActive(path);
    }
  };

  const sidebar = createSidebar({ viewKey: "planning", ariaLabel: "Planning files", onSelect: openFile });
  element.append(sidebar.element, editor.element);

  let sections: SidebarSection[] = [];
  const loadTree = async (): Promise<void> => {
    try {
      // Wiki pages are linkable too; if they can't be read, planning links still work.
      const [tree] = await Promise.all([fetchTree(), refreshWikiIndex().catch(() => undefined)]);
      planning = tree.planning;
      sections = planningSections(tree);
      sidebar.render(sections);
      sidebar.setActive(editor.currentPath());
      editor.refreshPreview();
    } catch (error) {
      sidebar.element.textContent = `Couldn't load files: ${error instanceof Error ? error.message : String(error)}`;
    }
  };

  void loadTree().then(() => {
    // Reopen the last file, or progress.md the first time.
    const paths = openablePaths(sections);
    const remembered = loadSetting<string>(LAST_FILE_KEY, "progress.md");
    const first = paths.includes(remembered) ? remembered : paths[0];
    // A link from the Wiki may have opened a file while the tree loaded; keep that one.
    if (first && !editor.currentPath()) void openFile(first);
  });

  // Pick up files added or removed outside the app when the window comes back into focus.
  window.addEventListener("focus", () => void loadTree());

  return {
    element,
    activePath: editor.currentPath,
    save: editor.save,
    open: async (path) => {
      await openFile(path);
    },
  };
}
