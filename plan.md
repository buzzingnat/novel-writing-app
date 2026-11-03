# Novel2026 Browser App: Implementation Plan

Status: **DRAFT, awaiting your review.** Based on the finalized design in [design.md](design.md). Nothing is built yet.

## Approach in one paragraph
A small local Node server (built-in `http`, no web framework) reads and writes Markdown files under `novel2026/` and serves a single-page browser app. The front end is plain TypeScript with no UI framework, bundled by esbuild. Markdown rendering uses one library. Anything that holds logic (path safety, word counts, wiki links, the daily tracker) lives in small pure modules with automated tests, so the risky parts are checked without a browser.

## Language, runtime, tooling
- **Node v24.21.0**, pinned in `.nvmrc` and `package.json` `engines`. Step 0 checks that it is installed (`nvm install 24.21.0` if not).
- **TypeScript** everywhere (server, client, shared, tests), `strict: true`, ES modules.
- **esbuild** bundles `src/client/main.ts` to `dist/client/app.js` (browser) and `src/server/main.ts` to `dist/server.js` (node). A `build.mjs` script does both and supports `--watch`.
- **Type checking** is a separate `tsc --noEmit` run (esbuild does not type-check).
- **Tests** use Node's built-in runner (`node --test`), which runs `.ts` files directly in Node 24. That means test and shared code avoid TS features that need compiling (no `enum`, no constructor parameter properties) and import with `.ts` extensions.

## Libraries (kept to a minimum)
| Package | Why | Notes |
|---|---|---|
| `markdown-it` | Render Markdown in the preview | Raw HTML in `.md` is **disabled**, so the preview can't run scripts. I add one small custom inline rule for `[[wiki links]]` (Wiki view only). |
| `yaml` | Parse and read wiki frontmatter (`type`, `status`, `aliases`) | Parse only; we never rewrite the YAML. |
| `typescript`, `esbuild`, `@types/node`, `@types/markdown-it` | Dev tooling | |

Deliberately **not** used: Express/Fastify (built-in `http` is enough), React or any UI framework, CodeMirror (the source side is a plain `<textarea>`), Tailwind, a database.

## Project layout
Everything lives in `novel2026/app/`, separate from your writing.
```
app/
  design.md  plan.md  handoff.md        (documents)
  package.json  tsconfig.json  build.mjs  .nvmrc
  src/
    shared/    pure logic, no Node or DOM APIs: wordcount.ts, wikilinks.ts,
               frontmatter.ts, daily-log.ts, paths.ts (types + helpers)
    server/    main.ts (http server), files.ts (safe read/write/list), api.ts (routes)
    client/    main.ts, views/{planning,wiki,manuscript}.ts,
               editor.ts (split editor), markdown.ts, api.ts (fetch), style.css, index.html
  test/        *.test.ts + helpers.ts (builds a tiny fake novel folder in a temp dir; tests never touch the real one)
  dist/        build output (generated)
```
The project root defaults to the folder above `app/`. Override with `NOVEL_ROOT=/path`.

## Coding style
- Small modules, named exports, no classes unless state truly needs one. Plain functions and typed data.
- Logic goes in `shared/` as pure functions (input in, result out) so it can be tested without the server or browser. The server and client files stay thin.
- 2-space indent, double quotes, semicolons, `const` by default, explicit return types on exported functions.
- Comments explain *why* (a rule or a surprise), not what. Names do the rest.
- No `any`. Validate everything the server receives (paths, bodies).
- CSS in one file with CSS variables for colors and the serif font, with light and dark support via `prefers-color-scheme`.

## Key technical decisions
- **Server:** binds to `127.0.0.1` only, default port `4747` (`PORT` to change). Rejects requests whose `Host` header isn't `localhost`/`127.0.0.1` (blocks DNS-rebinding from other websites).
- **API (JSON):**
  - `GET /api/tree` returns the file lists for the three views.
  - `GET /api/file?path=…` returns `{ content, mtimeMs }`.
  - `PUT /api/file` takes `{ path, content, expectedMtimeMs }`; it returns 409 if the file changed on disk since it was loaded.
  - `POST /api/chapter` creates the next numbered chapter.
  - `GET` and `PUT /api/word-log` read the daily log (the server recounts and updates it on load and on every manuscript save).
