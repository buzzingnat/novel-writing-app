import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { createAppServer } from "../src/server/server.ts";
import type { Tree } from "../src/shared/tree.ts";
import { httpRequest, makeFixture, type Fixture } from "./helpers.ts";

describe("file API over HTTP", () => {
  let fixture: Fixture;
  let port: number;
  let app: ReturnType<typeof createAppServer>;

  before(async () => {
    fixture = await makeFixture();
    app = createAppServer({ root: fixture.root, clientDir: fixture.root });
    await new Promise<void>((resolve) => app.listen(0, "127.0.0.1", resolve));
    port = (app.address() as AddressInfo).port;
  });

  after(async () => {
    await new Promise<void>((resolve) => app.close(() => resolve()));
    await fixture.cleanup();
  });

  const json = { "content-type": "application/json" };

  it("GET /api/tree returns grouped files", async () => {
    const res = await httpRequest(port, { path: "/api/tree" });
    assert.equal(res.status, 200);
    const tree = JSON.parse(res.body) as Tree;
    assert.equal(tree.planning.progress, "progress.md");
    assert.deepEqual(tree.wiki.pinned, ["wiki/timeline.md", "wiki/open-questions.md"]);
  });

  it("GET /api/wiki-pages returns wiki pages with text, without templates", async () => {
    const res = await httpRequest(port, { path: "/api/wiki-pages" });
    assert.equal(res.status, 200);
    const pages = JSON.parse(res.body) as { path: string; content: string }[];
    const paths = pages.map((page) => page.path);
    assert.ok(paths.includes("wiki/places/the-capital.md"));
    assert.ok(paths.includes("wiki/timeline.md"));
    assert.equal(paths.some((path) => path.includes("_templates")), false);
    assert.equal(paths.some((path) => !path.startsWith("wiki/")), false);
    assert.equal(pages.find((page) => page.path === "wiki/places/the-capital.md")?.content, "# The capital\n");
  });

  it("GET /api/file returns content, and rejects traversal", async () => {
    const ok = await httpRequest(port, { path: "/api/file?path=planning%2Fthreads.md" });
    assert.equal(ok.status, 200);
    assert.equal((JSON.parse(ok.body) as { content: string }).content, "# Threads\n");

    const bad = await httpRequest(port, { path: "/api/file?path=..%2F..%2Fetc%2Fpasswd" });
    assert.equal(bad.status, 400);
  });

  it("PUT /api/file saves, then refuses a stale save with 409", async () => {
    const read = JSON.parse((await httpRequest(port, { path: "/api/file?path=progress.md" })).body) as {
      mtimeMs: number;
    };
    const save = (content: string, expectedMtimeMs: number): ReturnType<typeof httpRequest> =>
      httpRequest(port, {
        method: "PUT",
        path: "/api/file",
        headers: json,
        body: JSON.stringify({ path: "progress.md", content, expectedMtimeMs }),
      });

    const first = await save("# Progress v2\n", read.mtimeMs);
    assert.equal(first.status, 200);
    assert.equal(await readFile(path.join(fixture.root, "progress.md"), "utf8"), "# Progress v2\n");

    const stale = await save("# stale\n", read.mtimeMs - 10_000);
    assert.equal(stale.status, 409);
    assert.equal(await readFile(path.join(fixture.root, "progress.md"), "utf8"), "# Progress v2\n");
  });

  it("PUT /api/file rejects bad bodies, non-JSON, and foreign origins", async () => {
    const badBody = await httpRequest(port, { method: "PUT", path: "/api/file", headers: json, body: "{}" });
    assert.equal(badBody.status, 400);

    const notJson = await httpRequest(port, {
      method: "PUT",
      path: "/api/file",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify({ path: "progress.md", content: "x", expectedMtimeMs: null }),
    });
    assert.equal(notJson.status, 415);

    const foreign = await httpRequest(port, {
      method: "PUT",
      path: "/api/file",
      headers: { ...json, origin: "https://evil.example.com" },
      body: JSON.stringify({ path: "progress.md", content: "x", expectedMtimeMs: null }),
    });
    assert.equal(foreign.status, 403);
  });

  it("POST /api/chapter creates the first chapter", async () => {
    const res = await httpRequest(port, {
      method: "POST",
      path: "/api/chapter",
      headers: json,
      body: JSON.stringify({ title: "Arrival" }),
    });
    assert.equal(res.status, 201);
    assert.equal((JSON.parse(res.body) as { path: string }).path, "manuscript/01-arrival.md");
  });

  it("GET /api/chapters lists chapters with titles and word counts", async () => {
    const res = await httpRequest(port, { path: "/api/chapters" });
    assert.equal(res.status, 200);
    assert.deepEqual(JSON.parse(res.body), [{ path: "manuscript/01-arrival.md", title: "Arrival", words: 1 }]);
  });
});
