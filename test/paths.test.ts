import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { baseName, isEditablePath, normalizeRelPath } from "../src/shared/paths.ts";

describe("normalizeRelPath", () => {
  it("cleans harmless extra slashes and dots", () => {
    assert.equal(normalizeRelPath("planning//./threads.md"), "planning/threads.md");
    assert.equal(normalizeRelPath("progress.md/"), "progress.md");
  });

  it("rejects anything that could leave the novel folder", () => {
    assert.equal(normalizeRelPath("../secret.md"), null);
    assert.equal(normalizeRelPath("planning/../../secret.md"), null);
    assert.equal(normalizeRelPath("/etc/passwd"), null);
    assert.equal(normalizeRelPath("planning\\..\\x.md"), null);
    assert.equal(normalizeRelPath("a\0.md"), null);
    assert.equal(normalizeRelPath(""), null);
    assert.equal(normalizeRelPath("./"), null);
  });
});

describe("isEditablePath", () => {
  it("allows Markdown files in the novel folder", () => {
    assert.equal(isEditablePath("progress.md"), true);
    assert.equal(isEditablePath("wiki/places/the-capital.md"), true);
    assert.equal(isEditablePath("manuscript/01-start.MD"), true);
  });

  it("blocks non-Markdown, hidden, app, and node_modules paths", () => {
    assert.equal(isEditablePath("planning/notes.txt"), false);
    assert.equal(isEditablePath("manuscript/.word-log.json"), false);
    assert.equal(isEditablePath(".hidden/secret.md"), false);
    assert.equal(isEditablePath("wiki/.obsidian/x.md"), false);
    assert.equal(isEditablePath("app/plan.md"), false);
    assert.equal(isEditablePath("node_modules/pkg/README.md"), false);
  });
});

describe("baseName", () => {
  it("drops folders and the extension", () => {
    assert.equal(baseName("wiki/places/the-capital.md"), "the-capital");
    assert.equal(baseName("progress.md"), "progress");
  });
});
