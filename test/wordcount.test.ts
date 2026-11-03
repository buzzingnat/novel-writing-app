import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chapterNumber, chapterTitle } from "../src/shared/chapters.ts";
import { countWords, formatCount, formatShortCount } from "../src/shared/wordcount.ts";

describe("countWords", () => {
  it("counts plain words", () => {
    assert.equal(countWords("The sand glowed at dusk."), 5);
    assert.equal(countWords(""), 0);
    assert.equal(countWords("   \n\n  "), 0);
  });

  it("ignores Markdown symbols that stand alone", () => {
    assert.equal(countWords("# Chapter One\n\n---\n\n* a list item\n> quoted words\n"), 7);
  });

  it("does not count frontmatter", () => {
    assert.equal(countWords("---\npov: hero\nstatus: draft\n---\nShe ran."), 2);
  });

  it("treats em and en dashes as breaks, hyphens as part of a word", () => {
    assert.equal(countWords("She stopped—listening."), 3);
    assert.equal(countWords("She stopped — listening."), 3);
    assert.equal(countWords("pages 4–6 of a well-known book"), 7);
  });

  it("counts words with apostrophes, accents, and numbers", () => {
    assert.equal(countWords("Don't touch the café's 3 lamps"), 6);
  });

  it("ignores punctuation-only tokens", () => {
    assert.equal(countWords("Wait . . . what ?!"), 2);
  });
});

describe("count formatting", () => {
  it("formats full and short counts", () => {
    assert.equal(formatCount(31402), "31,402");
    assert.equal(formatShortCount(640), "640");
    assert.equal(formatShortCount(1912), "1.9k");
    assert.equal(formatShortCount(4000), "4k");
    assert.equal(formatShortCount(31402), "31k");
    assert.equal(formatShortCount(-1200), "-1.2k");
  });
});

describe("chapterTitle and chapterNumber", () => {
  it("uses the first heading, else the file name", () => {
    assert.equal(chapterTitle("# The Glass Road\n\nText", "manuscript/02-x.md"), "The Glass Road");
    assert.equal(chapterTitle("No heading here", "manuscript/03-the-long-night.md"), "The long night");
    assert.equal(chapterTitle("", "manuscript/04.md"), "Untitled");
  });

  it("reads the number prefix", () => {
    assert.equal(chapterNumber("manuscript/03-the-road.md"), 3);
    assert.equal(chapterNumber("manuscript/notes.md"), null);
  });
});
