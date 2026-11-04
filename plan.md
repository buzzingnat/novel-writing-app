# Current feature plan: links between Planning and Wiki

Status: **L1 approved. L2 built, awaiting author testing; L3 to L5 not started.** Design: [design.md](design.md). Same rules as always: one step at a time, run its automated checks, then **stop and wait for the author to test and approve** before the next step. The author runs all `npm` commands. Back up before testing, since testing saves real files: `node backup.mjs /Volumes/2026-hillary-writing-projects` from `novel2026/`.

## Step L1: Link resolver for planning files
Build: `src/shared/planning-links.ts`, a pure function that takes the planning paths (from `fetchTree`) and a link target and returns a path or null. It reuses `linkKey` and `parseLinkInner` from `src/shared/wikilinks.ts`, applies the "outside the archive wins" tie-break, and counts `progress.md` but not unstarted steps.
Automated (`test/planning-links.test.ts`): match by name, case, hyphens vs spaces, with and without `.md`, with a path prefix, `[[a#h]]`; archive tie-break; unstarted step is red; `progress` resolves.
Author tests: nothing visible; run `npm test` and `npm run typecheck`.

## Step L2: Links inside Planning
Build: in `src/client/views/planning.ts` (editor options, lines 14-19) pass a `render` that supplies the resolver and an `onPreviewClick` that opens the file with `openFile`. Rebuild the resolver whenever `loadTree` runs (line 32) and refresh the preview. Red links do nothing and have no-match hover text (`src/client/markdown.ts`, link rendering lines 59-66).
Automated: extend `test/markdown.test.ts` (link, `[[a|b]]`, red link, code span ignored).
Author tests: in a scratch planning note add `[[threads]]`, `[[theme-map|themes]]`, `[[02-one-paragraph]]`, `[[nothing-here]]`. The first three open the right file, the last is red and inert, backticked links stay plain, and clicking away from an unsaved file shows the prompt.

## Step L3: Planning to Wiki (📚)
Build:
- An `openPath(path)` navigation hook on `ViewContext` and an `open(path)` method on each `View` (`src/client/views/types.ts`), wired in `src/client/main.ts` (tab switching at lines 81-83 uses `location.hash`).
- The Wiki view exposes `go` (wiki.ts line 91) through `open`.
- Planning's resolver falls back to wiki pages: it needs the wiki index, so share the page list that wiki.ts loads with `fetchWikiPages` (`api.ts`), for example a small shared link directory module that both views read.
- `render` options gain a marker callback so links into the other area get ` 📚` after the label (`markdown.ts`, link rendering lines 59-66). Marker is added at render time only.
Automated: resolver tests for planning-first then wiki fallback; renderer tests for the marker (present for wiki targets, absent for planning targets, absent in code spans).
Author tests: `[[aster]]` in a planning note shows 📚 and opens the wiki page on the Wiki tab; Back still works there; unsaved Planning text survives the switch.

## Step L4: Wiki to Planning (📋)
Build: the Wiki's resolver falls back to planning files after wiki pages (wiki.ts line 79 `resolveWikiLink`). Clicks on a planning target call `openPath`. Add ` 📋` after the label for those links, in the preview and in the **Links out** panel (wiki.ts `renderLinks`, lines 144-183). A link matching neither area stays red and still offers wiki page creation (`createFromLink`, line 204).
Automated: renderer tests for the 📋 marker; resolver tests for wiki-first then planning.
Author tests: add `[[threads]]` to a scratch wiki page: it shows 📋, opens the planning file on the Planning tab, and appears with 📋 in Links out. `[[brand-new-name]]` is still red and offers to create a page. A name that exists in both areas opens the wiki page.

## Step L5: Docs and finish
Build: update the `?` help text (`showHelp` in `main.ts`), the Planning and Wiki parts of README.md, and fill in handoff.md. On the author's approval, copy handoff.md into coding-log.md and reset design.md, plan.md, and handoff.md to templates.
Author tests: read them.

## Risks
- L3 changes how views talk to each other and is the biggest change. L1 and L2 stand alone and are safe.
- The same name in both areas could surprise; the own-area-first rule is an assistant default the author may change.
- A renamed or missing file turns a link red until the next window focus refreshes the file lists.
