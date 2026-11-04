// Resolves a [[link]] target to a planning file. Rules are from design.md ("Behavior").
import type { Tree } from "./tree.ts";
import { linkKey } from "./wikilinks.ts";

/**
 * Finds the planning file a link target names, or null if none does (a red link).
 * Matches by file name using the Wiki's rule (case, spaces, hyphens, underscores, ".md",
 * and any folder prefix are ignored). A file outside planning/archive/ beats one inside it.
 * Snowflake steps that have no file yet can't match.
 */
export function resolvePlanningLink(target: string, planning: Tree["planning"]): string | null {
  const key = linkKey(target);
  if (!key) return null;
  const active = [
    ...(planning.progress ? [planning.progress] : []),
    ...planning.steps.flatMap((step) => (step.path ? [step.path] : [])),
    ...planning.tracking,
    ...planning.notes,
  ];
  return (
    active.find((path) => linkKey(path) === key) ?? planning.archive.find((path) => linkKey(path) === key) ?? null
  );
}
