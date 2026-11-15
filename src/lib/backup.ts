import {readAllProgress, writeProgress} from './db';
import type {ProgressRecord} from './types';

interface Backup {
  app: 'meso';
  kind: 'progress-backup';
  version: 1;
  exportedAt: string;
  progress: Array<[string, ProgressRecord]>;
}

export async function exportProgress(): Promise<void> {
  const map = await readAllProgress();
  const backup: Backup = {
    app: 'meso',
    kind: 'progress-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    progress: [...map.entries()],
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `meso-progress-${backup.exportedAt.slice(0, 10)}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function importProgress(file: File): Promise<number> {
  const data = (await JSON.parse(await file.text())) as Partial<Backup>;
  if (data.app !== 'meso' || data.kind !== 'progress-backup' || !Array.isArray(data.progress)) {
    throw new Error('That is not a Meso progress backup.');
  }

  const current = await readAllProgress();
  let merged = 0;

  for (const entry of data.progress) {
    if (!Array.isArray(entry) || entry.length !== 2) continue;
    const [qid, incoming] = entry;
    if (typeof qid !== 'string' || !incoming || typeof incoming.attempts !== 'number') continue;
    const existing = current.get(qid);
    const next: ProgressRecord = existing
      ? {
          attempts: Math.max(existing.attempts, incoming.attempts),
          correct: Math.max(existing.correct, incoming.correct),
          wrong: Math.max(existing.wrong, incoming.wrong),
          lastCorrect: incoming.lastSeenAt > existing.lastSeenAt ? incoming.lastCorrect : existing.lastCorrect,
          lastSeenAt: Math.max(existing.lastSeenAt, incoming.lastSeenAt),
          dumps: [...new Set([...existing.dumps, ...incoming.dumps])],
          flagged: Boolean(existing.flagged || incoming.flagged),
        }
      : incoming;
    await writeProgress(qid, next);
    merged++;
  }

  return merged;
}
