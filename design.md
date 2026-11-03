# Novel2026 Browser App: Design

Status: **DRAFT 3. All design decisions made; final wireframes below, awaiting your review.**
Final wireframes go in the "Finalized design" section at the bottom once we've settled each view.

## Goal
A small local web app to read and edit the Markdown files in `novel2026/` in the browser, in three views:

1. **Planning**: the Snowflake Method files
2. **Wiki**: continuity wiki, with `[[wiki-link]]` browsing
3. **Manuscript**: the novel text

Files on disk stay the source of truth (plain `.md`, still openable in Obsidian or any editor).

## What I found in the folder
- `planning/` has ~30 files. Only a few are numbered Snowflake steps (`00-story-bible`, `01-one-sentence`, `02-one-paragraph`, `03-character-summaries`); the rest are working notes (`threads`, `theme-map`, `structure-toolbox`, research, brainstorms, options). `planning/archive/` holds old logs.
- `wiki/` has ~40 files in `characters/`, `places/`, `factions/`, `terms-and-rules/`, plus `timeline.md`, `open-questions.md`, `README.md`, and `_templates/`. Obsidian format: YAML frontmatter, `[[wiki-links]]`, `aliases`.
- `progress.md` and `agents.md` sit at the root.
- **There is no `manuscript/` folder yet.** The app would create it on first chapter.

---

## Cross-cutting decisions (options)

### Editing model
| | A. Read / Edit toggle | B. Live split (source left, preview right) | C. Live-preview single pane (Obsidian style) |
|---|---|---|---|
| Feel | Reads like a page; click Edit for a plain-text box | Always see both | Markdown renders as you type |
| Build cost | Low | Low-medium | High (needs an editor library) |
| Best for | Planning, wiki | Wiki, planning | Manuscript |

### Saving
- **A. Explicit save** (Cmd+S, "unsaved" dot). Safe, nothing changes behind your back.
- **B. Autosave** after a pause. Convenient, but a slip can overwrite good text.
- Either way: warn if the file changed on disk meanwhile (you or Claude edit the same files).

---

## View 1: Planning (Snowflake)

### Option 1A: Steps sidebar + reading pane
```
+--------------------------------------------------------------+
| [Planning] [Wiki] [Manuscript]                    search...  |
+----------------+---------------------------------------------+
| SNOWFLAKE      |  # Step 2: One-Paragraph Summary   [Edit]   |
|  0 Story bible |                                             |
|  1 Sentence  v |  Rendered markdown here...                  |
|  2 Paragraph v |                                             |
|  3 Characters  |                                             |
|  4 Synopsis  . |                                             |
| TRACKING       |                                             |
|  threads       |                                             |
|  theme-map     |                                             |
| NOTES (14)     |                                             |
| ARCHIVE (6)    |                                             |
+----------------+---------------------------------------------+
```
`v` = file exists, `.` = step not started yet (greyed placeholder from the step list in AGENTS.md).

### Option 1B: Step ribbon across the top
```
+--------------------------------------------------------------+
| [Planning] [Wiki] [Manuscript]                    search...  |
+--------------------------------------------------------------+
| (0)--(1)--(2)--(3)--( 4 )--(5)--(6)--(7)--(8)--(9)           |
|  v    v    v    v    now   .    .    .    .    .             |
+--------------------------------------------------------------+
|  # Step 3: Major Character Summaries              [Edit]     |
|  ...rendered markdown...                                     |
|                                                              |
|  Related: threads . theme-map . structure-toolbox . notes v  |
+--------------------------------------------------------------+
```
Shows where you are in the process at a glance; notes live behind "Related".

### Option 1C: Dashboard of cards, click to open
```
+--------------------------------------------------------------+
| SNOWFLAKE STEPS                                              |
| +----------+ +----------+ +----------+ +----------+          |
| | 1 Sent.  | | 2 Para.  | | 3 Chars  | | 4 Synop. |          |
| | done     | | done     | | in prog  | | not yet  |          |
| +----------+ +----------+ +----------+ +----------+          |
| TRACKING   [threads] [theme-map] [toolbox] [progress]        |
| NOTES      [research-notes] [ritual-brainstorm] ...          |
+--------------------------------------------------------------+
   click a card -> full-page reader with a "back to dashboard"
```

