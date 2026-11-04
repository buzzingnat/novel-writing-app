# Coding Log

Past work on the app, newest entry last. Each entry is a copy of handoff.md as it stood when a feature was finished. This file is reference only; design.md, plan.md, and handoff.md are kept clean for the current task.

---

## Entry 1: v1 build (plan steps 0 to 7, approved 2026-11-03)

# Novel2026 Browser App: Handoff

Status: **v1 complete.** Plan steps 0–7 built, tested by the author, and approved on 2026-11-03. Code committed in `a9e3dfc` on `main` (not pushed).

Companion documents: [design.md](design.md) (wireframes and design decisions), [plan.md](plan.md) (implementation plan), [README.md](README.md) (how to run).

---

## What was built

A local web app that reads and writes the Markdown files in `novel2026/` directly. There's no database: the files on disk are the source of truth and stay readable in Obsidian or any editor.

### Shared across all three views
- **Split editor:** Markdown source on the left, live rendered preview on the right. **Source** and **Preview** buttons hide either side, and the layout is remembered separately for each view.
- **Saving:** ⌘S saves now, and any file with unsaved changes saves automatically every 5 minutes. The top bar shows `unsaved •`, `saving…`, `saved 3:22 PM`, `changed on disk`, or `save failed: …`.
- **Conflict protection:** if a file changed on disk since you opened it (you, Claude, or another editor), the save is refused and a banner offers **Reload from disk** or **Overwrite with my version**. A file deleted on disk offers **Recreate with my version**.
- **Unsaved-changes guard:** switching files asks **Save / Don't save / Cancel**. Closing the tab with unsaved work shows the browser's warning. Switching tabs never loses text.
- **Help:** the **?** button lists the shortcuts and a few tips.
- **Light and dark mode** follow macOS.

### Planning view
- **Sidebar order:** `progress`, then **Snowflake** steps 0–9, **Tracking** (threads, theme-map, structure-toolbox, outline-status), **Notes**, and **Archive**.
- **Unstarted steps:** greyed out and not clickable. Hovering one shows the file it expects (for example `planning/04-one-page-synopsis.md`). A step lights up as soon as a file with its number prefix exists.
- **Collapsing:** Notes and Archive collapse, and start collapsed.
- **Last file:** the view reopens the last file you had open, or `progress.md` the first time.

### Wiki view
- **Three panes:** a page tree, the editor, and a links panel.
- **Tree:** ★ `timeline` and ★ `open-questions` are pinned at the top, then the folders, then **Other** (README) and **Templates** (collapsed).
- **Links:** `[[page]]`, `[[page|label]]`, `[[page#heading]]`, and `![[embed]]` are clickable in the preview. They match by file name, then alias, then page title, ignoring case and spaces versus hyphens. Links inside code are ignored.
- **Red links:** a link to a page that doesn't exist yet. Clicking one asks for a name and folder (defaulting to the current page's folder), then creates the page from that folder's template with the heading set to the title.
- **Links panel:** **Links here** (backlinks) and **Links out**. It updates on save and when you switch back to the window.
- **Getting around:** ‹ › back/forward history, and a search box that filters by file name, title, and alias. Enter opens the top result and Esc clears.
- **Frontmatter:** shows as small chips in the preview (`type`, `status`, `placeholder name`, aliases). The YAML stays editable in the source pane.

### Manuscript view
- **Focus mode:** the chapter list is hidden by default. **Chapters** in the top bar or ⌘\ toggles it, and the choice is remembered. Hide the preview for a single serif column about 65 characters wide.
- **Chapter files:** one per chapter, `manuscript/NN-title-slug.md`. **+ New chapter** asks for a title, creates the next number with a `# Title` heading, and creates `manuscript/` on first use.
- **Word counts:** each chapter's count in the list, **Total** below the list, and a live status line: `Ch 1 "Arrival" · 18 words · today +8`.
- **Daily tracker:** **DAILY** sits below Total with a caret toggle (collapsed by default, and remembered). Collapsed, it shows today's number. Expanded, it lists every recorded day, newest first.
- **No `[[link]]` handling** in manuscript text.

---

## Decisions (final)

### Design (author)
| Topic | Decision |
|---|---|
| Planning layout | Steps sidebar + split editor |
| `progress.md` | Shown at the top of Planning |
| Unstarted steps | Greyed out |
| Wiki layout | Three panes: tree, page, links |
| Wiki pinned shortcuts | `timeline` and `open-questions` |
| Graph view | Not in v1 (maybe later) |
| Manuscript layout | Distraction-free focus mode with a show/hide chapter list |
| Manuscript files | One file per chapter |
| Manuscript `[[links]]` | No linking |
| Editing model | Live split; either side can be minimized |
| Saving | ⌘S, plus autosave every 5 minutes |
| Daily tracker | Net words per day, updated on app load and every save, shown below the total with a caret toggle |
| Tracker baseline | Previous day's last known total; first run baselines at the load-time total |
| Outside edits | Counted on the day the app notices them |
| Stack | Node v24.21.0, TypeScript, esbuild |
| Process | The author runs all npm commands; Claude never does |

