import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveFromPlanning, resolveFromWiki, resolvePlanningLink } from "../src/shared/planning-links.ts";
import { buildTree } from "../src/shared/tree.ts";

const tree = buildTree([
  "progress.md",
  "planning/02-one-paragraph.md",
  "planning/threads.md",
  "planning/theme-map.md",
  "planning/life-support-backups.md",
  "planning/Space Factions.md",
  "planning/archive/progress-log.md",
  "planning/archive/threads.md",
  "planning/archive/old-notes.md",
  "wiki/timeline.md",
]);
const resolve = (target: string): string | null => resolvePlanningLink(target, tree.planning);

describe("resolvePlanningLink", () => {
  it("matches by file name", () => {
    assert.equal(resolve("theme-map"), "planning/theme-map.md");
    assert.equal(resolve("02-one-paragraph"), "planning/02-one-paragraph.md");
  });

  it("ignores case, spaces, hyphens, underscores, and .md", () => {
    assert.equal(resolve("Theme Map"), "planning/theme-map.md");
    assert.equal(resolve("THEME_MAP.md"), "planning/theme-map.md");
    assert.equal(resolve("space-factions"), "planning/Space Factions.md");
  });

  it("ignores a folder prefix", () => {
    assert.equal(resolve("planning/theme-map.md"), "planning/theme-map.md");
    assert.equal(resolve("archive/old-notes.md"), "planning/archive/old-notes.md");
  });

  it("resolves progress at the novel folder's top level", () => {
    assert.equal(resolve("progress"), "progress.md");
  });

  it("finds files in the archive", () => {
    assert.equal(resolve("progress-log"), "planning/archive/progress-log.md");
  });

  it("prefers a file outside the archive on a name clash", () => {
    assert.equal(resolve("threads"), "planning/threads.md");
  });

  it("does not match a Snowflake step with no file yet", () => {
    assert.equal(resolve("04-one-page-synopsis"), null);
  });

  it("does not match wiki pages or unknown names", () => {
    assert.equal(resolve("timeline"), null);
    assert.equal(resolve("nothing-here"), null);
  });

  it("returns null for an empty target", () => {
    assert.equal(resolve(""), null);
    assert.equal(resolve("  "), null);
  });
});

describe("resolveFromPlanning", () => {
  const wiki = { resolve: (target: string): string | null => (target === "aster" || target === "threads" ? "wiki/characters/aster.md" : null) };

  it("tries planning files first, then wiki pages", () => {
    assert.equal(resolveFromPlanning("threads", tree.planning, wiki), "planning/threads.md");
    assert.equal(resolveFromPlanning("aster", tree.planning, wiki), "wiki/characters/aster.md");
  });

  it("is null when neither area matches", () => {
    assert.equal(resolveFromPlanning("nothing-here", tree.planning, wiki), null);
  });
});

describe("resolveFromWiki", () => {
  const wikiPages: Record<string, string> = { aster: "wiki/characters/aster.md", threads: "wiki/terms/threads.md" };
  const wiki = { resolve: (target: string): string | null => wikiPages[target] ?? null };

  it("tries wiki pages first, then planning files", () => {
    assert.equal(resolveFromWiki("threads", wiki, tree.planning), "wiki/terms/threads.md");
    assert.equal(resolveFromWiki("theme-map", wiki, tree.planning), "planning/theme-map.md");
  });

  it("is null when neither area matches, or the planning list isn't loaded yet", () => {
    assert.equal(resolveFromWiki("nothing-here", wiki, tree.planning), null);
    assert.equal(resolveFromWiki("theme-map", wiki, null), null);
  });
});
