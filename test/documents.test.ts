import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import {
  createDocumentStore,
  docStatus,
  startAutosave,
  statusLabel,
  type SaveFile,
  type SaveResult,
} from "../src/client/documents.ts";

/** A fake disk: tracks each file's mtime and records every save call. */
function fakeDisk(initial: Record<string, number> = {}): {
  saveFile: SaveFile;
  calls: { path: string; content: string; expected: number | null }[];
  mtimes: Map<string, number>;
  next: { result: SaveResult | null };
} {
  const mtimes = new Map(Object.entries(initial));
  const calls: { path: string; content: string; expected: number | null }[] = [];
  const next: { result: SaveResult | null } = { result: null };
  let clock = 1000;
  const saveFile: SaveFile = async (path, content, expected) => {
    calls.push({ path, content, expected });
    if (next.result) {
      const result = next.result;
      next.result = null;
      return result;
    }
    const current = mtimes.get(path) ?? null;
    if (current !== expected) return { kind: "conflict", mtimeMs: current, message: "File changed on disk" };
    clock += 1;
    mtimes.set(path, clock);
    return { kind: "saved", mtimeMs: clock };
  };
  return { saveFile, calls, mtimes, next };
}

const time = (ms: number): string => `t${ms}`;

describe("document store: editing and saving", () => {
  it("is clean when opened, dirty after an edit, clean after a save", async () => {
    const disk = fakeDisk({ "a.md": 1 });
    const store = createDocumentStore(disk.saveFile, () => 42);
    const doc = store.open("a.md", "hello", 1);
    assert.equal(docStatus(doc), "clean");
    assert.equal(statusLabel(doc, time), "no changes");

    store.edit("a.md", "hello world");
    assert.equal(docStatus(doc), "dirty");
    assert.deepEqual(store.dirtyPaths(), ["a.md"]);

    assert.equal(await store.save("a.md"), "clean");
    assert.deepEqual(disk.calls, [{ path: "a.md", content: "hello world", expected: 1 }]);
    assert.equal(statusLabel(doc, time), "saved t42");
    assert.equal(doc.mtimeMs, disk.mtimes.get("a.md"));
  });

  it("does not call the server when there is nothing to save", async () => {
    const disk = fakeDisk({ "a.md": 1 });
    const store = createDocumentStore(disk.saveFile);
    store.open("a.md", "hello", 1);
    await store.save("a.md");
    assert.equal(disk.calls.length, 0);
  });

  it("an edit back to the saved text counts as clean", () => {
    const store = createDocumentStore(fakeDisk().saveFile);
    store.open("a.md", "same", 1);
    store.edit("a.md", "different");
    store.edit("a.md", "same");
    assert.equal(store.isDirty("a.md"), false);
  });

  it("keeps unsaved text when the same file is opened again", () => {
    const store = createDocumentStore(fakeDisk().saveFile);
    store.open("a.md", "disk v1", 1);
    store.edit("a.md", "my edits");
    const reopened = store.open("a.md", "disk v2", 2);
    assert.equal(reopened.text, "my edits");
    assert.equal(reopened.mtimeMs, 1);
  });

  it("text typed during a save stays unsaved", async () => {
    const disk = fakeDisk({ "a.md": 1 });
    const store = createDocumentStore(disk.saveFile);
    store.open("a.md", "one", 1);
    store.edit("a.md", "two");
    const saving = store.save("a.md");
    store.edit("a.md", "three");
    assert.equal(await saving, "dirty");
    assert.equal(store.get("a.md")?.savedText, "two");
  });

  it("runs one save at a time per file, then saves the newer text", async () => {
    const disk = fakeDisk({ "a.md": 1 });
    const store = createDocumentStore(disk.saveFile);
    store.open("a.md", "one", 1);
    store.edit("a.md", "two");
    const first = store.save("a.md");
    store.edit("a.md", "three");
    const second = store.save("a.md");
    await Promise.all([first, second]);
    assert.deepEqual(
      disk.calls.map((call) => call.content),
      ["two", "three"],
    );
    assert.equal(disk.calls[1]?.expected, 1001, "second save uses the mtime from the first");
    assert.equal(store.isDirty("a.md"), false);
  });

  it("discard throws away unsaved changes", () => {
    const store = createDocumentStore(fakeDisk().saveFile);
    store.open("a.md", "saved", 1);
    store.edit("a.md", "unsaved");
    store.discard("a.md");
    assert.equal(store.get("a.md")?.text, "saved");
    assert.equal(store.isDirty("a.md"), false);
  });

  it("notifies subscribers on changes", async () => {
    const store = createDocumentStore(fakeDisk({ "a.md": 1 }).saveFile);
    const seen: string[] = [];
    store.subscribe((path) => seen.push(path));
    store.open("a.md", "x", 1);
    store.edit("a.md", "y");
    await store.save("a.md");
    assert.ok(seen.length >= 4);
    assert.ok(seen.every((path) => path === "a.md"));
  });
});