### Implementation (proposed by Claude and accepted through step approvals)
| Topic | Decision |
|---|---|
| Server | Node's built-in `http`, no framework, `127.0.0.1:4747`, Host and Origin checks |
| Front end | Plain TypeScript and DOM, no UI framework. The source pane is a plain `<textarea>`, not CodeMirror. |
| Libraries | `markdown-it` (raw HTML disabled, so the preview can't run scripts) and `yaml` (frontmatter). Dev: `typescript`, `esbuild`, `@types/node`, `@types/markdown-it`. |
| File access | Visible `.md` files inside the novel folder only; never `app/`, hidden folders, or `node_modules/`; symlinks out of the folder are refused |
| Writes | Atomic (temp file + rename), with an mtime check on every save |
| Word count rule | Drop frontmatter; split on whitespace and em/en dashes; count pieces containing a letter or digit. `well-known` = 1, `ran—fast` = 2, `#`/`---`/`*`/`…` = 0, and the chapter's `# Title` counts. |
| Daily log file | `manuscript/.word-log.json`, `{ "YYYY-MM-DD": { "start", "end" } }`, one day per line, written only by the server. Local-midnight day boundary. An unreadable log is moved aside as `.word-log.unreadable-<time>.json`, never overwritten. |
| Tracker refresh | Server start, page load, every chapter save or new chapter, and when you switch back to the window |
| Remembered UI state | `localStorage`: last tab, last file per view, pane layout per view, collapsed sections, chapter list shown, DAILY open |
| Defaults | Planning opens `progress.md` first; Wiki opens `README`; new wiki pages default to the current page's folder |
| Narrow windows | Below 1100px the wiki links panel moves under the tree; below 800px the sidebars get slimmer |
| Window focus | Sidebars, chapters, wiki links, and the daily count refresh when the window regains focus |
| Autosave test flag | `?autosave=N` seconds (minimum 5) |
| Deletion | No delete button; delete or rename files in Finder |

---

## How to run and check it

```bash
nvm use
npm install
npm run build
npm start
```

Open <http://localhost:4747>. Use `npm run dev` while changing code, `npm test` for the 138 automated tests, and `npm run typecheck` to check types. `NOVEL_ROOT=/path npm start` points the app at a copy of the novel folder for safe experiments.

## Where things live

| Area | Files |
|---|---|
| Pure logic (tested in Node) | `src/shared/`: `paths.ts`, `tree.ts`, `wikilinks.ts`, `frontmatter.ts`, `wordcount.ts`, `chapters.ts`, `daily-log.ts` |
| Server | `src/server/`: `server.ts` (static files, Host/Origin checks), `api.ts` (routes), `files.ts` (safe read/write/list), `word-log.ts`, `http.ts`, `main.ts` |
| Browser | `src/client/`: `main.ts` (shell, tabs, ⌘S, autosave), `editor.ts`, `documents.ts` (save and conflict state), `markdown.ts`, `sidebar.ts`, `sidebar-model.ts`, `dialog.ts`, `history.ts`, `views/{planning,wiki,manuscript}.ts`, `style.css` |
| Tests | `test/*.test.ts`; `helpers.ts` builds a fake novel folder in a temp directory |

API routes: `GET /api/tree`, `GET /api/wiki-pages`, `GET|PUT /api/file`, `GET /api/chapters`, `POST /api/chapter`, `GET /api/word-log`, `GET /api/health`.

## Known limits
- **Plain textarea editor:** no syntax highlighting, and no scroll sync between source and preview.
- **Daily tracker timing:** it only sees changes when the app loads, saves, or regains focus. Words changed outside the app while it stays closed for several days are credited to the day it's next opened.
- **Chapter numbering:** new chapters always get the next number after the highest one. Reordering means renaming files in Finder.
- **Wiki index refresh:** the index is built from saved text, so links you add appear in Links out after you save.
- **Duplicate names:** if two wiki pages share a file name in different folders, links go to the first in path order.
- **Word counts:** may differ slightly from Word or Google Docs (see the rule above).
- **Bundle size:** `app.js` is about 440 KB unminified (mostly the YAML parser). That's fine for local use.

## Ideas left out of v1
Graph view; wiki links inside the manuscript; daily word goals and streaks; chapter reordering and renaming in the app; deleting files from the app; search across all files; scroll sync; a CodeMirror source pane.

## Loose ends for the author
- **Push:** the commit is on `main` and not pushed. Push to `origin` (`buzzingnat/novel-writing-app`) when ready.
- **Nested backup:** a second backup copy sits inside the novel folder, at `novel2026/novel2026-backup-2026-11-03`. The app never shows it, but it's within the folder the app can write to; consider moving or deleting it (the other copy is at `~/projects/novel2026-backup-2026-11-03`).
- **Claude's preview config:** `novel2026/.claude/launch.json` was added for Claude's scratch-copy previews. It's outside the app repo and can be deleted.
- **Ongoing backups:** the novel folder still isn't under version control. Back it up regularly, or consider putting it in git.
