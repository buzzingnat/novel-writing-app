import { randomBytes } from "node:crypto";
import { mkdir, open, readdir, readFile, realpath, rename, stat, unlink, writeFile } from "node:fs/promises";
import type { Stats } from "node:fs";
import path from "node:path";
import { chapterTitle, cleanChapterTitle, nextChapterFileName } from "../shared/chapters.ts";
import { isEditablePath, normalizeRelPath } from "../shared/paths.ts";
import { countWords } from "../shared/wordcount.ts";

/** An error the API turns into an HTTP status. mtimeMs is set on conflicts. */
export class FileApiError extends Error {
  readonly status: number;
  readonly mtimeMs: number | null;

  constructor(status: number, message: string, mtimeMs: number | null = null) {
    super(message);
    this.status = status;
    this.mtimeMs = mtimeMs;
  }
}

export interface FileContents {
  content: string;
  mtimeMs: number;
}

/**
 * Turns a relative path from the browser into a real absolute path inside the root.
 * Throws for anything outside the root, including through symlinks.
 */
export async function resolveSafe(root: string, relInput: string): Promise<{ rel: string; abs: string }> {
  const rel = normalizeRelPath(relInput);
  if (!rel) throw new FileApiError(400, "Invalid path");
  if (!isEditablePath(rel)) throw new FileApiError(403, "Only Markdown files in the novel folder can be opened");

  const realRoot = await realpath(root);
  const abs = await realpathOfDeepestExisting(path.join(realRoot, ...rel.split("/")));
  if (!abs.startsWith(realRoot + path.sep)) throw new FileApiError(403, "Path is outside the novel folder");
  return { rel, abs };
}

// A file being created doesn't exist yet, so resolve symlinks on its nearest existing parent.
async function realpathOfDeepestExisting(abs: string): Promise<string> {
  const missing: string[] = [];
  let current = abs;
  for (;;) {
    try {
      return path.join(await realpath(current), ...missing);
    } catch (error) {
      if (!isErrno(error, "ENOENT")) throw error;
      const parent = path.dirname(current);
      if (parent === current) throw error;
      missing.unshift(path.basename(current));
      current = parent;
    }
  }
}

export async function readTextFile(root: string, relInput: string): Promise<FileContents> {
  const { abs } = await resolveSafe(root, relInput);
  // Stat before reading: if the file changes in between, the older mtime makes the
  // next save report a conflict instead of silently overwriting.
  const info = await statOrNull(abs);
  if (!info?.isFile()) throw new FileApiError(404, "File not found");
  const content = await readFile(abs, "utf8");
  return { content, mtimeMs: info.mtimeMs };
}

/**
 * Saves a file only if it is unchanged since the browser loaded it.
 * expectedMtimeMs null means "create a new file" and fails if one already exists.
 */
export async function writeTextFile(
  root: string,
  relInput: string,
  content: string,
  expectedMtimeMs: number | null,
): Promise<{ mtimeMs: number }> {
  const { abs } = await resolveSafe(root, relInput);
  const current = await statOrNull(abs);
  if (current && !current.isFile()) throw new FileApiError(403, "Not a file");

  if (expectedMtimeMs === null) {
    if (current) throw new FileApiError(409, "File already exists", current.mtimeMs);
  } else if (!current) {
    throw new FileApiError(409, "File was deleted on disk");
  } else if (current.mtimeMs !== expectedMtimeMs) {
    throw new FileApiError(409, "File changed on disk", current.mtimeMs);
  }

  await atomicWrite(abs, content);
  return { mtimeMs: (await stat(abs)).mtimeMs };
}