describe("document store: conflicts and errors", () => {
  it("never overwrites a file that changed on disk", async () => {
    const disk = fakeDisk({ "a.md": 1 });
    const store = createDocumentStore(disk.saveFile);
    store.open("a.md", "mine", 1);
    store.edit("a.md", "mine, edited");
    disk.mtimes.set("a.md", 99);

    assert.equal(await store.save("a.md"), "conflict");
    assert.deepEqual(store.get("a.md")?.conflict, { mtimeMs: 99, message: "File changed on disk" });
    assert.equal(statusLabel(store.get("a.md"), time), "changed on disk");

    // A second Cmd+S while in conflict does nothing; the banner decides.
    await store.save("a.md");
    assert.equal(disk.calls.length, 1);
  });

  it("keep mine overwrites using the disk's current mtime", async () => {
    const disk = fakeDisk({ "a.md": 1 });
    const store = createDocumentStore(disk.saveFile);
    store.open("a.md", "mine", 1);
    store.edit("a.md", "mine, edited");
    disk.mtimes.set("a.md", 99);
    await store.save("a.md");

    assert.equal(await store.keepMine("a.md"), "clean");
    assert.equal(disk.calls[1]?.expected, 99);
    assert.equal(store.get("a.md")?.conflict, null);
  });

  it("keep mine recreates a file that was deleted on disk", async () => {
    const disk = fakeDisk({ "a.md": 1 });
    const store = createDocumentStore(disk.saveFile);
    store.open("a.md", "mine", 1);
    store.edit("a.md", "still mine");
    disk.mtimes.delete("a.md");
    assert.equal(await store.save("a.md"), "conflict");
    assert.equal(store.get("a.md")?.conflict?.mtimeMs, null);

    assert.equal(await store.keepMine("a.md"), "clean");
    assert.equal(disk.calls[1]?.expected, null);
  });

  it("reload replaces the text with the disk version and clears the conflict", async () => {
    const disk = fakeDisk({ "a.md": 1 });
    const store = createDocumentStore(disk.saveFile);
    store.open("a.md", "mine", 1);
    store.edit("a.md", "mine, edited");
    disk.mtimes.set("a.md", 99);
    await store.save("a.md");

    store.reload("a.md", "theirs", 99);
    const doc = store.get("a.md");
    assert.equal(doc?.text, "theirs");
    assert.equal(doc && docStatus(doc), "clean");
  });

  it("a failed save keeps the changes and can be retried", async () => {
    const disk = fakeDisk({ "a.md": 1 });
    const store = createDocumentStore(disk.saveFile);
    store.open("a.md", "x", 1);
    store.edit("a.md", "y");
    disk.next.result = { kind: "error", message: "Can't reach the app server" };

    assert.equal(await store.save("a.md"), "error");
    assert.equal(statusLabel(store.get("a.md"), time), "save failed: Can't reach the app server");
    assert.equal(store.isDirty("a.md"), true);

    assert.equal(await store.save("a.md"), "clean");
  });

  it("a save that throws is reported as an error, not a crash", async () => {
    const store = createDocumentStore(async () => {
      throw new Error("boom");
    });
    store.open("a.md", "x", 1);
    store.edit("a.md", "y");
    assert.equal(await store.save("a.md"), "error");
    assert.equal(store.get("a.md")?.error, "boom");
  });
});

describe("autosave", () => {
  it("saves every dirty file on each interval and skips files in conflict", async () => {
    mock.timers.enable({ apis: ["setInterval"] });
    try {
      const disk = fakeDisk({ "a.md": 1, "b.md": 1, "c.md": 1 });
      const store = createDocumentStore(disk.saveFile);
      store.open("a.md", "a", 1);
      store.open("b.md", "b", 1);
      store.open("c.md", "c", 1);
      store.edit("a.md", "a2");
      store.edit("c.md", "c2");
      disk.mtimes.set("c.md", 50);
      await store.save("c.md"); // c.md is now in conflict
      disk.calls.length = 0;

      const stop = startAutosave(store, 5 * 60 * 1000);
      mock.timers.tick(5 * 60 * 1000 - 1);
      await Promise.resolve();
      assert.equal(disk.calls.length, 0, "nothing saves before the interval");

      mock.timers.tick(1);
      await new Promise((resolve) => setImmediate(resolve));
      assert.deepEqual(
        disk.calls.map((call) => call.path),
        ["a.md"],
      );

      stop();
      store.edit("a.md", "a3");
      mock.timers.tick(10 * 60 * 1000);
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(disk.calls.length, 1, "stopped autosave does nothing");
    } finally {
      mock.timers.reset();
    }
  });
});
