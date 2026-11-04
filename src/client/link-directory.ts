// The wiki's page index, shared so the Planning view can link to wiki pages even before the Wiki tab is opened.
import { buildWikiIndex, type WikiIndex } from "../shared/wikilinks.ts";
import { fetchWikiPages } from "./api.ts";

let wikiIndex: WikiIndex = buildWikiIndex([]);

export const getWikiIndex = (): WikiIndex => wikiIndex;

/** The Wiki view calls this whenever it rebuilds its own index, so both views agree. */
export function setWikiIndex(index: WikiIndex): void {
  wikiIndex = index;
}

/** Reads the wiki pages from disk and rebuilds the shared index. */
export async function refreshWikiIndex(): Promise<void> {
  const pages = await fetchWikiPages();
  wikiIndex = buildWikiIndex(pages.map((page) => ({ path: page.path, text: page.content })));
}
