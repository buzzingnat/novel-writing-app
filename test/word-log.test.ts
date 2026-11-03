import assert from "node:assert/strict";
import { readdir, readFile, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createAppServer } from "../src/server/server.ts";
import { isChapterPath, refreshWordLog } from "../src/server/word-log.ts";
import { httpRequest, makeFixture, type Fixture } from "./helpers.ts";

let fixture: Fixture;
beforeEach(async () => {
  fixture = await makeFixture({
    "progress.md": "# Progress\n",
    "manuscript/01-arrival.md": "# Arrival\n\nOne two three four.\n", // 5 words
    "manuscript/02-road.md": "# Road\n\nFive six.\n", // 3 words
  });
});
afterEach(async () => {
  await fixture.cleanup();
});

const logPath = (): string => path.join(fixture.root, "manuscript", ".word-log.json");
const readLog = async (): Promise<unknown> => JSON.parse(await readFile(logPath(), "utf8"));
const at = (day: number, hour = 12): (() => Date) => () => new Date(2026, 10, day, hour);

describe("isChapterPath", () => {
  it("matches chapter files only", () => {
    assert.equal(isChapterPath("manuscript/01-arrival.md"), true);
    assert.equal(isChapterPath("manuscript//01-arrival.md"), true);
    assert.equal(isChapterPath("manuscript/drafts/x.md"), false);
    assert.equal(isChapterPath("wiki/timeline.md"), false);
    assert.equal(isChapterPath("manuscript/.word-log.json"), false);
  });
});

describe("refreshWordLog", () => {
  it("first run baselines at the current total and writes the log", async () => {
    const result = await refreshWordLog(fixture.root, at(3));
    assert.deepEqual(result, { today: "2026-11-03", days: [{ date: "2026-11-03", net: 0 }] });
    assert.deepEqual(await readLog(), { "2026-11-03": { start: 8, end: 8 } });
  });

  it("counts writing on the same day and carries the total into the next day", async () => {
    await refreshWordLog(fixture.root, at(3, 9));
    await writeFile(path.join(fixture.root, "manuscript/02-road.md"), "# Road\n\nFive six seven eight.\n");
    const sameDay = await refreshWordLog(fixture.root, at(3, 22));
    assert.equal(sameDay.days[0]?.net, 2);

    const nextDay = await refreshWordLog(fixture.root, at(4, 8));
    assert.deepEqual(nextDay.days, [
      { date: "2026-11-04", net: 0 },
      { date: "2026-11-03", net: 2 },
    ]);
  });

  it("counts edits made outside the app on the day they're noticed", async () => {
    await refreshWordLog(fixture.root, at(3));
    // Edited in another editor while the app wasn't running; the app is next opened on Nov 6.
    await writeFile(path.join(fixture.root, "manuscript/03-new.md"), "# New\n\nA b c d e f g h i.\n");
    const result = await refreshWordLog(fixture.root, at(6));
    assert.equal(result.days[0]?.date, "2026-11-06");
    assert.equal(result.days[0]?.net, 10);
  });

  it("sets an unreadable log aside instead of overwriting it", async () => {
    await writeFile(logPath(), "{ this is not json");
    const result = await refreshWordLog(fixture.root, at(3));
    assert.equal(result.days[0]?.net, 0);
    const names = await readdir(path.join(fixture.root, "manuscript"));
    const aside = names.find((name) => name.startsWith(".word-log.unreadable-"));
    assert.ok(aside, "the bad log is kept under another name");
    assert.equal(await readFile(path.join(fixture.root, "manuscript", aside), "utf8"), "{ this is not json");
    assert.equal(await readFile(path.join(fixture.root, "manuscript/01-arrival.md"), "utf8"), "# Arrival\n\nOne two three four.\n");
  });

  it("does nothing on disk when there is no manuscript folder yet", async () => {
    const empty = await makeFixture({ "progress.md": "# Progress\n" });
    try {
      const result = await refreshWordLog(empty.root, at(3));
      assert.deepEqual(result.days, [{ date: "2026-11-03", net: 0 }]);
      assert.deepEqual(await readdir(empty.root), ["progress.md"]);
    } finally {
      await empty.cleanup();
    }
  });

  it("keeps every update when several run at once", async () => {
    await refreshWordLog(fixture.root, at(3));
    await writeFile(path.join(fixture.root, "manuscript/02-road.md"), "# Road\n\nFive six seven.\n");
    await Promise.all([refreshWordLog(fixture.root, at(3)), refreshWordLog(fixture.root, at(3))]);
    assert.deepEqual(await readLog(), { "2026-11-03": { start: 8, end: 9 } });
  });
});

describe("word log over HTTP", () => {
  it("updates on GET /api/word-log and on chapter saves", async () => {
    const app = createAppServer({ root: fixture.root, clientDir: fixture.root });
    await new Promise<void>((resolve) => app.listen(0, "127.0.0.1", resolve));
    const port = (app.address() as AddressInfo).port;
    try {
      const first = JSON.parse((await httpRequest(port, { path: "/api/word-log" })).body) as {
        days: { net: number }[];
      };
      assert.equal(first.days[0]?.net, 0);

      const read = JSON.parse((await httpRequest(port, { path: "/api/file?path=manuscript%2F02-road.md" })).body) as {
        mtimeMs: number;
      };
      const save = await httpRequest(port, {
        method: "PUT",
        path: "/api/file",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: "manuscript/02-road.md", content: "# Road\n\nFive six and more words.\n", expectedMtimeMs: read.mtimeMs }),
      });
      assert.equal(save.status, 200);
      const log = (await readLog()) as Record<string, { start: number; end: number }>;
      const today = Object.values(log)[0];
      assert.equal(today && today.end - today.start, 3);
    } finally {
      await new Promise<void>((resolve) => app.close(() => resolve()));
    }
  });
});
