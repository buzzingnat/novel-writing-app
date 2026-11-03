import { readFile, realpath, rename, stat } from "node:fs/promises";
import path from "node:path";
import {
  dailyCounts,
  localDateKey,
  parseWordLog,
  recordTotal,
  serializeWordLog,
  type DailyCount,
  type WordLog,
} from "../shared/daily-log.ts";
import { normalizeRelPath } from "../shared/paths.ts";
import { atomicWrite, FileApiError, listChapters } from "./files.ts";

const LOG_NAME = ".word-log.json";

export interface WordLogResponse {
  today: string;
  days: DailyCount[];
}

/** True for a chapter file, the saves that update the daily tracker. */
export function isChapterPath(relInput: string): boolean {
  const rel = normalizeRelPath(relInput);
  return rel !== null && /^manuscript\/[^/.][^/]*\.md$/i.test(rel);
}

// Saves can arrive together; one refresh at a time keeps read-modify-write of the log safe.
let queue: Promise<unknown> = Promise.resolve();

/**
 * Recounts the whole manuscript and records the total for today in manuscript/.word-log.json.
 * Called when the server starts, when the app loads, and after every chapter save.
 */
export function refreshWordLog(root: string, now: () => Date = () => new Date()): Promise<WordLogResponse> {
  const run = queue.then(() => refresh(root, now()));
  queue = run.catch(() => undefined);
  return run;
}

async function refresh(root: string, now: Date): Promise<WordLogResponse> {
  const today = localDateKey(now);
  const realRoot = await realpath(root);
  const dir = await realpath(path.join(realRoot, "manuscript")).catch(() => null);
  // No manuscript folder yet: nothing to track, and don't create the folder just for the log.
  if (dir === null || !(await stat(dir)).isDirectory()) return { today, days: dailyCounts({}, today) };
  if (!dir.startsWith(realRoot + path.sep)) throw new FileApiError(403, "manuscript/ is outside the novel folder");

  const chapters = await listChapters(root);
  const total = chapters.reduce((sum, chapter) => sum + chapter.words, 0);

  const logPath = path.join(dir, LOG_NAME);
  const existingText = await readFile(logPath, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });

  let log: WordLog = {};
  if (existingText !== null) {
    const parsed = parseWordLog(existingText);
    if (parsed) {
      log = parsed;
    } else {
      // Never overwrite a log we can't read: set it aside so its history can be recovered by hand.
      const aside = path.join(dir, `.word-log.unreadable-${now.getTime()}.json`);
      await rename(logPath, aside);
      console.warn(`The daily word log couldn't be read, so it was moved to ${aside} and a new one started.`);
    }
  }

  const next = recordTotal(log, today, total);
  const nextText = serializeWordLog(next);
  if (nextText !== existingText) await atomicWrite(logPath, nextText);
  return { today, days: dailyCounts(next, today) };
}
