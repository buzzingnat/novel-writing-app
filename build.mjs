// Builds the browser bundle and the server bundle into dist/.
// `node build.mjs --watch` rebuilds on change and restarts the server.
import * as esbuild from "esbuild";
import { spawn } from "node:child_process";
import { copyFile, mkdir } from "node:fs/promises";
import { watch as watchFile } from "node:fs";

const watch = process.argv.includes("--watch");

async function copyHtml() {
  await mkdir("dist/client", { recursive: true });
  await copyFile("src/client/index.html", "dist/client/index.html");
}

const copyHtmlPlugin = {
  name: "copy-html",
  setup(build) {
    build.onEnd(async (result) => {
      if (result.errors.length === 0) await copyHtml();
    });
  },
};

let serverProcess;
const restartServerPlugin = {
  name: "restart-server",
  setup(build) {
    build.onEnd((result) => {
      if (result.errors.length > 0) return;
      serverProcess?.kill();
      serverProcess = spawn(process.execPath, ["--enable-source-maps", "dist/server.js"], {
        stdio: "inherit",
      });
    });
  },
};

const clientOptions = {
  entryPoints: { app: "src/client/main.ts" },
  outdir: "dist/client",
  bundle: true,
  platform: "browser",
  format: "esm",
  target: "es2022",
  sourcemap: true,
  logLevel: "info",
  plugins: [copyHtmlPlugin],
};

const serverOptions = {
  entryPoints: ["src/server/main.ts"],
  outfile: "dist/server.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  // Dependencies load from node_modules at runtime instead of being bundled.
  packages: "external",
  sourcemap: true,
  logLevel: "info",
  plugins: watch ? [restartServerPlugin] : [],
};

if (watch) {
  const client = await esbuild.context(clientOptions);
  const server = await esbuild.context(serverOptions);
  await Promise.all([client.watch(), server.watch()]);
  // esbuild only watches files it bundles, so watch the HTML shell ourselves.
  watchFile("src/client/index.html", () => copyHtml().catch(console.error));
} else {
  await Promise.all([esbuild.build(clientOptions), esbuild.build(serverOptions)]);
}