- **Path safety:** every path is resolved against the root; reject anything that escapes the root (`..`, absolute paths, symlinks out) or isn't a visible `.md` file. Hidden files and `app/` and `node_modules/` are never listed. (Built in Step 1: the browser file API is `.md`-only. `manuscript/.word-log.json` is written only by the server's own tracker code in Step 6, never through the file API.)
- **Write protection:** besides the Host check, write requests must be `application/json` and carry no foreign `Origin`, so another website can't post to the app.
- **Writes are atomic:** write to a temp file in the same folder, then rename, so a crash can't leave half a chapter.
- **Conflict handling:** the client sends the mtime it loaded; a 409 shows the Reload / Keep mine banner. "Keep mine" re-sends with the new mtime.
- **Planning sidebar groups:** `00`–`09` files by number prefix (missing steps greyed, expected name on hover); Tracking = `threads`, `theme-map`, `structure-toolbox`, `outline-status`; Notes = other `planning/*.md`; Archive = `planning/archive/*.md`; `progress.md` on top; `agents.md` not listed.
- **Wiki link resolution:** case-insensitive match on filename (no extension), then frontmatter `aliases`, then page title. `[[a|label]]` shows `label`; `[[a#heading]]` links to the page and ignores the heading. Links inside code spans/blocks are not links. Backlinks are computed by scanning all wiki files and refresh on save.
- **Word count rule (please check it):** strip frontmatter, split on whitespace and em/en dashes, and count pieces that contain at least one letter or digit. So `#`, `---`, `*`, `>`, and a lone `—` don't count; `well-known` is one word; `ran—fast` is two. The chapter's `# Title` heading words count. Same rule everywhere (chapter, total, daily). (Refined in Step 5; code in `src/shared/wordcount.ts`.)
- **Daily log rule:** exactly as in design.md. `start` = previous day's last `end`; first run baselines at the load-time total; recount on load and every save; net words; local-midnight day boundary. The log arithmetic is a pure function with the most tests in the project.
- **Autosave:** a client timer every 5 minutes saves every file that has unsaved changes. Cmd+S saves the current file immediately.
- **UI state remembered** (in `localStorage`): split minimize state per view, chapter list shown/hidden, DAILY expanded/collapsed, last open file per view.

## Safety for your real files
`novel2026/` is **not a git repository**, and this app writes your actual files. So:
1. Before any step that involves saving, I'll ask you to make a backup copy (one command, which I'll give you, e.g. `cp -R novel2026 novel2026-backup`).
2. Automated tests only use `test/fixtures/` in a temp directory.
3. I won't enable saving in the app until the path-safety tests pass (Step 1).

## Build steps
I implement one step, run its automated checks, then **stop and wait for you to test and approve** before starting the next. Each step ends with a short "what to try" list.

### Step 0: Scaffold
Build: `package.json`, `tsconfig.json`, `.nvmrc`, `build.mjs`, a server that serves a page with the three tabs (empty views), `npm run build / start / dev / typecheck / test`.
Automated: `node -v` is 24.21.0; `npm run typecheck` and `npm run build` pass; server answers on `http://127.0.0.1:4747`.
You test: run `npm start`, open the page, click the three tabs, and confirm the tab switches and the page looks right in light and dark mode.

### Step 1: File API and path safety (read-only first, then write)
Build: `shared/paths.ts`, `server/files.ts`, `server/api.ts`; list, read, write (atomic, mtime check), create chapter.
Automated tests (against `test/fixtures` in a temp copy): `..` and absolute paths rejected; non-`.md` rejected; symlink out of root rejected; `Host` header check; stale mtime returns 409; write is atomic; hidden files and `app/` not listed; tree grouping matches the rules above.
You test: after the backup, open `http://127.0.0.1:4747/api/tree` and `…/api/file?path=progress.md` in the browser and check the JSON is correct. (No UI editing yet.)

