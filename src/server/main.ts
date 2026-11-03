import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAppServer } from "./server.ts";
import { refreshWordLog } from "./word-log.ts";

// The bundle runs from app/dist/, so the novel folder is two levels up.
const distDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.env.NOVEL_ROOT ?? path.join(distDir, "..", ".."));
const clientDir = path.join(distDir, "client");
const port = Number(process.env.PORT ?? 4747);

const server = createAppServer({ root, clientDir });

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Is the app already running? Set PORT to use another.`);
    process.exit(1);
  }
  throw error;
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Novel app running at http://localhost:${port}`);
  console.log(`Novel folder: ${root}`);
  // The daily tracker's baseline updates when the app starts (design.md).
  refreshWordLog(root).catch((error: unknown) => console.error("Couldn't update the daily word log:", error));
});
