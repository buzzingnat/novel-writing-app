import type { Tree } from "../shared/tree.ts";
import type { SaveResult } from "./documents.ts";

export interface FileContents {
  content: string;
  mtimeMs: number;
}

const SERVER_DOWN = "Can't reach the app server. Is it still running?";

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch {
    throw new Error(SERVER_DOWN);
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

export function fetchTree(): Promise<Tree> {
  return requestJson<Tree>("/api/tree");
}

export function fetchWikiPages(): Promise<({ path: string } & FileContents)[]> {
  return requestJson<({ path: string } & FileContents)[]>("/api/wiki-pages");
}

export interface ChapterSummary {
  path: string;
  title: string;
  words: number;
}

export function fetchChapters(): Promise<ChapterSummary[]> {
  return requestJson<ChapterSummary[]>("/api/chapters");
}

export function createChapter(title: string): Promise<{ path: string } & FileContents> {
  return requestJson<{ path: string } & FileContents>("/api/chapter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
}

export interface WordLogSummary {
  today: string;
  /** Net words per day, newest first; today is always first. */
  days: { date: string; net: number }[];
}

/** Asks the server to recount the manuscript and returns the daily totals. */
export function fetchWordLog(): Promise<WordLogSummary> {
  return requestJson<WordLogSummary>("/api/word-log");
}

export function fetchFile(path: string): Promise<FileContents> {
  return requestJson<FileContents>(`/api/file?path=${encodeURIComponent(path)}`);
}

export async function saveFile(path: string, content: string, expectedMtimeMs: number | null): Promise<SaveResult> {
  let res: Response;
  try {
    res = await fetch("/api/file", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, content, expectedMtimeMs }),
    });
  } catch {
    return { kind: "error", message: SERVER_DOWN };
  }
  const body = (await res.json().catch(() => ({}))) as { mtimeMs?: number | null; error?: string };
  if (res.ok && typeof body.mtimeMs === "number") return { kind: "saved", mtimeMs: body.mtimeMs };
  if (res.status === 409) {
    return { kind: "conflict", mtimeMs: body.mtimeMs ?? null, message: body.error ?? "File changed on disk" };
  }
  return { kind: "error", message: body.error ?? `Save failed (${res.status})` };
}
