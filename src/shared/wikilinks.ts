// Obsidian-style [[wiki links]]: parsing, resolving to files, and backlinks.
// Rules are from design.md (View 2) and plan.md ("Wiki link resolution").
import { aliasesOf, parseFrontmatter } from "./frontmatter.ts";
import { baseName } from "./paths.ts";

export interface WikiLink {
  target: string;
  /** From [[page#Heading]]; the link still goes to the page. */
  heading: string | null;
  /** From [[page|label]]. */
  label: string | null;
}

/** Parses what's between [[ and ]]. Returns null for an empty link such as the templates' "[[ ]]". */
export function parseLinkInner(inner: string): WikiLink | null {
  const pipe = inner.indexOf("|");
  const beforePipe = pipe === -1 ? inner : inner.slice(0, pipe);
  const label = pipe === -1 ? null : inner.slice(pipe + 1).trim() || null;
  const hash = beforePipe.indexOf("#");
  const target = (hash === -1 ? beforePipe : beforePipe.slice(0, hash)).trim();
  const heading = hash === -1 ? null : beforePipe.slice(hash + 1).trim() || null;
  return target ? { target, heading, label } : null;
}

/** Blanks out fenced code blocks and inline code so links inside them are ignored. */
function stripCode(text: string): string {
  return text
    .replace(/^(```|~~~)[^\n]*\n[\s\S]*?(?:^\1[^\n]*$|(?![\s\S]))/gm, "")
    .replace(/(`+)[^`\n][\s\S]*?\1/g, "");
}

export function extractLinks(text: string): WikiLink[] {
  const links: WikiLink[] = [];
  for (const match of stripCode(text).matchAll(/!?\[\[([^[\]\n]*)\]\]/g)) {
    const link = parseLinkInner(match[1] ?? "");
    if (link) links.push(link);
  }
  return links;
}

/** Comparison key for names: case, spaces, hyphens, and underscores don't matter. */
export function linkKey(name: string): string {
  const last = name.trim().split("/").pop() ?? "";
  return last
    .replace(/\.md$/i, "")
    .toLowerCase()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface WikiPage {
  path: string;
  text: string;
}

export interface PageInfo {
  path: string;
  title: string;
  aliases: string[];
  frontmatter: Record<string, unknown>;
  links: WikiLink[];
}

export interface ResolvedLink {
  link: WikiLink;
  /** null when no page matches (a red link). */
  path: string | null;
}

export interface WikiIndex {
  pages: PageInfo[];
  get(path: string): PageInfo | undefined;
  /** Finds the page for a link target: by file name, then alias, then title. */
  resolve(target: string): string | null;
  /** One entry per distinct destination, in the order they first appear. */
  linksOut(path: string): ResolvedLink[];
  /** Pages that link to this one, sorted by path. */
  backlinks(path: string): string[];
}

function titleOf(body: string, data: Record<string, unknown>, path: string): string {
  const heading = /^#[ \t]+(.+?)[ \t#]*$/m.exec(body);
  if (heading?.[1]) return heading[1];
  if (typeof data.title === "string" && data.title.trim()) return data.title.trim();
  return baseName(path);
}

export function buildWikiIndex(pages: WikiPage[]): WikiIndex {
  const sorted = [...pages].sort((a, b) => a.path.localeCompare(b.path));
  const infos = new Map<string, PageInfo>();
  const byName = new Map<string, string>();
  const byAlias = new Map<string, string>();
  const byTitle = new Map<string, string>();
  // The first page wins when two share a key, so results don't depend on load order.
  const claim = (map: Map<string, string>, key: string, path: string): void => {
    if (key && !map.has(key)) map.set(key, path);
  };

  for (const page of sorted) {
    const { data, body } = parseFrontmatter(page.text);
    const info: PageInfo = {
      path: page.path,
      title: titleOf(body, data, page.path),
      aliases: aliasesOf(data),
      frontmatter: data,
      links: extractLinks(body),
    };
    infos.set(page.path, info);
    claim(byName, linkKey(baseName(page.path)), page.path);
    for (const alias of info.aliases) claim(byAlias, linkKey(alias), page.path);
    claim(byTitle, linkKey(info.title), page.path);
  }

  const resolve = (target: string): string | null => {
    const key = linkKey(target);
    return byName.get(key) ?? byAlias.get(key) ?? byTitle.get(key) ?? null;
  };

  return {
    pages: [...infos.values()],
    get: (path) => infos.get(path),
    resolve,
    linksOut(path) {
      const seen = new Set<string>();
      const result: ResolvedLink[] = [];
      for (const link of infos.get(path)?.links ?? []) {
        const resolved = resolve(link.target);
        const key = resolved ?? `missing:${linkKey(link.target)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({ link, path: resolved });
      }
      return result;
    },
    backlinks(path) {
      return [...infos.values()]
        .filter((info) => info.path !== path && info.links.some((link) => resolve(link.target) === path))
        .map((info) => info.path);
    },
  };
}

// New pages created from a red link start from the folder's template (design.md, View 2).
const TEMPLATE_FOR_FOLDER: Record<string, string> = {
  characters: "character",
  places: "place",
  factions: "faction",
  "terms-and-rules": "term",
};

/** The template file for a wiki folder, if one exists. Falls back to the singular folder name. */
export function templateForFolder(folder: string, templates: string[]): string | null {
  const names = [TEMPLATE_FOR_FOLDER[folder], folder.replace(/s$/, "")].filter((name): name is string => !!name);
  for (const name of names) {
    const path = `wiki/_templates/${name}.md`;
    if (templates.includes(path)) return path;
  }
  return null;
}

/** "old-port" becomes "Old port", for the new page's heading. */
export function titleFromTarget(target: string): string {
  const words = target.trim().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** New page text: the template with its first heading replaced by the title, or just the heading. */
export function newPageContent(template: string | null, title: string): string {
  if (template === null) return `# ${title}\n`;
  // A replacer function, so a "$" in the title isn't read as a replacement pattern.
  if (/^#[ \t]+.*$/m.test(template)) return template.replace(/^#[ \t]+.*$/m, () => `# ${title}`);
  return `# ${title}\n\n${template}`;
}
