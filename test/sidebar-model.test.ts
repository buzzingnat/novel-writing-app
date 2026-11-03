import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openablePaths, planningSections, wikiSearch, wikiSections } from "../src/client/sidebar-model.ts";
import { buildTree } from "../src/shared/tree.ts";
import { buildWikiIndex } from "../src/shared/wikilinks.ts";

describe("wikiSections", () => {
  const wikiTree = buildTree([
    "wiki/README.md",
    "wiki/timeline.md",
    "wiki/open-questions.md",
    "wiki/places/the-capital.md",
    "wiki/terms-and-rules/glowing-sand.md",
    "wiki/_templates/place.md",
  ]);
  const index = buildWikiIndex([{ path: "wiki/places/the-capital.md", text: "# The capital (name TBD)\n" }]);
  const sections = wikiSections(wikiTree, index);

  it("puts pinned pages first, then folders, Other, and Templates", () => {
    assert.deepEqual(
      sections.map((section) => section.title),
      [null, "places", "terms and rules", "Other", "Templates"],
    );
    assert.deepEqual(
      sections[0]?.items.map((item) => item.label),
      ["★ timeline", "★ open-questions"],
    );
  });

  it("uses page titles as tooltips and keeps templates collapsed", () => {
    assert.equal(sections[1]?.items[0]?.hint, "The capital (name TBD)");
    assert.equal(sections.at(-1)?.defaultOpen, false);
  });
});

describe("wikiSearch", () => {
  const index = buildWikiIndex([
    { path: "wiki/places/the-capital.md", text: "---\naliases: [valley city]\n---\n# The capital\n" },
    { path: "wiki/places/capital-outskirts.md", text: "# Outskirts\n" },
    { path: "wiki/factions/the-empire.md", text: "# The Empire\n" },
  ]);

  it("matches file names, titles, and aliases, file-name starts first", () => {
    assert.deepEqual(
      wikiSearch(index, "capital").map((item) => item.path),
      ["wiki/places/capital-outskirts.md", "wiki/places/the-capital.md"],
    );
    assert.deepEqual(
      wikiSearch(index, "valley").map((item) => item.path),
      ["wiki/places/the-capital.md"],
    );
    assert.deepEqual(
      wikiSearch(index, "the empire").map((item) => item.path),
      ["wiki/factions/the-empire.md"],
    );
  });

  it("returns nothing for an empty query", () => {
    assert.deepEqual(wikiSearch(index, "  "), []);
  });
});

const tree = buildTree([
  "progress.md",
  "planning/00-story-bible.md",
  "planning/01-one-sentence.md",
  "planning/threads.md",
  "planning/research-notes.md",
  "planning/archive/progress-log.md",
]);

describe("planningSections", () => {
  const sections = planningSections(tree);
  const byId = new Map(sections.map((section) => [section.id, section]));

  it("orders progress, Snowflake, Tracking, Notes, Archive", () => {
    assert.deepEqual(
      sections.map((section) => section.id),
      ["progress", "steps", "tracking", "notes", "archive"],
    );
    assert.deepEqual(byId.get("progress")?.items, [{ label: "progress", path: "progress.md", hint: "progress.md" }]);
  });

  it("shows all ten steps; unstarted ones have no path and name the expected file", () => {
    const steps = byId.get("steps")?.items ?? [];
    assert.equal(steps.length, 10);
    assert.deepEqual(steps[0], { label: "0 Story bible", path: "planning/00-story-bible.md", hint: "planning/00-story-bible.md" });
    assert.deepEqual(steps[4], { label: "4 One-page synopsis", path: null, hint: "Not started (planning/04-one-page-synopsis.md)" });
  });

  it("makes only Notes and Archive collapsible, closed by default", () => {
    for (const section of sections) {
      const collapsible = section.id === "notes" || section.id === "archive";
      assert.equal(section.collapsible, collapsible, section.id);
      assert.equal(section.defaultOpen, !collapsible, section.id);
    }
  });

  it("labels files by name without folders or extension", () => {
    assert.deepEqual(byId.get("notes")?.items.map((item) => item.label), ["research-notes"]);
    assert.deepEqual(byId.get("archive")?.items.map((item) => item.label), ["progress-log"]);
  });

  it("drops empty groups but always keeps the Snowflake steps", () => {
    const empty = planningSections(buildTree([]));
    assert.deepEqual(
      empty.map((section) => section.id),
      ["steps"],
    );
  });

  it("lists every openable path", () => {
    assert.deepEqual(openablePaths(sections), [
      "progress.md",
      "planning/00-story-bible.md",
      "planning/01-one-sentence.md",
      "planning/threads.md",
      "planning/research-notes.md",
      "planning/archive/progress-log.md",
    ]);
  });
});
