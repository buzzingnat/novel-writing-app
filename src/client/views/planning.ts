import { fetchTree } from "../api.ts";
import { createSplitEditor } from "../editor.ts";
import { createSidebar } from "../sidebar.ts";
import { openablePaths, planningSections, type SidebarSection } from "../sidebar-model.ts";
import { loadSetting, saveSetting } from "../storage.ts";
import type { View, ViewContext } from "./types.ts";

const LAST_FILE_KEY = "last-file:planning";

export function createPlanningView(ctx: ViewContext): View {
  const element = document.createElement("div");
  element.className = "with-sidebar";

  const editor = createSplitEditor({
    store: ctx.store,
    viewKey: "planning",
    emptyMessage: "Choose a file from the sidebar.",
    onPathChange: ctx.refreshStatus,
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
      sections = planningSections(await fetchTree());
      sidebar.render(sections);
      sidebar.setActive(editor.currentPath());
    } catch (error) {
      sidebar.element.textContent = `Couldn't load files: ${error instanceof Error ? error.message : String(error)}`;
    }
  };

  void loadTree().then(() => {
    // Reopen the last file, or progress.md the first time.
    const paths = openablePaths(sections);
    const remembered = loadSetting<string>(LAST_FILE_KEY, "progress.md");
    const first = paths.includes(remembered) ? remembered : paths[0];
    if (first) void openFile(first);
  });

  // Pick up files added or removed outside the app when the window comes back into focus.
  window.addEventListener("focus", () => void loadTree());

  return { element, activePath: editor.currentPath, save: editor.save };
}
