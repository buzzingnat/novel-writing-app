# Novel writing app

A small local browser app for reading and editing the Markdown files in `novel2026/`:

- **Planning**: the Snowflake Method files, with unstarted steps greyed out, and clickable `[[links]]` to other planning files and to wiki pages.
- **Wiki**: the continuity wiki, with clickable `[[links]]` (to wiki pages and planning files), backlinks, and back/forward.
- **Manuscript**: chapters in a distraction-free editor, with word counts and a daily tracker.

Files on disk stay the source of truth. They're plain Markdown, still readable in Obsidian or any editor. The design, build plan, and hand-off summary for the feature in progress are in [design.md](design.md), [plan.md](plan.md), and [handoff.md](handoff.md). Past work is in [coding-log.md](coding-log.md).

## Process

Each feature goes through the same steps:

1. **Design** in `design.md`, with open questions answered by the author.
2. **Plan** in `plan.md`, as small steps.
3. **Build one step at a time.** After each step the author tests it and approves before the next begins.
4. **Hand off** in `handoff.md`, then copy it into `coding-log.md`.

`design.md`, `plan.md`, and `handoff.md` describe only the current feature. When a new feature starts, they are reset to clean templates, and `coding-log.md` keeps the finished handoffs as a reference of past work.

## Style guide

- **Link markers.** An outgoing `[[link]]` that points into the other area carries an emoji after its label: 📋 (U+1F4CB) on a link in the Wiki that points to a planning file, and 📚 (U+1F4DA) on a link in Planning that points to a wiki page. Links within the same area have no marker. The app adds markers when it renders; they are never saved into the Markdown files.

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
              planning links,
              frontmatter, word counts, chapters, daily log
src/server/   http server, safe file access, API routes, daily log updates
src/client/   browser app: views (planning, wiki, manuscript), split editor,
              document/save state, sidebar, dialogs, styles
test/         node:test suites; helpers.ts builds a fake novel folder in a temp dir
```
