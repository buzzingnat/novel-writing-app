// Back/forward history for the Wiki view, like a browser's.

export interface NavHistory {
  current(): string | null;
  /** Records a newly opened page, dropping any forward entries. */
  push(path: string): void;
  peekBack(): string | null;
  peekForward(): string | null;
  /** Call after the page from peekBack/peekForward actually opened. */
  moveBack(): void;
  moveForward(): void;
}

export function createHistory(): NavHistory {
  const entries: string[] = [];
  let position = -1;
  return {
    current: () => entries[position] ?? null,
    push(path) {
      if (entries[position] === path) return;
      entries.splice(position + 1);
      entries.push(path);
      position = entries.length - 1;
    },
    peekBack: () => entries[position - 1] ?? null,
    peekForward: () => entries[position + 1] ?? null,
    moveBack() {
      if (position > 0) position -= 1;
    },
    moveForward() {
      if (position < entries.length - 1) position += 1;
    },
  };
}
