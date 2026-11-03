// Path rules shared by the server and the browser. Paths are always relative to
// the novel folder and always use "/" separators.

/**
 * Cleans a relative path ("planning//./threads.md" becomes "planning/threads.md").
 * Returns null for anything that could reach outside the novel folder.
 */
export function normalizeRelPath(input: string): string | null {
  if (input.length === 0 || input.includes("\0") || input.includes("\\")) return null;
  if (input.startsWith("/")) return null;
  const parts: string[] = [];
  for (const segment of input.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") return null;
    parts.push(segment);
  }
  return parts.length > 0 ? parts.join("/") : null;
}

/** Folders at the top of the novel folder that the app never lists or edits. */
const BLOCKED_TOP_FOLDERS = new Set(["app", "node_modules"]);

/** True for a normalized path the file API may read and write: visible Markdown files outside app/. */
export function isEditablePath(rel: string): boolean {
  const parts = rel.split("/");
  if (BLOCKED_TOP_FOLDERS.has(parts[0] ?? "")) return false;
  if (parts.some((part) => part.startsWith("."))) return false;
  return rel.toLowerCase().endsWith(".md");
}

/** The file name without folders or the .md extension. */
export function baseName(rel: string): string {
  const name = rel.slice(rel.lastIndexOf("/") + 1);
  return name.replace(/\.md$/i, "");
}
