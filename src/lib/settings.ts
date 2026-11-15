export type ThemeMode = 'light' | 'dark' | 'system';

export interface Settings {
  theme: ThemeMode;
  count: number;
}

const KEY = 'meso.settings.v1';
const DEFAULT: Settings = {theme: 'system', count: 30};

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      theme: parsed.theme === 'light' || parsed.theme === 'dark' ? parsed.theme : 'system',
      count: typeof parsed.count === 'number' && parsed.count >= 5 && parsed.count <= 200 ? parsed.count : 30,
    };
  } catch {
    return DEFAULT;
  }
}

let current: Settings = read();
const listeners = new Set<() => void>();

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>): void {
  current = {...current, ...patch};
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Storage disabled (private mode): the change still applies for this visit.
  }
  listeners.forEach(listener => listener());
}

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