### Step 2: Split editor
Build: `editor.ts` (textarea + preview, minimize/restore for either side, remembered), markdown rendering, dirty indicator, Cmd+S, 5-minute autosave, conflict banner, unsaved-changes prompt. Wired to a temporary file picker.
Automated: unit tests for the dirty/autosave/conflict state logic (timers faked); build + typecheck.
You test (on a **copy** file if you like): edit text and see the preview update live; minimize each side and restore; Cmd+S shows "saved"; edit the same file in another editor and confirm the conflict banner; make an edit, wait or fake the 5 minutes (a dev flag shortens it to 10 seconds), and confirm the autosave; switch files with unsaved changes and see the prompt.

### Step 3: Planning view
Build: sidebar groups, greyed-out missing steps, `progress.md` on top, collapsible Notes and Archive, opens files in the split editor.
Automated: sidebar-grouping tests (numbered steps, greyed steps, grouping rules).
You test: every `planning/` file appears in the right group; steps 4–9 are greyed and unclickable; edit and save a file; refresh the page and confirm your last open file and layout return.

### Step 4: Wiki view
Build: `shared/wikilinks.ts` + `frontmatter.ts`, tree with pinned `timeline` and `open-questions`, three panes, clickable links, red missing links with create-from-template, back/forward, backlinks and links-out panel, frontmatter header strip, search box, templates at the bottom of the tree.
Automated tests: resolution by filename, alias, title and case; `[[a|b]]` and `[[a#h]]`; links in code ignored; backlinks computed correctly on the fixture wiki; templates chosen by folder (`characters` to `character.md` and so on).
You test: click through several pages by link; use back/forward; open a page and check its backlinks against what you know; see a red link and create the page (on the backup or a test name); check pinned items; try a page with an alias.

### Step 5: Manuscript view (focus mode)
Build: chapter list with show/hide toggle, centered serif column, minimizable preview, `[+ new]` chapter (creates `manuscript/` on first use), per-chapter and total word counts, status line.
Automated: word-count tests (frontmatter, symbol-only tokens, empty file, unicode, em-dashes); chapter naming/numbering tests (`01-…`, next-number, slug rules).
You test: create two chapters, type, and watch the counts change on save; toggle the chapter list; minimize the preview for the pure focus view.

### Step 6: Daily word-count tracker
Build: `shared/daily-log.ts`, server recount on load and on every manuscript save, `.word-log.json`, DAILY list with caret toggle below the total, `Today +N` in the status line.
Automated tests (the most thorough set): first run baselines at load total; same-day multiple saves; new day carries over the previous `end`; outside edits since last run are counted on the day noticed; deleting text gives a lower or negative number; midnight rollover (clock faked); corrupt or missing log file is handled without losing chapters.
You test: write some words and save, confirm Today changes; edit a chapter in another editor, reload the app, and see those words counted; collapse and expand DAILY and reload to confirm it stays.

### Step 7: Polish, edge cases, and hand-off prep
Build: error messages (server not running, save failed, file deleted on disk), keyboard shortcuts list, `README` run instructions, a final pass on empty states (no manuscript yet, no wiki links) and narrow windows.
Automated: full `npm test`, typecheck, and a clean `npm run build` from scratch.
You test: a full walkthrough of all three views using the checklist I'll provide.

### Step 8: Handoff
I write `handoff.md`: what was built, every decision and where it lives, how to run and back up, known limits, and ideas left out (graph view, goals, reordering). You review and we close out.

## Risks and how they're handled
- **Overwriting your text:** atomic writes, mtime conflict check, backup before testing, no delete feature.
- **Plain `<textarea>` feels basic** for long chapters: this is the main tradeoff for a small, dependency-light app. If it frustrates you in Step 5, upgrading just the source pane to CodeMirror is a contained change we can decide on then.
- **Autosave plus an outside edit:** autosave also uses the mtime check, so it stops and shows the banner instead of overwriting.
- **Word count differences from Word/Obsidian:** counts follow the rule above and may differ by a small amount from other tools.

## Decisions I made that you haven't confirmed
Port `4747`; `app/` folder location; `markdown-it` over `marked`; plain textarea instead of CodeMirror; the word-count rule; `localStorage` for remembered UI state; the dev flag to shorten autosave for testing.
