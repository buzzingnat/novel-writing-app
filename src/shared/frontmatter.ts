import { parse } from "yaml";

/** Splits a leading YAML frontmatter block ("---" ... "---") from the Markdown body. */
export function splitFrontmatter(text: string): { frontmatter: string | null; body: string } {
  const match = /^---\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/.exec(text);
  if (!match) return { frontmatter: null, body: text };
  return { frontmatter: match[1] ?? "", body: text.slice(match[0].length) };
}

export interface ParsedFrontmatter {
  data: Record<string, unknown>;
  body: string;
  /** Set when the YAML block exists but can't be parsed; data is then empty. */
  error: string | null;
}

export function parseFrontmatter(text: string): ParsedFrontmatter {
  const { frontmatter, body } = splitFrontmatter(text);
  if (frontmatter === null) return { data: {}, body, error: null };
  try {
    const value: unknown = parse(frontmatter);
    const data = typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
    return { data, body, error: null };
  } catch (error) {
    return { data: {}, body, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Frontmatter `aliases` as a list of strings, whether written as a list or a single value. */
export function aliasesOf(data: Record<string, unknown>): string[] {
  const raw = data.aliases;
  const list = Array.isArray(raw) ? raw : raw === undefined || raw === null ? [] : [raw];
  return list.filter((item): item is string | number => typeof item === "string" || typeof item === "number").map(String);
}
