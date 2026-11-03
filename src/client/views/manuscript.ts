import { chapterNumber, chapterTitle } from "../../shared/chapters.ts";
import { formatDay, formatNet } from "../../shared/daily-log.ts";
import { countWords, formatCount, formatShortCount } from "../../shared/wordcount.ts";
import { createChapter, fetchChapters, fetchWordLog, type ChapterSummary, type WordLogSummary } from "../api.ts";
import { askText } from "../dialog.ts";
import { createSplitEditor } from "../editor.ts";
import { loadSetting, saveSetting } from "../storage.ts";
import type { View, ViewContext } from "./types.ts";

const LAST_FILE_KEY = "last-file:manuscript";
const CHAPTERS_SHOWN_KEY = "manuscript:chapters-shown";
const DAILY_OPEN_KEY = "manuscript:daily-open";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));
const words = (count: number): string => `${formatCount(count)} ${count === 1 ? "word" : "words"}`;

export function createManuscriptView(ctx: ViewContext): View {
  const element = el("div", "manuscript-layout");
  let chaptersShown = loadSetting<boolean>(CHAPTERS_SHOWN_KEY, false);
  let chapters: ChapterSummary[] = [];

  // Top-bar toggle for the chapter list (hidden by default: focus mode).
  const toggle = el("button", "toggle", "Chapters");
  toggle.type = "button";
  toggle.title = "Show or hide the chapter list (⌘\\)";
  const toolbar = el("div", "manuscript-tools");
  toolbar.append(toggle);

  const list = el("nav", "chapter-list");
  list.setAttribute("aria-label", "Chapters");
  const items = el("ul", "sidebar-list");
  const newButton = el("button", "new-chapter", "+ New chapter");
  newButton.type = "button";
  const total = el("div", "chapter-total");
  const daily = el("section", "daily");
  list.append(items, newButton, total, daily);
  let wordLog: WordLogSummary | null = null;
  let dailyOpen = loadSetting<boolean>(DAILY_OPEN_KEY, false);

  const editor = createSplitEditor({
    store: ctx.store,
    viewKey: "manuscript",
    emptyMessage: "No chapters yet. Show the chapter list and click “+ New chapter” to start.",
    onPathChange: () => {
      ctx.refreshStatus();
      updateStatusLine();
    },
    className: "prose-editor",
  });

  const main = el("div", "manuscript-main");
  const statusLine = el("footer", "manuscript-status");
  statusLine.setAttribute("aria-live", "polite");
  main.append(editor.element, statusLine);
  element.append(list, main);

  const applyShown = (): void => {
    element.dataset.chapters = chaptersShown ? "shown" : "hidden";
    toggle.setAttribute("aria-pressed", String(chaptersShown));
  };
  const setShown = (shown: boolean): void => {
    chaptersShown = shown;
    saveSetting(CHAPTERS_SHOWN_KEY, shown);
    applyShown();
  };
  toggle.addEventListener("click", () => setShown(!chaptersShown));
  document.addEventListener("keydown", (event) => {
    if (element.hidden) return;
    if ((event.metaKey || event.ctrlKey) && event.key === "\\") {
      event.preventDefault();
      setShown(!chaptersShown);
    }
  });
  applyShown();

  function renderList(): void {
    const current = editor.currentPath();
    items.replaceChildren(
      ...chapters.map((chapter) => {
        const li = document.createElement("li");
        const button = el("button", "sidebar-item chapter-item");
        button.type = "button";
        button.title = chapter.path;
        const number = chapterNumber(chapter.path);
        button.append(
          el("span", "chapter-name", number === null ? chapter.title : `${number} ${chapter.title}`),
          el("span", "chapter-count", formatShortCount(chapter.words)),
        );
        if (chapter.path === current) button.setAttribute("aria-current", "page");
        button.addEventListener("click", () => void openChapter(chapter.path));
        li.append(button);
        return li;
      }),
    );
    const sum = chapters.reduce((acc, chapter) => acc + chapter.words, 0);
    total.textContent = `Total ${formatCount(sum)}`;
  }

  // Live count for the open chapter, from the editor text (not the last save).
  let statusQueued = false;
  function updateStatusLine(): void {
    if (statusQueued) return;
    statusQueued = true;
    requestAnimationFrame(() => {
      statusQueued = false;
      const path = editor.currentPath();
      const doc = path ? ctx.store.get(path) : undefined;
      if (!path || !doc) {
        statusLine.textContent = "";
        return;
      }
      const number = chapterNumber(path);
      const label = number === null ? "" : `Ch ${number} `;
      const today = wordLog?.days[0];
      const todayText = today ? ` · today ${formatNet(today.net)}` : "";
      statusLine.textContent = `${label}“${chapterTitle(doc.text, path)}” · ${words(countWords(doc.text))}${todayText}`;
    });
  }

  // DAILY: net words per day, below the total. Collapsed, it shows only today on the heading.
  function renderDaily(): void {
    if (!wordLog) {
      daily.replaceChildren();
      return;
    }
    const { today, days } = wordLog;
    const heading = el("button", "sidebar-heading daily-heading");
    heading.type = "button";
    heading.setAttribute("aria-expanded", String(dailyOpen));
    heading.title = "Net words added each day, counted on every save";
    heading.append(el("span", "", `${dailyOpen ? "▾" : "▸"} Daily`));
    if (!dailyOpen) heading.append(el("span", "daily-net", formatNet(days[0]?.net ?? 0)));
    heading.addEventListener("click", () => {
      dailyOpen = !dailyOpen;
      saveSetting(DAILY_OPEN_KEY, dailyOpen);
      renderDaily();
    });

    const rows: HTMLElement[] = [];
    if (dailyOpen) {
      const list = el("ul", "daily-list");
      for (const day of days) {
        const row = el("li", day.net < 0 ? "daily-row negative" : "daily-row");
        row.append(el("span", "", formatDay(day.date, today)), el("span", "daily-net", formatNet(day.net)));
        row.title = `${day.date}: ${day.net >= 0 ? "+" : ""}${formatCount(day.net)} words`;
        list.append(row);
      }
      rows.push(list);
    }
    daily.replaceChildren(heading, ...rows);
  }

  async function loadWordLog(): Promise<void> {
    try {
      wordLog = await fetchWordLog();
    } catch {
      // Keep showing the last numbers; the next save or focus tries again.
    }
    renderDaily();
    updateStatusLine();
  }

  async function openChapter(path: string): Promise<void> {
    if (!(await editor.open(path))) return;
    saveSetting(LAST_FILE_KEY, path);
    renderList();
  }

  async function loadChapters(): Promise<void> {
    try {
      chapters = await fetchChapters();
      renderList();
    } catch (error) {
      items.replaceChildren(el("li", "links-empty", `Couldn't load chapters: ${errorText(error)}`));
    }
  }

  newButton.addEventListener("click", async () => {
    const title = await askText("New chapter", "Title", "Create");
    if (!title) return;
    try {
      const created = await createChapter(title);
      await Promise.all([loadChapters(), loadWordLog()]);
      await openChapter(created.path);
    } catch (error) {
      window.alert(`Couldn't create the chapter: ${errorText(error)}`);
    }
  });

  // The server updates the daily log on every chapter save; fetch the new numbers after each one.
  const lastSaved = new Map<string, number | null>();
  ctx.store.subscribe((path) => {
    if (!path.startsWith("manuscript/")) return;
    if (path === editor.currentPath()) updateStatusLine();
    const doc = ctx.store.get(path);
    if (doc && doc.savedAt !== null && lastSaved.get(path) !== doc.savedAt) {
      lastSaved.set(path, doc.savedAt);
      void loadWordLog();
    }
    // Chapter-list counts follow saves, not every keystroke.
    const chapter = chapters.find((entry) => entry.path === path);
    if (!doc || !chapter) return;
    const savedWords = countWords(doc.savedText);
    const savedTitle = chapterTitle(doc.savedText, path);
    if (chapter.words !== savedWords || chapter.title !== savedTitle) {
      chapter.words = savedWords;
      chapter.title = savedTitle;
      renderList();
    }
  });

  // Loading the app recounts the manuscript, so the day's baseline updates on app load (design.md).
  void loadWordLog();
  void loadChapters().then(() => {
    const paths = chapters.map((chapter) => chapter.path);
    const remembered = loadSetting<string>(LAST_FILE_KEY, "");
    const first = paths.includes(remembered) ? remembered : paths[0];
    if (first) {
      void openChapter(first);
    } else {
      // Nothing to write in yet: show the list (for "+ New chapter") without changing the remembered choice.
      chaptersShown = true;
      applyShown();
    }
  });

  // Pick up chapters added or changed outside the app when the window comes back into focus.
  window.addEventListener("focus", () => {
    void loadChapters();
    void loadWordLog();
  });

  return { element, toolbar, activePath: editor.currentPath, save: editor.save };
}
