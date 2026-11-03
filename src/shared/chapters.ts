// Chapter files are manuscript/NN-title-slug.md (design.md, View 3).

/** Turns a chapter title into a file-name-safe slug: "The Glass Road!" becomes "the-glass-road". */
export function slugify(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return slug || "untitled";
}

/** Next chapter file name after the highest existing number, e.g. "04-the-glass-road.md". */
export function nextChapterFileName(existingNames: string[], title: string): string {
  let highest = 0;
  for (const name of existingNames) {
    const match = /^(\d+)-/.exec(name);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return `${String(highest + 1).padStart(2, "0")}-${slugify(title)}.md`;
}

/** A chapter's display title: its first "# " heading, else its file name without the number. */
export function chapterTitle(text: string, path: string): string {
  const heading = /^#[ \t]+(.+?)[ \t#]*$/m.exec(text);
  if (heading?.[1]) return heading[1];
  const name = path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/i, "").replace(/^\d+-?/, "");
  const words = name.replace(/[-_]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Untitled";
}

/** The chapter number from its file name ("03-the-road.md" is 3), or null if it has none. */
export function chapterNumber(path: string): number | null {
  const match = /^(\d+)/.exec(path.slice(path.lastIndexOf("/") + 1));
  return match ? Number(match[1]) : null;
}

/** Collapses whitespace and trims; returns null when the title is empty or too long. */
export function cleanChapterTitle(title: string): string | null {
  const clean = title.replace(/\s+/g, " ").trim();
  return clean.length > 0 && clean.length <= 200 ? clean : null;
}
