import { request } from "node:http";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/** A small fake novel folder, shaped like the real one. Tests never touch the real files. */
export const FIXTURE_FILES: Record<string, string> = {
  "progress.md": "# Progress\n",
  "agents.md": "# Agents\n",
  "planning/00-story-bible.md": "# Story bible\n",
  "planning/01-one-sentence.md": "# One sentence\n",
  "planning/03-character-summaries.md": "# Characters\n",
  "planning/threads.md": "# Threads\n",
  "planning/theme-map.md": "# Theme map\n",
  "planning/research-notes.md": "# Research\n",
  "planning/step2-format.md": "# Step 2 format\n",
  "planning/archive/progress-log.md": "# Log\n",
  "wiki/README.md": "# Wiki\n",
  "wiki/timeline.md": "# Timeline\n",
  "wiki/open-questions.md": "# Open questions\n",
  "wiki/characters/planet-hero.md": "---\ntype: character\n---\n# Planet hero\n",
  "wiki/places/the-capital.md": "# The capital\n",
  "wiki/_templates/character.md": "# {{name}}\n",
  "app/plan.md": "# should never be listed\n",
  ".hidden/secret.md": "# hidden\n",
  "planning/notes.txt": "not markdown\n",
};

export interface Fixture {
  root: string;
  cleanup: () => Promise<void>;
}

export async function makeFixture(files: Record<string, string> = FIXTURE_FILES): Promise<Fixture> {
  // realpath because macOS temp folders sit behind a /var -> /private/var symlink.
  const base = await realpath(await mkdtemp(path.join(tmpdir(), "novel-app-test-")));
  const root = path.join(base, "novel");
  await mkdir(root);
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, content);
  }
  return { root, cleanup: () => rm(base, { recursive: true, force: true }) };
}

export interface HttpResult {
  status: number;
  type: string;
  body: string;
}

export function httpRequest(
  port: number,
  options: { method?: string; path: string; headers?: Record<string, string>; body?: string },
): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        host: "127.0.0.1",
        port,
        method: options.method ?? "GET",
        path: options.path,
        headers: { host: `localhost:${port}`, ...options.headers },
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, type: String(res.headers["content-type"]), body }));
      },
    );
    req.on("error", reject);
    req.end(options.body);
  });
}
