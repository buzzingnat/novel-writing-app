// What each sidebar shows, as plain data. No DOM here, so the grouping can be tested in Node.
import { baseName } from "../shared/paths.ts";
import type { Tree } from "../shared/tree.ts";
import type { WikiIndex } from "../shared/wikilinks.ts";

export interface SidebarItem {
  label: string;
  /** null means a placeholder that can't be opened (a Snowflake step not started yet). */
  path: string | null;
  /** Tooltip text. */
  hint?: string;
}

export interface SidebarSection {
  id: string;
  /** null for an untitled section at the top. */
  title: string | null;
  items: SidebarItem[];
  collapsible: boolean;
  /** Starting state for a collapsible section, before the author has toggled it. */
  defaultOpen: boolean;
}

const fileItem = (path: string): SidebarItem => ({ label: baseName(path), path, hint: path });

export function planningSections(tree: Tree): SidebarSection[] {
  const { planning } = tree;
  return [
    {
      id: "progress",
      title: null,
      items: planning.progress ? [{ label: "progress", path: planning.progress, hint: planning.progress }] : [],
      collapsible: false,
      defaultOpen: true,
    },
    {
      id: "steps",
      title: "Snowflake",
      items: planning.steps.map((step) => ({
        label: `${step.step} ${step.label}`,
        path: step.path,
        hint: step.path ?? `Not started (planning/${step.expectedFile})`,
      })),
      collapsible: false,
      defaultOpen: true,
    },
    { id: "tracking", title: "Tracking", items: planning.tracking.map(fileItem), collapsible: false, defaultOpen: true },
    { id: "notes", title: "Notes", items: planning.notes.map(fileItem), collapsible: true, defaultOpen: false },
    { id: "archive", title: "Archive", items: planning.archive.map(fileItem), collapsible: true, defaultOpen: false },
  ].filter((section) => section.items.length > 0 || section.id === "steps");
}

export function wikiSections(tree: Tree, index: WikiIndex): SidebarSection[] {
  const { wiki } = tree;
  const pageItem = (path: string, prefix = ""): SidebarItem => ({
    label: prefix + baseName(path),
    path,
    hint: index.get(path)?.title ?? path,
  });
  return [
    {
      id: "pinned",
      title: null,
      items: wiki.pinned.map((path) => pageItem(path, "★ ")),
      collapsible: false,
      defaultOpen: true,
    },
    ...wiki.folders.map((folder) => ({
      id: `folder:${folder.name}`,
      title: folder.name.replace(/-/g, " "),
      items: folder.files.map((path) => pageItem(path)),
      collapsible: true,
      defaultOpen: true,
    })),
    { id: "other", title: "Other", items: wiki.other.map((path) => pageItem(path)), collapsible: true, defaultOpen: true },
    { id: "templates", title: "Templates", items: wiki.templates.map(fileItem), collapsible: true, defaultOpen: false },
  ].filter((section) => section.items.length > 0);
}

/** Wiki pages whose file name, title, or alias contains the query; file-name matches first. */
export function wikiSearch(index: WikiIndex, query: string): SidebarItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const normalize = (text: string): string => text.toLowerCase().replace(/[-_]+/g, " ");
  const spaced = normalize(needle);
  const scored: { item: SidebarItem; score: number }[] = [];
  for (const page of index.pages) {
    const name = normalize(baseName(page.path));
    const haystacks = [page.title, ...page.aliases].map(normalize);
    const score = name.startsWith(spaced) ? 0 : name.includes(spaced) ? 1 : haystacks.some((h) => h.includes(spaced)) ? 2 : -1;
    if (score >= 0) scored.push({ item: { label: baseName(page.path), path: page.path, hint: page.title }, score });
  }
  return scored
    .sort((a, b) => a.score - b.score || a.item.label.localeCompare(b.item.label))
    .map((entry) => entry.item);
}

/** Every path a sidebar can open, for checking that a remembered file still exists. */
export function openablePaths(sections: SidebarSection[]): string[] {
  return sections.flatMap((section) => section.items.flatMap((item) => (item.path ? [item.path] : [])));
}
