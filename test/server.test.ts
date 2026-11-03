import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { createAppServer, isAllowedHost, isAllowedOrigin } from "../src/server/server.ts";
import { httpRequest, makeFixture, type Fixture } from "./helpers.ts";

describe("isAllowedHost", () => {
  it("accepts localhost and 127.0.0.1, with or without a port", () => {
    assert.equal(isAllowedHost("localhost"), true);
    assert.equal(isAllowedHost("localhost:4747"), true);
    assert.equal(isAllowedHost("127.0.0.1:4747"), true);
    assert.equal(isAllowedHost("LOCALHOST:4747"), true);
  });

  it("rejects other hosts and a missing header", () => {
    assert.equal(isAllowedHost(undefined), false);
    assert.equal(isAllowedHost("evil.example.com"), false);
    assert.equal(isAllowedHost("localhost.evil.example.com"), false);
    assert.equal(isAllowedHost("192.168.1.5:4747"), false);
  });
});

describe("isAllowedOrigin", () => {
  it("accepts our own page and requests with no Origin", () => {
    assert.equal(isAllowedOrigin(undefined), true);
    assert.equal(isAllowedOrigin("http://localhost:4747"), true);
    assert.equal(isAllowedOrigin("http://127.0.0.1:4747"), true);
  });

  it("rejects other sites", () => {
    assert.equal(isAllowedOrigin("https://evil.example.com"), false);
    assert.equal(isAllowedOrigin("http://localhost.evil.example.com"), false);
    assert.equal(isAllowedOrigin("null"), false);
  });
});

describe("app server", () => {
  let fixture: Fixture;
  let port: number;
  let app: ReturnType<typeof createAppServer>;

  before(async () => {
    fixture = await makeFixture({ "progress.md": "# Progress\n" });
    const clientDir = path.join(fixture.root, "..");
    await writeFile(path.join(clientDir, "index.html"), "<!doctype html><title>test</title>");
    app = createAppServer({ root: fixture.root, clientDir });
    await new Promise<void>((resolve) => app.listen(0, "127.0.0.1", resolve));
    port = (app.address() as AddressInfo).port;
  });

  after(async () => {
    await new Promise<void>((resolve) => app.close(() => resolve()));
    await fixture.cleanup();
  });

  it("serves the HTML shell at /", async () => {
    const res = await httpRequest(port, { path: "/" });
    assert.equal(res.status, 200);
    assert.match(res.type, /text\/html/);
    assert.match(res.body, /<title>test<\/title>/);
  });

  it("answers the health check", async () => {
    const res = await httpRequest(port, { path: "/api/health" });
    assert.equal(res.status, 200);
    assert.deepEqual(JSON.parse(res.body), { ok: true, root: fixture.root });
  });

  it("returns 404 for unknown paths", async () => {
    assert.equal((await httpRequest(port, { path: "/nope" })).status, 404);
    assert.equal((await httpRequest(port, { path: "/api/nope" })).status, 404);
  });

  it("refuses requests with a foreign Host header", async () => {
    const res = await httpRequest(port, { path: "/api/health", headers: { host: "evil.example.com" } });
    assert.equal(res.status, 403);
  });
});
