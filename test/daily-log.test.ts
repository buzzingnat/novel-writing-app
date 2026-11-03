import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dailyCounts,
  formatDay,
  formatNet,
  localDateKey,
  parseWordLog,
  recordTotal,
  serializeWordLog,
  type WordLog,
} from "../src/shared/daily-log.ts";

describe("recordTotal", () => {
  it("first run: baselines at the current total, so existing text isn't counted", () => {
    const log = recordTotal({}, "2026-11-03", 30762);
    assert.deepEqual(log, { "2026-11-03": { start: 30762, end: 30762 } });
    assert.deepEqual(dailyCounts(log, "2026-11-03"), [{ date: "2026-11-03", net: 0 }]);
  });

  it("same day: keeps the day's start and moves the end with each save", () => {
    let log = recordTotal({}, "2026-11-03", 30762);
    log = recordTotal(log, "2026-11-03", 31000);
    log = recordTotal(log, "2026-11-03", 31402);
    assert.deepEqual(log["2026-11-03"], { start: 30762, end: 31402 });
    assert.equal(dailyCounts(log, "2026-11-03")[0]?.net, 640);
  });

  it("new day: starts from the last recorded end", () => {
    const log = recordTotal({ "2026-11-03": { start: 30762, end: 31402 } }, "2026-11-04", 31402);
    assert.deepEqual(log["2026-11-04"], { start: 31402, end: 31402 });
  });

  it("outside edits since the last record count on the day they're noticed", () => {
    // The app last saw 31,402 on Nov 3. Chapters were edited elsewhere; on Nov 5 the app loads and sees 31,900.
    const log = recordTotal({ "2026-11-03": { start: 30762, end: 31402 } }, "2026-11-05", 31900);
    assert.deepEqual(log["2026-11-05"], { start: 31402, end: 31900 });
    assert.equal(dailyCounts(log, "2026-11-05")[0]?.net, 498);
  });

  it("cutting text gives a lower or negative day", () => {
    let log = recordTotal({ "2026-11-03": { start: 30000, end: 31000 } }, "2026-11-04", 31000);
    log = recordTotal(log, "2026-11-04", 30500);
    assert.equal(dailyCounts(log, "2026-11-04")[0]?.net, -500);
  });

  it("uses the latest earlier day even if days were skipped, and doesn't mutate the input", () => {
    const original: WordLog = { "2026-10-30": { start: 0, end: 100 }, "2026-11-01": { start: 100, end: 250 } };
    const log = recordTotal(original, "2026-11-04", 300);
    assert.deepEqual(log["2026-11-04"], { start: 250, end: 300 });
    assert.equal(original["2026-11-04"], undefined);
  });
});

describe("dailyCounts", () => {
  it("lists days newest first and always includes today", () => {
    const log: WordLog = { "2026-11-01": { start: 0, end: 85 }, "2026-11-02": { start: 85, end: 1285 } };
    assert.deepEqual(dailyCounts(log, "2026-11-03"), [
      { date: "2026-11-03", net: 0 },
      { date: "2026-11-02", net: 1200 },
      { date: "2026-11-01", net: 85 },
    ]);
  });
});

describe("formatNet and formatDay", () => {
  it("formats signed day totals", () => {
    assert.equal(formatNet(640), "+640");
    assert.equal(formatNet(0), "+0");
    assert.equal(formatNet(-85), "−85");
    assert.equal(formatNet(1200), "+1.2k");
  });

  it("labels today, other days, and other years", () => {
    assert.equal(formatDay("2026-11-03", "2026-11-03"), "Today");
    assert.equal(formatDay("2026-11-02", "2026-11-03"), "Nov 2");
    assert.equal(formatDay("2025-12-31", "2026-01-01"), "Dec 31, 2025");
  });
});

describe("localDateKey", () => {
  it("uses the local calendar date, turning over at local midnight", () => {
    assert.equal(localDateKey(new Date(2026, 10, 3, 23, 59, 59)), "2026-11-03");
    assert.equal(localDateKey(new Date(2026, 10, 4, 0, 0, 0)), "2026-11-04");
    assert.equal(localDateKey(new Date(2027, 0, 9)), "2027-01-09");
  });
});

describe("parseWordLog and serializeWordLog", () => {
  it("round-trips a log, one day per line in date order", () => {
    const log: WordLog = { "2026-11-03": { start: 1, end: 5 }, "2026-11-02": { start: 0, end: 1 } };
    const text = serializeWordLog(log);
    assert.equal(text, '{\n  "2026-11-02": {"start":0,"end":1},\n  "2026-11-03": {"start":1,"end":5}\n}\n');
    assert.deepEqual(parseWordLog(text), log);
    assert.deepEqual(parseWordLog(serializeWordLog({})), {});
  });

  it("rejects corrupt or wrongly shaped files", () => {
    assert.equal(parseWordLog("{not json"), null);
    assert.equal(parseWordLog("[]"), null);
    assert.equal(parseWordLog('{"yesterday": {"start": 1, "end": 2}}'), null);
    assert.equal(parseWordLog('{"2026-11-03": {"start": "1", "end": 2}}'), null);
  });
});
