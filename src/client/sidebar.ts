import type { SidebarSection } from "./sidebar-model.ts";
import { loadSetting, saveSetting } from "./storage.ts";

export interface Sidebar {
  element: HTMLElement;
  render(sections: SidebarSection[]): void;
  /** Highlights the open file, expanding its section if it was collapsed. */
  setActive(path: string | null): void;
}

export interface SidebarOptions {
  /** Remembers collapsed sections separately for each view. */
  viewKey: string;
  ariaLabel: string;
  onSelect(path: string): void;
}

export function createSidebar(options: SidebarOptions): Sidebar {
  const element = document.createElement("nav");
  element.className = "sidebar";
  element.setAttribute("aria-label", options.ariaLabel);

  let sections: SidebarSection[] = [];
  let active: string | null = null;

  const openKey = (id: string): string => `sidebar-open:${options.viewKey}:${id}`;
  const isOpen = (section: SidebarSection): boolean =>
    !section.collapsible || loadSetting<boolean>(openKey(section.id), section.defaultOpen);

  function render(next: SidebarSection[] = sections): void {
    sections = next;
    element.replaceChildren(...sections.map(renderSection));
  }

  function renderSection(section: SidebarSection): HTMLElement {
    const wrapper = document.createElement("section");
    wrapper.className = "sidebar-section";
    const open = isOpen(section);

    if (section.title !== null) {
      const heading = document.createElement(section.collapsible ? "button" : "div");
      heading.className = "sidebar-heading";
      if (heading instanceof HTMLButtonElement) {
        heading.type = "button";
        heading.setAttribute("aria-expanded", String(open));
        heading.textContent = `${open ? "▾" : "▸"} ${section.title} (${section.items.length})`;
        heading.addEventListener("click", () => {
          saveSetting(openKey(section.id), !open);
          render();
        });
      } else {
        heading.textContent = section.title;
      }
      wrapper.append(heading);
    }

    if (open) {
      const list = document.createElement("ul");
      list.className = "sidebar-list";
      for (const item of section.items) {
        const li = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "sidebar-item";
        button.textContent = item.label;
        if (item.hint) button.title = item.hint;
        if (item.path === null) {
          button.disabled = true;
          button.classList.add("not-started");
        } else {
          const path = item.path;
          if (path === active) button.setAttribute("aria-current", "page");
          button.addEventListener("click", () => options.onSelect(path));
        }
        li.append(button);
        list.append(li);
      }
      wrapper.append(list);
    }
    return wrapper;
  }

  return {
    element,
    render,
    setActive(path) {
      // Only expand on a newly opened file, so a section the author collapsed stays collapsed on refresh.
      if (path !== active) {
        const holder = sections.find((section) => section.items.some((item) => item.path === path));
        if (holder?.collapsible && !isOpen(holder)) saveSetting(openKey(holder.id), true);
      }
      active = path;
      render();
    },
  };
}
