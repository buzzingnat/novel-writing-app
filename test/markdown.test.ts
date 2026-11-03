import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderMarkdown } from "../src/client/markdown.ts";
import { toggleLayout } from "../src/client/editor.ts";
import { splitFrontmatter } from "../src/shared/frontmatter.ts";

describe("splitFrontmatter", () => {
  it("separates a YAML block from the body", () => {
    assert.deepEqual(splitFrontmatter("---\ntype: place\n---\n# Capital\n"), {
      frontmatter: "type: place",
      body: "# Capital\n",
    });
  });

  it("handles empty frontmatter, CRLF, and files without any", () => {
    assert.deepEqual(splitFrontmatter("---\n---\nbody"), { frontmatter: "", body: "body" });
    assert.deepEqual(splitFrontmatter("---\r\na: 1\r\n---\r\nbody"), { frontmatter: "a: 1", body: "body" });
    assert.deepEqual(splitFrontmatter("# Just text\n---\n"), { frontmatter: null, body: "# Just text\n---\n" });
  });
});

describe("renderMarkdown", () => {
  it("renders headings and lists", () => {
    const html = renderMarkdown("# Title\n\n- one\n- two\n");
    assert.match(html, /<h1>Title<\/h1>/);
    assert.match(html, /<li>one<\/li>/);
  });

  it("shows raw HTML as text instead of running it", () => {
    const html = renderMarkdown('<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">');
    assert.equal(html.includes("<script>"), false);
    assert.equal(html.includes("<img"), false);
    assert.match(html, /&lt;script&gt;/);
  });

  it("refuses javascript: links and opens web links in a new tab", () => {
    const bad = renderMarkdown("[x](javascript:alert(1))");
    assert.equal(bad.includes('href="javascript:'), false);
    const good = renderMarkdown("[site](https://example.com)");
    assert.match(good, /target="_blank"/);
    assert.match(good, /rel="noopener noreferrer"/);
  });

  it("shows frontmatter as an escaped muted block", () => {
    const html = renderMarkdown("---\ntitle: <b>x</b>\n---\nBody");
    assert.match(html, /<pre class="frontmatter">title: &lt;b&gt;x&lt;\/b&gt;<\/pre>/);
    assert.match(html, /<p>Body<\/p>/);
  });
});

describe("renderMarkdown with wiki links", () => {
  const resolveWikiLink = (target: string): string | null =>
    target === "the-empire" ? "wiki/factions/the-empire.md" : null;

  it("leaves [[links]] as plain text unless a resolver is given", () => {
    assert.match(renderMarkdown("See [[the-empire]]."), /See \[\[the-empire\]\]\./);
  });

  it("links resolved pages and marks missing ones", () => {
    const html = renderMarkdown("See [[the-empire|the Empire]] and [[old-port]].", { resolveWikiLink });
    assert.match(html, /<a href="#" class="wikilink" data-path="wiki\/factions\/the-empire.md"[^>]*>the Empire<\/a>/);
    assert.match(html, /<a href="#" class="wikilink missing" data-target="old-port"[^>]*>old-port<\/a>/);
  });

  it("shows headings in the label and keeps links in code as text", () => {
    const html = renderMarkdown("[[the-empire#Rulers]] `[[the-empire]]`", { resolveWikiLink });
    assert.match(html, />the-empire › Rulers<\/a>/);
    assert.match(html, /<code>\[\[the-empire\]\]<\/code>/);
  });

  it("escapes link text and targets", () => {
    const html = renderMarkdown('[[<b>x"</b>]]', { resolveWikiLink });
    assert.equal(html.includes("<b>"), false);
    assert.match(html, /data-target="&lt;b&gt;x&quot;&lt;\/b&gt;"/);
  });

  it("summarizes frontmatter as chips in strip mode", () => {
    const html = renderMarkdown("---\ntype: place\nstatus: tentative\nplaceholder: true\naliases: [a, b]\ntags: [x]\n---\n# T", {
      frontmatter: "strip",
    });
    assert.match(html, /<div class="frontmatter-strip">/);
    assert.match(html, /type: place/);
    assert.match(html, /status: tentative/);
    assert.match(html, /placeholder name/);
    assert.match(html, /also: a, b/);
    assert.equal(html.includes("tags"), false);
  });
});

describe("toggleLayout", () => {
  it("hides one pane from the split", () => {
    assert.equal(toggleLayout("both", "preview"), "source");
    assert.equal(toggleLayout("both", "source"), "preview");
  });

  it("shows a hidden pane again", () => {
    assert.equal(toggleLayout("source", "preview"), "both");
    assert.equal(toggleLayout("preview", "source"), "both");
  });

  it("never hides both: hiding the only visible pane swaps to the other", () => {
    assert.equal(toggleLayout("source", "source"), "preview");
    assert.equal(toggleLayout("preview", "preview"), "source");
  });
});
