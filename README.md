# Novel writing app

A small local browser app for reading and editing the Markdown files in `novel2026/`:

- **Planning**: the Snowflake Method files, with unstarted steps greyed out.
- **Wiki**: the continuity wiki, with clickable `[[links]]`, backlinks, and back/forward.
- **Manuscript**: chapters in a distraction-free editor, with word counts and a daily tracker.

Files on disk stay the source of truth. They're plain Markdown, still readable in Obsidian or any editor. Design and decisions are in [design.md](design.md), the build plan in [plan.md](plan.md), and the hand-off summary in [handoff.md](handoff.md).

## Run it

Needs Node 24.21.0 (pinned in `.nvmrc`). From this `app/` folder:

```bash
nvm use
npm install
npm run build
npm start
```

Then open <http://localhost:4747>. The server only listens on your own machine.

| Command | What it does |
|---|---|
| `npm run build` | Bundles the browser and server code into `dist/` |
| `npm start` | Runs the built app |
| `npm run dev` | Rebuilds on every change and restarts the server |
| `npm test` | Runs the automated tests (they use a temporary fake novel folder, never your files) |
| `npm run typecheck` | Checks the TypeScript types |

### Options

- `PORT=5000 npm start` uses another port.
- `NOVEL_ROOT=/path/to/folder npm start` points the app at a different novel folder, such as a copy to experiment on. By default it uses the folder above `app/`.
- Open `http://localhost:4747/?autosave=10` to autosave every 10 seconds instead of 5 minutes, which is handy for testing (5 seconds minimum).

## What it reads and writes

- Only visible `.md` files inside the novel folder, never anything in `app/`, hidden folders, or `node_modules/`.
- Plus `manuscript/.word-log.json`, the daily word-count record, which only the server writes.
- Saves are atomic, so a crash leaves either the old file or the new one. A save never overwrites a file that changed on disk since you opened it; you choose "Reload from disk" or "Overwrite with my version".
- There is no delete button. Delete or rename files in Finder; the app picks up changes when you switch back to its window.

The novel folder isn't under version control, so keep a backup (for example `rsync -a novel2026/ novel2026-backup/` from the folder above it).

## Code layout

```
src/shared/   pure logic, tested in Node: paths, tree grouping, wiki links,
              frontmatter, word counts, chapters, daily log
src/server/   http server, safe file access, API routes, daily log updates
src/client/   browser app: views (planning, wiki, manuscript), split editor,
              document/save state, sidebar, dialogs, styles
test/         node:test suites; helpers.ts builds a fake novel folder in a temp dir
```
