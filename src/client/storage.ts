// localStorage can be missing or throw (private windows, blocked site data).
// Remembered UI state is a convenience, so failures fall back to the default.

export function loadSetting<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`novel2026:${key}`);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function saveSetting(key: string, value: unknown): void {
  try {
    localStorage.setItem(`novel2026:${key}`, JSON.stringify(value));
  } catch {
    // Ignore: the setting just won't be remembered.
  }
}
