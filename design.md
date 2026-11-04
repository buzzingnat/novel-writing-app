# Current feature: links between Planning and Wiki

Status: **DESIGN FINAL, awaiting go-ahead for plan step L1** (author answered the open questions on 2026-11-04).
Process: this file, plan.md, and handoff.md describe only the feature in progress. When the feature is done, handoff.md is copied into coding-log.md and these three files are reset to their templates. See the Process section of README.md.

## Goal
`[[name]]`, `[[name|label]]`, and `[[name#heading]]` work in the Planning view the way they do in the Wiki, and links can cross between the two areas. Planning files can link to wiki pages, and wiki pages can link to planning files.

## Behavior
**Matching** uses the Wiki's existing rule: file name, ignoring case, spaces, hyphens, underscores, and `.md`, and a path prefix is ignored (`[[archive/x.md]]` matches `x`). In the Wiki, aliases and titles also match, as today.

**Which area wins** when the same name exists in both:
- In a Planning file: planning files first, then wiki pages.
- In a Wiki page: wiki pages first, then planning files.
- Within planning, a file outside `planning/archive/` beats one inside it.
- `progress.md` counts as a planning file. Unstarted Snowflake steps do not match (no file yet).

**Clicking** a link opens the target in its own area. A link into the other area switches tabs (the same as clicking the tab) and opens the file there. The unsaved-changes prompt works as it does for sidebar clicks, and unsaved text in the area you leave is kept.

**Red links**
- Planning: a link that matches nothing is red; clicking it does nothing (author, Q2). The hover text says no file matches.
- Wiki: unchanged. A link that matches no wiki page and no planning file is red, and clicking it offers to create a wiki page from a template.

**Markers (see Style, below):** a link that points into the other area carries an emoji after its label.

**Unchanged:** links in code spans and blocks stay plain text. The Manuscript has no links. Links work only in the preview, never in the source pane.

## Style
- 📋 (U+1F4CB clipboard) goes after the label of every outgoing link, in the Wiki view, that points to a planning file.
- 📚 (U+1F4DA books) goes after the label of every outgoing link, in the Planning view, that points to a wiki page.
- Links within the same area carry no marker.
- Markers appear in the preview and in the Wiki view's **Links out** panel. They are added by the app when rendering; they are never written into the Markdown files.
- Each marker has hover text ("Planning file" or "Wiki page") and is hidden from screen readers, so the link's own label is what is read aloud.
- This convention is recorded in the Style guide section of README.md.

## Decisions
| Topic | Decision | Who / when |
|---|---|---|
| Wiki pages from Planning | Yes: `[[aster]]` in a planning file opens the wiki page | Author, 2026-11-04 (Q1) |
| Red link in Planning | Does nothing when clicked | Author, 2026-11-04 (Q2, "yes" taken as the recommended option) |
| Existing plain-path mentions in planning files | Left alone; the author edits them by hand | Author, 2026-11-04 (Q3) |
| Wiki links to planning files | Yes, with the 📋 marker | Author, 2026-11-04 (implied by the style request) |
| Markers | 📋 on wiki-to-planning links, 📚 on planning-to-wiki links | Author, 2026-11-04 |
| Which area wins on a name clash | Own area first | Assistant default, not yet confirmed |
| Links panel in Planning | Not added | Assistant default |
| Backlinks in the Wiki panel from planning files | Not added; **Links here** still lists wiki pages only | Assistant default |

## Out of scope
A links-here / links-out panel for Planning; counting planning files in Wiki backlinks; rewriting links when a file is renamed; auto-linking bare paths such as `planning/threads.md`; standard `[text](file.md)` links; creating planning files from red links.

## Existing `[[ ]]` text in planning (checked 2026-11-04)
Five files already use it: `knowledge-loss-research`, `01-one-sentence`, `lost-and-kept-skills`, `archive/evacuation-parked`, and `archive/progress-log`. Links to planning files and wiki pages will work once built. `01-one-sentence.md` links to two archive files that do not exist (`archive/01-one-sentence-drafts.md` and `archive/01-one-sentence-working-notes.md`), so those will show red; the author will fix them by hand.
