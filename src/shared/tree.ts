// Groups the novel's Markdown files into what each view's sidebar shows.
// Rules are from design.md ("Finalized design").

export interface SnowflakeStep {
  step: number;
  label: string;
  /** File name the Snowflake process expects, from AGENTS.md. */
  expectedFile: string;
  /** Actual path when a planning file has this step's number prefix; null means not started. */
  path: string | null;
}

export interface Tree {
  planning: {
    progress: string | null;
    steps: SnowflakeStep[];
    tracking: string[];
    notes: string[];
    archive: string[];
  };
  wiki: {
    pinned: string[];
    folders: { name: string; files: string[] }[];
    /** Wiki files directly in wiki/ that aren't pinned (README and so on). */
    other: string[];
    templates: string[];
  };
  manuscript: {
    chapters: string[];
  };
}

export const SNOWFLAKE_STEPS: { step: number; label: string; expectedFile: string }[] = [
  { step: 0, label: "Story bible", expectedFile: "00-story-bible.md" },
  { step: 1, label: "One sentence", expectedFile: "01-one-sentence.md" },
  { step: 2, label: "One paragraph", expectedFile: "02-one-paragraph.md" },
  { step: 3, label: "Character summaries", expectedFile: "03-character-summaries.md" },
  { step: 4, label: "One-page synopsis", expectedFile: "04-one-page-synopsis.md" },
  { step: 5, label: "Character descriptions", expectedFile: "05-character-descriptions.md" },
  { step: 6, label: "Four-page synopsis", expectedFile: "06-four-page-synopsis.md" },
  { step: 7, label: "Character charts", expectedFile: "07-character-charts.md" },
  { step: 8, label: "Scene list", expectedFile: "08-scene-list.md" },
  { step: 9, label: "Scene descriptions", expectedFile: "09-scene-descriptions.md" },
];

export const TRACKING_FILES = ["threads.md", "theme-map.md", "structure-toolbox.md", "outline-status.md"];

export const PINNED_WIKI_FILES = ["wiki/timeline.md", "wiki/open-questions.md"];

/** Builds the sidebar tree from every editable Markdown path in the novel folder. */
export function buildTree(paths: string[]): Tree {
  const sorted = [...paths].sort((a, b) => a.localeCompare(b));
  const planningTop: string[] = [];
  const archive: string[] = [];
  const wikiFolders = new Map<string, string[]>();
  const wikiOther: string[] = [];
  const templates: string[] = [];
  const chapters: string[] = [];

  for (const rel of sorted) {
    const parts = rel.split("/");
    const [top, second] = parts;
    if (top === "planning" && parts.length === 2) planningTop.push(rel);
    else if (top === "planning" && second === "archive" && parts.length === 3) archive.push(rel);
    else if (top === "manuscript" && parts.length === 2) chapters.push(rel);
    else if (top === "wiki" && parts.length === 2) {
      if (!PINNED_WIKI_FILES.includes(rel)) wikiOther.push(rel);
    } else if (top === "wiki" && second === "_templates") templates.push(rel);
    else if (top === "wiki" && second !== undefined) {
      const files = wikiFolders.get(second) ?? [];
      files.push(rel);
      wikiFolders.set(second, files);
    }
  }

  const stepPaths = new Set<string>();
  const steps = SNOWFLAKE_STEPS.map((info): SnowflakeStep => {
    const prefix = `planning/${String(info.step).padStart(2, "0")}-`;
    const found = planningTop.find((rel) => rel.startsWith(prefix)) ?? null;
    if (found) stepPaths.add(found);
    return { ...info, path: found };
  });

  const tracking = TRACKING_FILES.map((name) => `planning/${name}`).filter((rel) => planningTop.includes(rel));
  const notes = planningTop.filter((rel) => !stepPaths.has(rel) && !tracking.includes(rel));

  return {
    planning: {
      progress: sorted.includes("progress.md") ? "progress.md" : null,
      steps,
      tracking,
      notes,
      archive,
    },
    wiki: {
      pinned: PINNED_WIKI_FILES.filter((rel) => sorted.includes(rel)),
      folders: [...wikiFolders].map(([name, files]) => ({ name, files })),
      other: wikiOther,
      templates,
    },
    manuscript: { chapters },
  };
}