**Questions:** Should `progress.md` appear here (it's the current-state file)? Do you want "not started" steps shown, or only files that exist?

---

## View 2: Wiki (with linking)

Linking rules proposed for any option:
- `[[the-capital]]` and `[[the-capital|the city]]` become clickable links; links match by filename **or** frontmatter `aliases`.
- Links to pages that don't exist render red (a "dropped thread" signal). Clicking offers to create from a template in `wiki/_templates/`.
- **Backlinks** panel: every page that links here.
- Back / forward buttons, like a browser.
- Frontmatter (`type`, `status`, `placeholder`) shown as a small header strip, not raw YAML.

### Option 2A: Three panes (tree | page | backlinks)
```
+--------------------------------------------------------------+
| [Planning] [Wiki] [Manuscript]                    search...  |
+--------------+-----------------------------+-----------------+
| < >          | # The Capital   [Edit]      | LINKS HERE      |
| characters   | type: place  status: tent.  |  the-empire     |
|  dim-master  |                             |  high-families  |
|  spacer-cap. | ## Confirmed                |  timeline       |
| places       | - Seat of [[the-empire]]    |                 |
|  > the-capit.| - Near [[academy-town]]     | OUTGOING        |
|  academy-t.  |                             |  the-empire     |
| factions     | ## Tentative                |  academy-town   |
| terms-rules  | ...                         |  (red) old-port |
+--------------+-----------------------------+-----------------+
```

### Option 2B: Search-first, two panes
```
+--------------------------------------------------------------+
| [Planning] [Wiki] [Manuscript]    [ Jump to page... Ctrl+K ] |
+--------------------------------------------------------------+
| < >  wiki / places / the-capital                      [Edit] |
+--------------------------------------------------------------+
| (page content, wide)                                         |
|                                                              |
+--------------------------------------------------------------+
| Backlinks (3): the-empire . high-families . timeline         |
+--------------------------------------------------------------+
```
Fastest browsing by keyboard; no permanent tree. Hover a link to preview the target.

### Option 2C: Tabs + hover previews (Obsidian-lite)
```
+--------------+---------------------------------------------+
| tree         | [the-capital x][dim-master x][timeline x]   |
|              +---------------------------------------------+
|              | ...page, [[links]] show a popup preview     |
|              |    on hover; ctrl-click opens in new tab    |
|              |  Backlinks (collapsible) at the bottom      |
+--------------+---------------------------------------------+
```

### Quick previews (side by side)
```
2A  Three panes            2B  Search-first           2C  Tabs + hover
+------+--------+-----+    [ Ctrl+K jump to... ]      +------+------------+
| tree | page   |links|    +------------------+       | tree |[tab][tab]  |
|      |        |     |    | page (wide)      |       |      |------------|
|      |        |     |    +------------------+       |      | page       |
+------+--------+-----+    | backlinks        |       |      | backlinks  |
                           +------------------+       +------+------------+
```
- **2A:** always see the tree and backlinks; least to learn.
- **2B:** most room for the page; relies on keyboard search to move around.
- **2C:** keeps several pages open for comparing; most to build.

**Decided:** no graph view in v1 (maybe later).
**Still open:** Should `open-questions.md` and `timeline.md` get pinned shortcuts?

---

## View 3: Manuscript

The folder doesn't exist yet. Proposed convention: `manuscript/01-chapter-title.md`, one file per chapter (matches `drafting-tracker.md`'s one-block-per-chapter).

### Option 3A: Chapter list + editor
```
+--------------------------------------------------------------+
| [Planning] [Wiki] [Manuscript]        words: 31,402 / today  |
+----------------+---------------------------------------------+
| CHAPTERS       |  Chapter 3: Title                  [Read]   |
|  1 Title  4.2k |  +---------------------------------------+  |
|  2 Title  3.8k |  | plain-text Markdown editor            |  |
| >3 Title  1.9k |  | (serif font, wide margins)            |  |
|  [+ new]       |  +---------------------------------------+  |
|                |  saved 12:04                                |
+----------------+---------------------------------------------+
```

### Option 3B: Focus mode
```
+--------------------------------------------------------------+
|  (everything hides while typing; chapter list on hover/Esc)  |
|                                                              |
|            centered column, ~65 characters wide              |
|            large serif text, typewriter scroll                |
|                                                              |
|                                       Ch 3 . 1,912 words     |
+--------------------------------------------------------------+
```

### Option 3C: Editor + reference pane
```
+--------------+---------------------------+-------------------+
| chapters     | editor                    | REFERENCE         |
|              |                           | [scene plan v]    |
|              |                           |  Ch3 scene line   |
|              |                           |  from 08-scene-   |
|              |                           |  list, or a wiki  |
|              |                           |  page via search  |
+--------------+---------------------------+-------------------+
```
Keeps the plan and the wiki beside the text without leaving the page. (The AGENTS.md "DURING DRAFTING" notes suggest you check a scene against its plan.)

