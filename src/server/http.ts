import type { IncomingMessage, ServerResponse } from "node:http";

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

/** A chapter is well under this; the limit only stops runaway requests. */
const MAX_BODY_BYTES = 10 * 1024 * 1024;

export class BodyError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const type = req.headers["content-type"] ?? "";
  // Requiring JSON forces a CORS preflight for cross-site requests, which this server never approves.
  if (!type.toLowerCase().startsWith("application/json")) throw new BodyError(415, "Expected application/json");

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new BodyError(413, "Request body too large");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new BodyError(400, "Invalid JSON");
  }
}
