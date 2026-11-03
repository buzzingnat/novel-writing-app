import "./style.css";
import { saveFile } from "./api.ts";
import { showHelp } from "./dialog.ts";
import { createDocumentStore, DEFAULT_AUTOSAVE_MS, docStatus, startAutosave, statusLabel } from "./documents.ts";
import { loadSetting, saveSetting } from "./storage.ts";
import { createManuscriptView } from "./views/manuscript.ts";
import { createPlanningView } from "./views/planning.ts";
import type { View, ViewContext } from "./views/types.ts";
import { createWikiView } from "./views/wiki.ts";

type ViewName = "planning" | "wiki" | "manuscript";

const VIEWS: { name: ViewName; label: string; create: (ctx: ViewContext) => View }[] = [
  { name: "planning", label: "Planning", create: createPlanningView },
  { name: "wiki", label: "Wiki", create: createWikiView },
  { name: "manuscript", label: "Manuscript", create: createManuscriptView },
];

function isViewName(value: string): value is ViewName {
  return VIEWS.some((view) => view.name === value);
}

function currentViewName(): ViewName {
  const fromHash = location.hash.slice(1);
  if (isViewName(fromHash)) return fromHash;
  const remembered = loadSetting<string>("view", "planning");
  return isViewName(remembered) ? remembered : "planning";
}

/** For testing autosave: open the app with ?autosave=10 to save every 10 seconds instead of 5 minutes. */
function autosaveInterval(): number {
  const seconds = Number(new URLSearchParams(location.search).get("autosave"));
  return Number.isFinite(seconds) && seconds >= 5 ? seconds * 1000 : DEFAULT_AUTOSAVE_MS;
}

const formatTime = (ms: number): string => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function start(): void {
  const root = document.getElementById("app");
  if (!root) return;

  const header = document.createElement("header");
  header.className = "topbar";
  const nav = document.createElement("nav");
  nav.className = "tabs";
  nav.setAttribute("role", "tablist");
  const status = document.createElement("span");
  status.className = "save-status";
  status.setAttribute("aria-live", "polite");
  const tools = document.createElement("div");
  tools.className = "topbar-tools";
  const help = document.createElement("button");
  help.type = "button";
  help.className = "help-button";
  help.textContent = "?";
  help.title = "Keyboard shortcuts and tips";
  help.setAttribute("aria-label", "Keyboard shortcuts and tips");
  help.addEventListener("click", showHelp);
  header.append(nav, tools, status, help);
  const main = document.createElement("main");
  main.className = "view";
  root.replaceChildren(header, main);

  const store = createDocumentStore(saveFile);
  const views = new Map<ViewName, View>();
  let active: View | null = null;

  const refreshStatus = (): void => {
    const path = active?.activePath() ?? null;
    const doc = path ? store.get(path) : undefined;
    status.textContent = statusLabel(doc, formatTime);
    status.dataset.status = doc ? docStatus(doc) : "";
  };
  const ctx: ViewContext = { store, refreshStatus };
  store.subscribe(refreshStatus);

  const tabs = new Map<ViewName, HTMLButtonElement>();
  for (const view of VIEWS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tab";
    button.textContent = view.label;
    button.setAttribute("role", "tab");
    button.addEventListener("click", () => {
      location.hash = view.name;
    });
    tabs.set(view.name, button);
    nav.append(button);
  }

  // Each view is built once and kept, so switching tabs never loses unsaved text.
  const show = (): void => {
    const name = currentViewName();
    saveSetting("view", name);
    for (const [tabName, button] of tabs) {
      const isActive = tabName === name;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-selected", String(isActive));
    }
    let view = views.get(name);
    if (!view) {
      view = VIEWS.find((entry) => entry.name === name)?.create(ctx);
      if (!view) return;
      views.set(name, view);
      main.append(view.element);
    }
    for (const other of views.values()) other.element.hidden = other !== view;
    tools.replaceChildren(...(view.toolbar ? [view.toolbar] : []));
    active = view;
    main.dataset.view = name;
    refreshStatus();
  };

  window.addEventListener("hashchange", show);
  show();

  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void active?.save();
    }
  });

  window.addEventListener("beforeunload", (event) => {
    if (store.dirtyPaths().length > 0) event.preventDefault();
  });

  startAutosave(store, autosaveInterval());
}

start();