**Questions:** One file per chapter OK, or one file per scene? Do you want word counts / daily goal? Should wiki `[[links]]` also work (and be checked) inside manuscript text?

---

## Technical shape (preview only; the full version goes in plan.md)
- Small local server (Node) that lists, reads, and writes `.md` files, restricted to the `novel2026/` folder, and a browser front end. Runs on `localhost` only.
- Heads-up: your Node is v14.17 (old). Fine for a small app, but it limits library choice. We'll cover this in plan.md.

---

## Decisions so far
| Topic | Decision |
|---|---|
| Planning view | Option 1A, steps sidebar + reading pane |
| Planning: `progress.md` | Shown in the sidebar |
| Planning: unstarted steps | Shown greyed out |
| Wiki layout | Option 2A, three panes (tree / page / links) |
| Wiki pinned shortcuts | Yes: `timeline` and `open-questions` pinned at top of tree |
| Wiki graph view | Not in v1 |
| Manuscript view | Distraction-free focus mode (3B) with a chapter list that toggles show/hide |
| Manuscript files | One file per chapter, `manuscript/NN-title.md` |
| Manuscript word counts | Yes: per chapter, manuscript total |
| Daily word tracker | Yes: net words per day, updated on app load and on every save, listed below the total in the chapter list; stored in `manuscript/.word-log.json` |
| Tracker display | DAILY list has a caret toggle; collapsed by default, showing only today's number; state remembered |
| Tracker baseline | Previous day's last known total; recounted on app load. Outside edits count on the day the app notices them. First run baselines at the load-time total. |
| Manuscript `[[links]]` | No linking in manuscript text |
| Editing model | Live split (source + preview); either side can be minimized so the other fills the window |
| Saving | Cmd+S saves now; autosave every 5 minutes if there are unsaved changes; warn if file changed on disk |
| Tech | Node v24.21.0, TypeScript, esbuild |

## Finalized design

### Shared behavior
- **Top bar:** `[Planning] [Wiki] [Manuscript]` tabs on the left, save status on the right (`saved 12:04`, or `unsaved *`).
- **Open file = split editor** (all three views): source (Markdown text) on the left, rendered preview on the right. Each side has a minimize button; minimizing one makes the other fill the width, and a restore button brings it back. Last layout is remembered per view.
- **Saving:** Cmd+S saves immediately. Every 5 minutes, any file with unsaved changes is saved automatically. If a file changed on disk since it was opened (you or Claude edited it), the app shows a banner with "Reload" and "Keep mine" instead of overwriting.
- **Leaving with unsaved changes** (switching files, closing the tab) prompts first.
- **Safe scope:** the server only reads and writes `.md` files inside `novel2026/`, plus `manuscript/.word-log.json` for the daily tracker.

### View 1: Planning
```
+----------------------------------------------------------------+
| [Planning] [Wiki] [Manuscript]                     saved 12:04 |
+----------------+-----------------------------------------------+
| progress       | 02-one-paragraph.md        [<src] [prev>]     |
|                +-----------------------+-----------------------+
| SNOWFLAKE      | source (markdown)     | preview (rendered)    |
|  0 Story bible |                       |                       |
|  1 Sentence    |                       |                       |
|  2 Paragraph < |                       |                       |
|  3 Characters  |                       |                       |
|  4 Synopsis    | (grey = not started)  |                       |
|  5 Char. desc. |                       |                       |
|  ... 6 7 8 9   |                       |                       |
| TRACKING       |                       |                       |
|  threads       |                       |                       |
|  theme-map     |                       |                       |
|  toolbox ...   |                       |                       |
| NOTES (n)      |                       |                       |
| ARCHIVE (n)    |                       |                       |
+----------------+-----------------------+-----------------------+
```
- `progress.md` sits at the top of the sidebar. `agents.md` is not listed.
- Steps 0–9 are listed in order. Steps with no file yet are greyed out and not clickable (their expected file name shows on hover).
- Tracking = `threads`, `theme-map`, `structure-toolbox`, `outline-status`. Notes = every other file in `planning/`. Archive = `planning/archive/`. NOTES and ARCHIVE are collapsible.

