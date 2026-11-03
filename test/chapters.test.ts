import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cleanChapterTitle, nextChapterFileName, slugify } from "../src/shared/chapters.ts";

describe("slugify", () => {
  it("makes lowercase, hyphenated names", () => {
    assert.equal(slugify("The Glass Road!"), "the-glass-road");
    assert.equal(slugify("  Where   the Sand Glows  "), "where-the-sand-glows");
  });

  it("strips accents and falls back for empty results", () => {
    assert.equal(slugify("Café Señor"), "cafe-senor");
    assert.equal(slugify("—?!"), "untitled");
  });

  it("caps long titles without a trailing hyphen", () => {
    const slug = slugify("word ".repeat(40));
    assert.ok(slug.length <= 60);
    assert.equal(slug.endsWith("-"), false);
  });
});

describe("nextChapterFileName", () => {
  it("starts at 01", () => {
    assert.equal(nextChapterFileName([], "Arrival"), "01-arrival.md");
  });

  it("continues after the highest number, ignoring gaps and other files", () => {
    assert.equal(nextChapterFileName(["01-a.md", "04-b.md", ".word-log.json", "notes.md"], "Next"), "05-next.md");
  });
});

describe("cleanChapterTitle", () => {
  it("collapses whitespace and rejects empty or huge titles", () => {
    assert.equal(cleanChapterTitle("  The\n  Arrival "), "The Arrival");
    assert.equal(cleanChapterTitle("   "), null);
    assert.equal(cleanChapterTitle("x".repeat(201)), null);
  });
});