// Write a temp file beside the target, then rename over it, so a crash mid-save
// leaves either the old file or the new one, never half a chapter.
export async function atomicWrite(abs: string, content: string): Promise<void> {
  const temp = path.join(path.dirname(abs), `.${path.basename(abs)}.${randomBytes(6).toString("hex")}.tmp`);
  let handle;
  try {
    handle = await open(temp, "wx");
  } catch (error) {
    if (isErrno(error, "ENOENT")) throw new FileApiError(404, "Folder does not exist");
    throw error;
  }
  try {
    await handle.writeFile(content, "utf8");
    await handle.sync();
    await handle.close();
    await rename(temp, abs);
  } catch (error) {
    await handle.close().catch(() => undefined);
    await unlink(temp).catch(() => undefined);
    throw error;
  }
}

const SKIPPED_FOLDERS = new Set(["node_modules"]);

/** Every editable Markdown file under the root, as sorted relative paths. Symlinked folders are not followed. */
export async function listMarkdownFiles(root: string): Promise<string[]> {
  const found: string[] = [];
  async function walk(dirAbs: string, dirRel: string): Promise<void> {
    const entries = await readdir(dirAbs, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") || SKIPPED_FOLDERS.has(entry.name)) continue;
      const rel = dirRel ? `${dirRel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (dirRel === "" && entry.name === "app") continue;
        await walk(path.join(dirAbs, entry.name), rel);
      } else if (entry.isFile() && isEditablePath(rel)) {
        found.push(rel);
      }
    }
  }
  await walk(await realpath(root), "");
  return found.sort((a, b) => a.localeCompare(b));
}

/** Every wiki page except templates, with its text, for building the link index in the browser. */
export async function readWikiPages(root: string): Promise<({ path: string } & FileContents)[]> {
  const paths = (await listMarkdownFiles(root)).filter(
    (rel) => rel.startsWith("wiki/") && !rel.startsWith("wiki/_templates/"),
  );
  return Promise.all(paths.map(async (path) => ({ path, ...(await readTextFile(root, path)) })));
}

export interface ChapterSummary {
  path: string;
  title: string;
  words: number;
}

/** Every chapter in manuscript/, in file-name order, with its title and word count. */
export async function listChapters(root: string): Promise<ChapterSummary[]> {
  const paths = (await listMarkdownFiles(root)).filter((rel) => /^manuscript\/[^/]+$/.test(rel));
  return Promise.all(
    paths.map(async (path) => {
      const { content } = await readTextFile(root, path);
      return { path, title: chapterTitle(content, path), words: countWords(content) };
    }),
  );
}

/** Creates the next numbered chapter (and manuscript/ on first use) with the title as its heading. */
export async function createChapter(root: string, title: string): Promise<{ path: string } & FileContents> {
  const clean = cleanChapterTitle(title);
  if (!clean) throw new FileApiError(400, "Chapter title must be 1 to 200 characters");

  const { abs: manuscriptDir } = await resolveSafeFolder(root, "manuscript");
  await mkdir(manuscriptDir, { recursive: true });
  const rel = `manuscript/${nextChapterFileName(await readdir(manuscriptDir), clean)}`;
  const { abs } = await resolveSafe(root, rel);
  const content = `# ${clean}\n\n`;
  try {
    await writeFile(abs, content, { flag: "wx" });
  } catch (error) {
    if (isErrno(error, "EEXIST")) throw new FileApiError(409, "A chapter with that file name already exists");
    throw error;
  }
  return { path: rel, content, mtimeMs: (await stat(abs)).mtimeMs };
}

async function resolveSafeFolder(root: string, rel: string): Promise<{ abs: string }> {
  const realRoot = await realpath(root);
  const abs = await realpathOfDeepestExisting(path.join(realRoot, rel));
  if (!abs.startsWith(realRoot + path.sep)) throw new FileApiError(403, "Path is outside the novel folder");
  return { abs };
}

async function statOrNull(abs: string): Promise<Stats | null> {
  try {
    return await stat(abs);
  } catch (error) {
    if (isErrno(error, "ENOENT")) return null;
    throw error;
  }
}

function isErrno(error: unknown, code: string): boolean {
  return error instanceof Error && (error as NodeJS.ErrnoException).code === code;
}
