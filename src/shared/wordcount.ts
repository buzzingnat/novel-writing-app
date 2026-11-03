import { splitFrontmatter } from "./frontmatter.ts";

// The one word-count rule for chapters, totals, and the daily tracker (plan.md):
// drop frontmatter, split on whitespace and em/en dashes, and count pieces that
// contain at least one letter or digit. So "#", "---", "*", and a lone "—" don't
// count, "well-known" is one word, and "word—word" is two.
export function countWords(text: string): number {
  const { body } = splitFrontmatter(text);
  let count = 0;
  for (const piece of body.split(/[\s–—]+/u)) {
    if (/[\p{L}\p{N}]/u.test(piece)) count += 1;
  }
  return count;
}

/** "1,912" for the status line. */
export function formatCount(count: number): string {
  return count.toLocaleString("en-US");
}

/** "4.2k" for the chapter list; exact below 1,000. */
export function formatShortCount(count: number): string {
  if (Math.abs(count) < 1000) return String(count);
  const thousands = count / 1000;
  return `${thousands.toFixed(Math.abs(thousands) < 10 ? 1 : 0).replace(/\.0$/, "")}k`;
}
