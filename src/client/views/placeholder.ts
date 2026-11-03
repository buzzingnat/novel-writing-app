import type { View } from "./types.ts";

/** A stand-in for a view that isn't built yet. */
export function placeholder(title: string, note: string): View {
  const section = document.createElement("section");
  section.className = "placeholder";
  const heading = document.createElement("h1");
  heading.textContent = title;
  const text = document.createElement("p");
  text.textContent = note;
  section.append(heading, text);
  return { element: section, activePath: () => null, save: async () => undefined };
}