### View 2: Wiki
```
+----------------------------------------------------------------+
| [Planning] [Wiki] [Manuscript]                     saved 12:04 |
+--------------+----------------------------------+--------------+
| < >  search  | the-capital.md   [<src] [prev>]  | LINKS HERE   |
| * timeline   | type: place  status: tentative   |  the-empire  |
| * open-quest.+----------------+-----------------|  timeline    |
| characters   | source         | preview         |              |
|  dim-master  |                |  Seat of        | LINKS OUT    |
| places       |                |  the-empire     |  the-empire  |
|  > the-capit.|                |  (link)         |  academy-t.  |
|  academy-t.  |                |                 |  old-port(r) |
| factions     |                |                 |              |
| terms-rules  |                |                 | (r)=missing  |
+--------------+----------------+-----------------+--------------+
```
- `*` = pinned shortcuts. `< >` = back / forward history.
- `[[name]]` and `[[name|label]]` in the preview are clickable. They match a filename or a frontmatter `alias`.
- Links to pages that don't exist show in red; clicking offers to create the page from the matching `_templates/` file.
- Frontmatter appears as a small header strip in the preview, not raw YAML (it stays editable in the source side).
- `_templates/` and `README.md` are reachable but listed at the bottom of the tree.
- Links here (backlinks) and links out are computed from all wiki files and refresh on save.

### View 3: Manuscript (focus mode)
Chapter list hidden (default while writing):
```
+----------------------------------------------------------------+
| [Planning] [Wiki] [Manuscript]    [chapters]      saved 12:04  |
+----------------------------------------------------------------+
|            [<src] [prev>]                                      |
|        source (markdown)         |   preview (rendered)        |
|        centered, serif,          |   centered, serif           |
|        wide margins              |                             |
|                                                                |
|  Ch 3 "Title" . 1,912 words . today +640                      |
+----------------------------------------------------------------+
```
Chapter list shown (toggle with the `[chapters]` button or a shortcut):
```
+----------------+-----------------------------------------------+
| CHAPTERS       |   (same split editor, shifted right)          |
|  1 Title  4.2k |                                               |
|  2 Title  3.8k |                                               |
| >3 Title  1.9k |                                               |
|  [+ new]       |                                               |
|  total 31,402  |                                               |
| v DAILY        |                                               |
|  Today   +640  |                                               |
|  Nov 2   +1.2k |                                               |
|  Nov 1     +85 |                                               |
|  ...           |                                               |
+----------------+-----------------------------------------------+
```
DAILY collapsed (the default; shows only today):
```
|  total 31,402  |
| > DAILY  +640  |
```
- With the preview minimized, the source fills a single centered column (the pure focus view).
- Files are `manuscript/NN-title.md`. `[+ new]` asks for a title and creates the next number; the folder is created on first use.
- Word counts: per chapter in the list, manuscript total below the list, and the current chapter in the status line.
- **Daily word count tracker:** a DAILY list sits directly below the manuscript total, newest day first (scrolls; today always shown, even at +0).
  - A day's number is **net**: manuscript total words now minus the total at the start of that day. Cutting text lowers it (it can go negative).
  - **Expand/collapse:** the DAILY heading has a caret toggle (`>` collapsed, `v` expanded). Collapsed, it shows only today's number on the heading line; expanded, it lists every day. The open/closed state is remembered between sessions and is collapsed the first time.
  - **Updated on app load and on every save** (Cmd+S and the 5-minute autosave): the server recounts all chapters from disk and rewrites today's entry. The status line also shows `Today +N`.
  - **Baseline:** a day's `start` is the previous entry's last recorded `end` (the last total the app knew about). So words changed outside the app (Finder, Claude, another editor) since then **are counted on the day the app notices them**: at load or at the next save, whichever comes first.
  - **First run** (no log yet): the baseline is the manuscript total at app load, so existing text isn't counted as written that day.
  - **Load refresh:** on every app start the project baseline total is recounted and today's `end` is updated, creating today's entry if it's the first load of the day. A new day's `start` is always carried over from the last `end`, never reset to the load-time count.
  - Stored in `manuscript/.word-log.json` as `{ "2026-11-03": { "start": 30762, "end": 31402 } }`, one entry per day with the day boundary at local midnight. It's a plain file you can read or edit. This is the one non-`.md` file the app writes.
  - No daily goal or streaks in v1.
- No `[[link]]` handling in manuscript text; it renders as plain text.
- Reordering and renaming chapters is **not** in v1 (do it in Finder; the app picks up the changes on reload).

### Out of scope for v1
Graph view, wiki links inside the manuscript, daily word goals and streaks, chapter reordering in the UI, file deletion from the UI, search across all files beyond the wiki page jumper.
