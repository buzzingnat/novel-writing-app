import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { handleApi } from "./api.ts";
import { sendJson } from "./http.ts";

export interface AppServerOptions {
  /** The novel2026 folder the app reads and writes. */
  root: string;
  /** Folder holding the built browser files (index.html, app.js, app.css). */
  clientDir: string;
}

const STATIC_FILES: Record<string, { file: string; type: string }> = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/app.js": { file: "app.js", type: "text/javascript; charset=utf-8" },
  "/app.js.map": { file: "app.js.map", type: "application/json; charset=utf-8" },
  "/app.css": { file: "app.css", type: "text/css; charset=utf-8" },
  "/app.css.map": { file: "app.css.map", type: "application/json; charset=utf-8" },
};

// Any website open in the browser can send requests to localhost. Checking the
// Host header blocks DNS-rebinding pages from reading or writing the novel files.
const ALLOWED_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);

export function isAllowedHost(hostHeader: string | undefined): boolean {
  if (!hostHeader) return false;
  const hostname = hostHeader.replace(/:\d+$/, "").toLowerCase();
  return ALLOWED_HOSTNAMES.has(hostname);
}

/** Browsers send Origin on cross-site writes; only our own page may write. */
export function isAllowedOrigin(originHeader: string | undefined): boolean {
  if (originHeader === undefined) return true;
  try {
    const origin = new URL(originHeader);
    return origin.protocol === "http:" && ALLOWED_HOSTNAMES.has(origin.hostname);
  } catch {
    return false;
  }
}

export function createAppServer(options: AppServerOptions): Server {
  return createServer((req, res) => {
    handleRequest(req, res, options).catch((error: unknown) => {
      console.error(error);
      if (!res.headersSent) sendJson(res, 500, { error: "Internal server error" });
      else res.end();
    });
  });
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: AppServerOptions,
): Promise<void> {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'self'");

  if (!isAllowedHost(req.headers.host)) {
    sendJson(res, 403, { error: "Forbidden host" });
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD" && !isAllowedOrigin(req.headers.origin)) {
    sendJson(res, 403, { error: "Forbidden origin" });
    return;
  }

  const url = new URL(req.url ?? "/", "http://localhost");

  if (url.pathname === "/api/health" && req.method === "GET") {
    sendJson(res, 200, { ok: true, root: options.root });
    return;
  }

  if (url.pathname.startsWith("/api/") && (await handleApi(req, res, url, options.root))) return;

  const staticFile = STATIC_FILES[url.pathname];
  if (staticFile && req.method === "GET") {
    const body = await readFile(path.join(options.clientDir, staticFile.file));
    res.writeHead(200, { "Content-Type": staticFile.type, "Cache-Control": "no-store" });
    res.end(body);
    return;
  }

  sendJson(res, 404, { error: "Not found" });
}
