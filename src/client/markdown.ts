import MarkdownIt from "markdown-it";
import { aliasesOf, parseFrontmatter, splitFrontmatter } from "../shared/frontmatter.ts";
import { parseLinkInner, type WikiLink } from "../shared/wikilinks.ts";

export interface RenderOptions {
  /** Turns [[links]] into clickable links (Wiki view only). Returns the page path, or null for a red link. */
  resolveWikiLink?: (target: string) => string | null;
  /** Hover text for a red link; the default suits the Wiki, where clicking creates a page. */
  missingLinkHint?: string;
  /** "raw" shows the YAML as a muted block; "strip" shows a short summary line (Wiki view). */
  frontmatter?: "raw" | "strip";
}

// A type alias (not an interface) so it fits markdown-it's open-ended env type.
type RenderEnv = {
  resolveWikiLink?: (target: string) => string | null;
  missingLinkHint?: string;
};

// Raw HTML in the Markdown files is shown as text, never run, so the preview
// can be written with innerHTML safely. markdown-it also refuses javascript: links.
const md = new MarkdownIt({ html: false, linkify: true, typographer: false });
const escape = md.utils.escapeHtml;

const defaultLinkOpen =
  md.renderer.rules.link_open ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

// External links open in a new tab so they never navigate away from unsaved work.
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const href = String(token?.attrGet("href") ?? "");
  if (token && /^https?:\/\//i.test(href)) {
    token.attrSet("target", "_blank");
    token.attrSet("rel", "noopener noreferrer");
  }
  return defaultLinkOpen(tokens, idx, options, env, self);
};

// [[target]], [[target|label]], [[target#heading]], and ![[embed]] (shown as a link).
// Runs before markdown-it's own link rule; inline code is parsed earlier, so links in code stay text.
const wikiLinkRule: Parameters<typeof md.inline.ruler.before>[2] = (state, silent) => {
  const env = state.env as RenderEnv | undefined;
  if (!env?.resolveWikiLink) return false;
  const src = state.src;
  const open = src.charCodeAt(state.pos) === 0x21 /* ! */ ? state.pos + 1 : state.pos;
  if (src.charCodeAt(open) !== 0x5b || src.charCodeAt(open + 1) !== 0x5b) return false;
  const close = src.indexOf("]]", open + 2);
  if (close === -1) return false;
  const inner = src.slice(open + 2, close);
  if (/[[\]\n]/.test(inner)) return false;
  const link = parseLinkInner(inner);
  if (!link) return false;
  if (!silent) {
    const token = state.push("wikilink", "", 0);
    token.meta = { link, path: env.resolveWikiLink(link.target), missingHint: env.missingLinkHint };
  }
  state.pos = close + 2;
  return true;
};
md.inline.ruler.before("link", "wikilink", wikiLinkRule);

md.renderer.rules.wikilink = (tokens, idx) => {
  const { link, path, missingHint } = tokens[idx]?.meta as {
    link: WikiLink;
    path: string | null;
    missingHint?: string;
  };
  const label = escape(link.label ?? (link.heading ? `${link.target} › ${link.heading}` : link.target));
  if (path === null) {
    return `<a href="#" class="wikilink missing" data-target="${escape(link.target)}" title="${escape(missingHint ?? "No page yet. Click to create it.")}">${label}</a>`;
  }
  return `<a href="#" class="wikilink" data-path="${escape(path)}" title="${escape(path)}">${label}</a>`;
};

function frontmatterSummary(text: string): { html: string; body: string } {
  const { data, body, error } = parseFrontmatter(text);
  if (error !== null) {
    const raw = splitFrontmatter(text).frontmatter ?? "";
    return { html: `<pre class="frontmatter frontmatter-error" title="${escape(error)}">${escape(raw)}</pre>`, body };
  }
  const chips: string[] = [];
  for (const key of ["type", "status"]) {
    const value = data[key];
    if (typeof value === "string" || typeof value === "number") {
      chips.push(`<span class="chip chip-${escape(key)}">${escape(key)}: ${escape(String(value))}</span>`);
    }
  }
  if (data.placeholder === true) chips.push(`<span class="chip chip-placeholder">placeholder name</span>`);
  const aliases = aliasesOf(data);
  if (aliases.length > 0) chips.push(`<span class="chip">also: ${escape(aliases.join(", "))}</span>`);
  return { html: chips.length > 0 ? `<div class="frontmatter-strip">${chips.join("")}</div>` : "", body };
}

/** Renders a Markdown file for the preview. */
export function renderMarkdown(text: string, options: RenderOptions = {}): string {
  const env: RenderEnv = { resolveWikiLink: options.resolveWikiLink, missingLinkHint: options.missingLinkHint };
  if (options.frontmatter === "strip") {
    const { html, body } = frontmatterSummary(text);
    return html + md.render(body, env);
  }
  const { frontmatter, body } = splitFrontmatter(text);
  const front = frontmatter === null ? "" : `<pre class="frontmatter">${escape(frontmatter)}</pre>`;
  return front + md.render(body, env);
}
