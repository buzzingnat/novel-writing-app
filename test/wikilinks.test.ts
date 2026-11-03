import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { aliasesOf, parseFrontmatter } from "../src/shared/frontmatter.ts";
import {
  buildWikiIndex,
  extractLinks,
  linkKey,
  newPageContent,
  parseLinkInner,
  templateForFolder,
  titleFromTarget,
} from "../src/shared/wikilinks.ts";

describe("parseLinkInner", () => {
  it("reads target, heading, and label", () => {
    assert.deepEqual(parseLinkInner("the-capital"), { target: "the-capital", heading: null, label: null });
    assert.deepEqual(parseLinkInner("colonists|colonist"), { target: "colonists", heading: null, label: "colonist" });
    assert.deepEqual(parseLinkInner("timeline#Founding|Founding"), {
      target: "timeline",
      heading: "Founding",
      label: "Founding",
    });
  });

  it("ignores empty links like the templates' [[ ]]", () => {
    assert.equal(parseLinkInner(" "), null);
    assert.equal(parseLinkInner("#Heading"), null);
  });
});

describe("extractLinks", () => {
  it("finds every link, including embeds", () => {
    const links = extractLinks("See [[the-empire]] and [[outbreaks|outbreak]]. ![[map]]");
    assert.deepEqual(
      links.map((link) => link.target),
      ["the-empire", "outbreaks", "map"],
    );
  });

  it("skips links inside inline code and fenced code blocks", () => {
    const text = "Real [[a]]. Code `[[b]]`.\n\n```\n[[c]]\n```\n\nAfter [[d]].";
    assert.deepEqual(
      extractLinks(text).map((link) => link.target),
      ["a", "d"],
    );
  });
});

describe("linkKey", () => {
  it("ignores case, spaces vs hyphens, folders, and .md", () => {
    assert.equal(linkKey("The Capital"), "the-capital");
    assert.equal(linkKey("the_capital"), "the-capital");
    assert.equal(linkKey("places/the-capital.md"), "the-capital");
  });
});

describe("frontmatter", () => {
  it("parses YAML and reads aliases in list or single form", () => {
    const { data, body, error } = parseFrontmatter("---\ntype: place\naliases: [the valley city, old capital]\n---\n# X\n");
    assert.equal(error, null);
    assert.equal(data.type, "place");
    assert.deepEqual(aliasesOf(data), ["the valley city", "old capital"]);
    assert.equal(body, "# X\n");
    assert.deepEqual(aliasesOf({ aliases: "solo" }), ["solo"]);
    assert.deepEqual(aliasesOf({}), []);
  });

  it("reports broken YAML without throwing", () => {
    const parsed = parseFrontmatter("---\naliases: [unclosed\n---\nbody");
    assert.notEqual(parsed.error, null);
    assert.deepEqual(parsed.data, {});
  });
});

describe("buildWikiIndex", () => {
  const index = buildWikiIndex([
    {
      path: "wiki/places/the-capital.md",
      text: "---\naliases: [the valley city]\n---\n# The capital (name TBD)\n\nSeat of [[the-empire]]. Near [[Academy Town]]. Also [[old-port]] and [[the-empire|the Empire]].",
    },
    { path: "wiki/factions/the-empire.md", text: "# The Empire\n\nCapital: [[the valley city]].\n" },
    { path: "wiki/places/academy-town.md", text: "# Academy town\n\n[[The capital (name TBD)]] is far.\n" },
    { path: "wiki/timeline.md", text: "# Timeline\n\n## Founding\n\n[[the-capital]] founded. `[[the-empire]]`\n" },
  ]);

  it("resolves by file name, ignoring case and spaces", () => {
    assert.equal(index.resolve("the-empire"), "wiki/factions/the-empire.md");
    assert.equal(index.resolve("Academy Town"), "wiki/places/academy-town.md");
  });

  it("resolves by alias, then by page title", () => {
    assert.equal(index.resolve("the valley city"), "wiki/places/the-capital.md");
    assert.equal(index.resolve("The capital (name TBD)"), "wiki/places/the-capital.md");
  });

  it("returns null for a missing page", () => {
    assert.equal(index.resolve("old-port"), null);
  });

  it("prefers a file name over another page's alias", () => {
    const tricky = buildWikiIndex([
      { path: "wiki/a.md", text: "---\naliases: [b]\n---\n# A\n" },
      { path: "wiki/b.md", text: "# B\n" },
    ]);
    assert.equal(tricky.resolve("b"), "wiki/b.md");
  });

  it("lists distinct outgoing links, including missing ones", () => {
    const out = index.linksOut("wiki/places/the-capital.md");
    assert.deepEqual(
      out.map((entry) => entry.path),
      ["wiki/factions/the-empire.md", "wiki/places/academy-town.md", null],
    );
    assert.equal(out[2]?.link.target, "old-port");
  });

  it("computes backlinks through names, aliases, and titles, ignoring code", () => {
    assert.deepEqual(index.backlinks("wiki/places/the-capital.md"), [
      "wiki/factions/the-empire.md",
      "wiki/places/academy-town.md",
      "wiki/timeline.md",
    ]);
    assert.deepEqual(index.backlinks("wiki/factions/the-empire.md"), ["wiki/places/the-capital.md"]);
  });

  it("uses the first heading as the title", () => {
    assert.equal(index.get("wiki/places/the-capital.md")?.title, "The capital (name TBD)");
  });
});

describe("new pages from red links", () => {
  const templates = [
    "wiki/_templates/character.md",
    "wiki/_templates/place.md",
    "wiki/_templates/faction.md",
    "wiki/_templates/term.md",
  ];

  it("chooses the template by folder", () => {
    assert.equal(templateForFolder("characters", templates), "wiki/_templates/character.md");
    assert.equal(templateForFolder("places", templates), "wiki/_templates/place.md");
    assert.equal(templateForFolder("factions", templates), "wiki/_templates/faction.md");
    assert.equal(templateForFolder("terms-and-rules", templates), "wiki/_templates/term.md");
    assert.equal(templateForFolder("", templates), null);
    assert.equal(templateForFolder("objects", templates), null);
  });

  it("titles the page from the link target", () => {
    assert.equal(titleFromTarget("old-port"), "Old port");
    assert.equal(titleFromTarget("  the  glass_road "), "The glass road");
  });

  it("replaces the template's first heading with the title", () => {
    const template = "---\ntype: place\n---\n\n# Name\n\n## Confirmed\n";
    assert.equal(newPageContent(template, "Old port"), "---\ntype: place\n---\n\n# Old port\n\n## Confirmed\n");
    assert.equal(newPageContent(null, "Old port"), "# Old port\n");
    assert.equal(newPageContent("# Name\n", "Cost $1"), "# Cost $1\n");
  });
});
