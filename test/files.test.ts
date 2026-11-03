import assert from "node:assert/strict";
import { mkdir, readdir, readFile, stat, symlink, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  createChapter,
  FileApiError,
  listMarkdownFiles,
  readTextFile,
  resolveSafe,
  writeTextFile,
} from "../src/server/files.ts";
import { makeFixture, type Fixture } from "./helpers.ts";

let fixture: Fixture;
beforeEach(async () => {
  fixture = await makeFixture();
});
afterEach(async () => {
  await fixture.cleanup();
});

function rejectsWith(status: number): (error: unknown) => boolean {
  return (error) => error instanceof FileApiError && error.status === status;
}

describe("resolveSafe", () => {
  it("resolves normal paths inside the root", async () => {
    const { rel, abs } = await resolveSafe(fixture.root, "planning//threads.md");
    assert.equal(rel, "planning/threads.md");
    assert.equal(abs, path.join(fixture.root, "planning", "threads.md"));
  });

  it("rejects traversal, absolute paths, non-Markdown, hidden, and app/ paths", async () => {
    await assert.rejects(resolveSafe(fixture.root, "../outside.md"), rejectsWith(400));
    await assert.rejects(resolveSafe(fixture.root, "/etc/hosts.md"), rejectsWith(400));
    await assert.rejects(resolveSafe(fixture.root, "planning/notes.txt"), rejectsWith(403));
    await assert.rejects(resolveSafe(fixture.root, ".hidden/secret.md"), rejectsWith(403));
    await assert.rejects(resolveSafe(fixture.root, "app/plan.md"), rejectsWith(403));
  });

  it("rejects a symlinked file that points outside the root", async () => {
    const outside = path.join(fixture.root, "..", "outside.md");
    await writeFile(outside, "secret");
    await symlink(outside, path.join(fixture.root, "planning", "sneaky.md"));
    await assert.rejects(resolveSafe(fixture.root, "planning/sneaky.md"), rejectsWith(403));
  });

  it("rejects a new file inside a symlinked folder that points outside the root", async () => {
    const outsideDir = path.join(fixture.root, "..", "outside-dir");
    await mkdir(outsideDir);
    await symlink(outsideDir, path.join(fixture.root, "wiki", "linked"));
    await assert.rejects(resolveSafe(fixture.root, "wiki/linked/new.md"), rejectsWith(403));
  });
});

describe("readTextFile", () => {
  it("returns content and mtime", async () => {
    const file = await readTextFile(fixture.root, "planning/threads.md");
    assert.equal(file.content, "# Threads\n");
    assert.equal(file.mtimeMs, (await stat(path.join(fixture.root, "planning/threads.md"))).mtimeMs);
  });

  it("returns 404 for a missing file or a folder named like one", async () => {
    await assert.rejects(readTextFile(fixture.root, "planning/missing.md"), rejectsWith(404));
    await mkdir(path.join(fixture.root, "folder.md"));
    await assert.rejects(readTextFile(fixture.root, "folder.md"), rejectsWith(404));
  });
});

describe("writeTextFile", () => {
  const rel = "planning/threads.md";

  it("saves when the file is unchanged since it was read, and returns the new mtime", async () => {
    const { mtimeMs } = await readTextFile(fixture.root, rel);
    const result = await writeTextFile(fixture.root, rel, "# Threads v2\n", mtimeMs);
    assert.equal(await readFile(path.join(fixture.root, rel), "utf8"), "# Threads v2\n");
    assert.equal(result.mtimeMs, (await stat(path.join(fixture.root, rel))).mtimeMs);
  });

  it("refuses with 409 and the current mtime if the file changed on disk", async () => {
    const { mtimeMs } = await readTextFile(fixture.root, rel);
    const abs = path.join(fixture.root, rel);
    await writeFile(abs, "edited elsewhere");
    await utimes(abs, new Date(), new Date(mtimeMs + 5000));
    const current = (await stat(abs)).mtimeMs;

    await assert.rejects(writeTextFile(fixture.root, rel, "mine", mtimeMs), (error: unknown) => {
      return error instanceof FileApiError && error.status === 409 && error.mtimeMs === current;
    });
    assert.equal(await readFile(abs, "utf8"), "edited elsewhere");
  });

  it("refuses with 409 if the file was deleted on disk", async () => {
    await assert.rejects(writeTextFile(fixture.root, "planning/gone.md", "x", 12345), rejectsWith(409));
  });

  it("creates a new file when expectedMtimeMs is null, but never overwrites one", async () => {
    await writeTextFile(fixture.root, "wiki/places/new-town.md", "# New town\n", null);
    assert.equal(await readFile(path.join(fixture.root, "wiki/places/new-town.md"), "utf8"), "# New town\n");
    await assert.rejects(writeTextFile(fixture.root, rel, "clobber", null), rejectsWith(409));
    assert.equal(await readFile(path.join(fixture.root, rel), "utf8"), "# Threads\n");
  });

  it("returns 404 when the folder does not exist", async () => {
    await assert.rejects(writeTextFile(fixture.root, "nowhere/new.md", "x", null), rejectsWith(404));
  });

  it("leaves no temp files behind", async () => {
    const { mtimeMs } = await readTextFile(fixture.root, rel);
    await writeTextFile(fixture.root, rel, "saved", mtimeMs);
    const leftovers = (await readdir(path.join(fixture.root, "planning"))).filter((name) => name.endsWith(".tmp"));
    assert.deepEqual(leftovers, []);
  });
});

describe("listMarkdownFiles", () => {
  it("lists Markdown files and skips app/, hidden folders, non-Markdown, and symlinked folders", async () => {
    const outsideDir = path.join(fixture.root, "..", "outside-dir");
    await mkdir(outsideDir);
    await writeFile(path.join(outsideDir, "leak.md"), "x");
    await symlink(outsideDir, path.join(fixture.root, "wiki", "linked"));
    await mkdir(path.join(fixture.root, "node_modules"));
    await writeFile(path.join(fixture.root, "node_modules", "README.md"), "x");

    const files = await listMarkdownFiles(fixture.root);
    assert.ok(files.includes("progress.md"));
    assert.ok(files.includes("wiki/_templates/character.md"));
    assert.equal(files.some((rel) => rel.startsWith("app/")), false);
    assert.equal(files.some((rel) => rel.includes(".hidden")), false);
    assert.equal(files.some((rel) => rel.endsWith(".txt")), false);
    assert.equal(files.some((rel) => rel.includes("leak")), false);
    assert.equal(files.some((rel) => rel.includes("node_modules")), false);
  });
});

describe("createChapter", () => {
  it("creates manuscript/ on first use and numbers chapters in order", async () => {
    const first = await createChapter(fixture.root, "Arrival");
    assert.equal(first.path, "manuscript/01-arrival.md");
    assert.equal(first.content, "# Arrival\n\n");

    const second = await createChapter(fixture.root, "The Glass Road");
    assert.equal(second.path, "manuscript/02-the-glass-road.md");
    assert.equal(await readFile(path.join(fixture.root, second.path), "utf8"), "# The Glass Road\n\n");
  });

  it("rejects an empty title", async () => {
    await assert.rejects(createChapter(fixture.root, "   "), rejectsWith(400));
  });
});
