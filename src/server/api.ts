import type { IncomingMessage, ServerResponse } from "node:http";
import { buildTree } from "../shared/tree.ts";
import {
  createChapter,
  FileApiError,
  listChapters,
  listMarkdownFiles,
  readTextFile,
  readWikiPages,
  writeTextFile,
} from "./files.ts";
import { BodyError, readJsonBody, sendJson } from "./http.ts";
import { isChapterPath, refreshWordLog } from "./word-log.ts";

/**
 * Handles /api/* routes. Returns false when no route matches.
 *
 *   GET  /api/tree               sidebar groups for all three views
 *   GET  /api/wiki-pages         [{ path, content, mtimeMs }] for every wiki page except templates
 *   GET  /api/file?path=…        { content, mtimeMs }
 *   PUT  /api/file               { path, content, expectedMtimeMs } -> { mtimeMs }, 409 on conflict
 *   GET  /api/chapters           [{ path, title, words }] in file-name order
 *   POST /api/chapter            { title } -> { path, content, mtimeMs }
 *   GET  /api/word-log           recounts, records today's total -> { today, days: [{ date, net }] }
 *
 * Saving or creating a chapter also updates the daily word log.
 */
export async function handleApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  root: string,
): Promise<boolean> {
  try {
    if (url.pathname === "/api/tree" && req.method === "GET") {
      sendJson(res, 200, buildTree(await listMarkdownFiles(root)));
      return true;
    }

    if (url.pathname === "/api/wiki-pages" && req.method === "GET") {
      sendJson(res, 200, await readWikiPages(root));
      return true;
    }

    if (url.pathname === "/api/file" && req.method === "GET") {
      sendJson(res, 200, await readTextFile(root, url.searchParams.get("path") ?? ""));
      return true;
    }

    if (url.pathname === "/api/file" && req.method === "PUT") {
      const body = await readJsonBody(req);
      if (!isSaveRequest(body)) throw new BodyError(400, "Expected { path, content, expectedMtimeMs }");
      const saved = await writeTextFile(root, body.path, body.content, body.expectedMtimeMs);
      if (isChapterPath(body.path)) await refreshAfterChapterChange(root);
      sendJson(res, 200, saved);
      return true;
    }

    if (url.pathname === "/api/chapters" && req.method === "GET") {
      sendJson(res, 200, await listChapters(root));
      return true;
    }

    if (url.pathname === "/api/chapter" && req.method === "POST") {
      const body = await readJsonBody(req);
      if (!isRecord(body) || typeof body.title !== "string") throw new BodyError(400, "Expected { title }");
      const created = await createChapter(root, body.title);
      await refreshAfterChapterChange(root);
      sendJson(res, 201, created);
      return true;
    }

    if (url.pathname === "/api/word-log" && req.method === "GET") {
      sendJson(res, 200, await refreshWordLog(root));
      return true;
    }
  } catch (error) {
    if (error instanceof FileApiError) {
      sendJson(res, error.status, { error: error.message, mtimeMs: error.mtimeMs });
      return true;
    }
    if (error instanceof BodyError) {
      sendJson(res, error.status, { error: error.message });
      return true;
    }
    throw error;
  }
  return false;
}

// The chapter is already saved; a tracker problem must not turn that into a failed save.
async function refreshAfterChapterChange(root: string): Promise<void> {
  try {
    await refreshWordLog(root);
  } catch (error) {
    console.error("Couldn't update the daily word log:", error);
  }
}

interface SaveRequest {
  path: string;
  content: string;
  expectedMtimeMs: number | null;
}

function isSaveRequest(body: unknown): body is SaveRequest {
  return (
    isRecord(body) &&
    typeof body.path === "string" &&
    typeof body.content === "string" &&
    (body.expectedMtimeMs === null || (typeof body.expectedMtimeMs === "number" && Number.isFinite(body.expectedMtimeMs)))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
