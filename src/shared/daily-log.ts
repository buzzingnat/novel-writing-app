// The daily word-count tracker's rules (design.md, View 3, "Daily word count tracker"):
// - One entry per local calendar day: { start, end } manuscript totals.
// - A new day's start is the last recorded end, so edits made outside the app
//   count on the day the app notices them (at load or the next save).
// - The very first entry starts at the total seen then, so existing text isn't "written today".
// - A day's number is net: end - start (cutting text lowers it).
import { formatShortCount } from "./wordcount.ts";

export interface DayEntry {
  start: number;
  end: number;
}

/** Keys are local dates, "YYYY-MM-DD". */
export type WordLog = Record<string, DayEntry>;

export interface DailyCount {
  date: string;
  net: number;
}

/** The local calendar date as "YYYY-MM-DD" (the day turns over at local midnight). */
export function localDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Reads the log file's text. Returns null if it isn't a valid log, so the caller can
 * set the bad file aside instead of overwriting it.
 */
export function parseWordLog(text: string): WordLog | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const log: WordLog = {};
  for (const [date, entry] of Object.entries(value)) {
    if (!DATE_KEY.test(date) || typeof entry !== "object" || entry === null) return null;
    const { start, end } = entry as Record<string, unknown>;
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    log[date] = { start: start as number, end: end as number };
  }
  return log;
}

/** Records the current manuscript total for today. Returns a new log; the input is unchanged. */
export function recordTotal(log: WordLog, today: string, total: number): WordLog {
  const existing = log[today];
  if (existing) return { ...log, [today]: { start: existing.start, end: total } };
  const earlier = Object.keys(log)
    .filter((date) => date < today)
    .sort();
  const previous = earlier.length > 0 ? log[earlier[earlier.length - 1] as string] : undefined;
  return { ...log, [today]: { start: previous ? previous.end : total, end: total } };
}

/** Net words per day, newest first. Today is always included (as +0 if the log has no entry yet). */
export function dailyCounts(log: WordLog, today: string): DailyCount[] {
  const counts = Object.entries(log).map(([date, entry]) => ({ date, net: entry.end - entry.start }));
  if (!log[today]) counts.push({ date: today, net: 0 });
  return counts.sort((a, b) => b.date.localeCompare(a.date));
}

/** "+640", "−85", "+1.2k" */
export function formatNet(net: number): string {
  return net < 0 ? `−${formatShortCount(-net)}` : `+${formatShortCount(net)}`;
}

/** "Today", "Nov 2", or "Nov 2, 2025" for another year. */
export function formatDay(date: string, today: string): string {
  if (date === today) return "Today";
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  const sameYear = date.slice(0, 4) === today.slice(0, 4);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** Writes the log with dates in order, one day per line, so the file is easy to read. */
export function serializeWordLog(log: WordLog): string {
  const lines = Object.keys(log)
    .sort()
    .map((date) => `  ${JSON.stringify(date)}: ${JSON.stringify(log[date])}`);
  return lines.length === 0 ? "{}\n" : `{\n${lines.join(",\n")}\n}\n`;
}
