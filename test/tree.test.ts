import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildTree } from "../src/shared/tree.ts";

const PATHS = [
  "progress.md",
  "agents.md",
  "planning/00-story-bible.md",
  "planning/01-one-sentence.md",
  "planning/03-character-summaries.md",
  "planning/threads.md",
  "planning/theme-map.md",
  "planning/research-notes.md",
  "planning/step2-format.md",
  "planning/archive/progress-log.md",
  "wiki/README.md",
  "wiki/timeline.md",
  "wiki/open-questions.md",
  "wiki/places/the-capital.md",
  "wiki/characters/planet-hero.md",
  "wiki/characters/dim-master.md",
  "wiki/_templates/character.md",
  "manuscript/02-second.md",
  "manuscript/01-first.md",
];

describe("buildTree: planning", () => {
  const { planning } = buildTree(PATHS);

  it("puts progress.md on top and leaves agents.md out", () => {
    assert.equal(planning.progress, "progress.md");
    const everything = JSON.stringify(buildTree(PATHS));
    assert.equal(everything.includes("agents.md"), false);
  });

  it("lists all ten Snowflake steps, with missing ones as null", () => {
    assert.equal(planning.steps.length, 10);
    assert.deepEqual(
      planning.steps.map((step) => step.path),
      [
        "planning/00-story-bible.md",
        "planning/01-one-sentence.md",
        null,
        "planning/03-character-summaries.md",
        null,
        null,
        null,
        null,
        null,
        null,
      ],
    );
    assert.equal(planning.steps[4]?.expectedFile, "04-one-page-synopsis.md");
  });

  it("matches a step by number prefix even if the rest of the name differs", () => {
    const tree = buildTree(["planning/02-paragraph-v2.md"]);
    assert.equal(tree.planning.steps[2]?.path, "planning/02-paragraph-v2.md");
  });

  it("separates tracking, notes, and archive", () => {
    assert.deepEqual(planning.tracking, ["planning/threads.md", "planning/theme-map.md"]);
    assert.deepEqual(planning.notes, ["planning/research-notes.md", "planning/step2-format.md"]);
    assert.deepEqual(planning.archive, ["planning/archive/progress-log.md"]);
  });
});

describe("buildTree: wiki", () => {
  const { wiki } = buildTree(PATHS);

  it("pins timeline and open-questions", () => {
    assert.deepEqual(wiki.pinned, ["wiki/timeline.md", "wiki/open-questions.md"]);
  });

  it("groups pages by folder, sorted", () => {
    assert.deepEqual(wiki.folders, [
      { name: "characters", files: ["wiki/characters/dim-master.md", "wiki/characters/planet-hero.md"] },
      { name: "places", files: ["wiki/places/the-capital.md"] },
    ]);
  });

  it("keeps README and templates separate", () => {
    assert.deepEqual(wiki.other, ["wiki/README.md"]);
    assert.deepEqual(wiki.templates, ["wiki/_templates/character.md"]);
  });
});

describe("buildTree: manuscript", () => {
  it("lists chapters in file-name order", () => {
    assert.deepEqual(buildTree(PATHS).manuscript.chapters, ["manuscript/01-first.md", "manuscript/02-second.md"]);
  });

  it("handles a novel folder with no manuscript or wiki yet", () => {
    const tree = buildTree(["progress.md"]);
    assert.deepEqual(tree.manuscript.chapters, []);
    assert.deepEqual(tree.wiki.folders, []);
    assert.equal(tree.planning.steps.every((step) => step.path === null), true);
  });
});
