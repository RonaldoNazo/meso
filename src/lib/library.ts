import {parseDelimited} from './csv';
import {getStoredDump, listStoredDumps, putStoredDump} from './db';
import {questionsFromTable} from './normalize';
import type {Dump, DumpMeta, LibraryIndex} from './types';

/**
 * Where dumps come from. Defaults to the copy generated into the site from the
 * repository's `library/` folder. Set VITE_LIBRARY_URL to point at an S3 or CDN
 * bucket with the same index.json + dumps/ layout instead.
 */
export const LIBRARY_BASE = (
  (import.meta.env.VITE_LIBRARY_URL as string | undefined) || `${import.meta.env.BASE_URL}library`
).replace(/\/+$/, '');

let indexCache: DumpMeta[] | null = null;

export async function loadLibraryIndex(force = false): Promise<DumpMeta[]> {
  if (indexCache && !force) return indexCache;
  const response = await fetch(`${LIBRARY_BASE}/index.json`, {cache: 'no-cache'});
  if (!response.ok) {
    throw new Error(`Could not load the dump index (HTTP ${response.status}).`);
  }
  const data = (await response.json()) as LibraryIndex;
  if (!data || !Array.isArray(data.dumps)) {
    throw new Error('The dump index is malformed.');
  }
  indexCache = data.dumps
    .filter(meta => meta && typeof meta.id === 'string' && meta.count > 0)
    .map(meta => ({...meta, source: 'library' as const}));
  return indexCache;
}

export function clearIndexCache(): void {
  indexCache = null;
}

export async function loadLibraryDump(meta: DumpMeta): Promise<Dump> {
  const key = `lib:${meta.id}`;
  const cached = await getStoredDump(key);
  if (cached && cached.version === meta.url) {
    return cached.dump;
  }

  const response = await fetch(`${LIBRARY_BASE}/${meta.url}`);
  if (!response.ok) {
    throw new Error(`Could not download "${meta.title}" (HTTP ${response.status}).`);
  }
  const text = await response.text();
  const table = parseDelimited(text);
  const {questions, issues} = questionsFromTable(table);
  if (questions.length === 0) {
    throw new Error(
      `"${meta.title}" has no readable questions. ${issues[0]?.message ?? 'Check the file format.'}`,
    );
  }

  const dump: Dump = {
    ...meta,
    count: questions.length,
    questions,
    source: 'library',
  };
  await putStoredDump({key, dump, savedAt: Date.now(), version: meta.url});
  return dump;
}

/** Local imports win, then cached library dumps, then the live index. */
export async function findDump(id: string): Promise<{dump: Dump; meta?: DumpMeta} | null> {
  const local = await getStoredDump(`local:${id}`);
  if (local) return {dump: local.dump};

  const cached = await getStoredDump(`lib:${id}`);
  const index = await loadLibraryIndex();
  const meta = index.find(entry => entry.id === id);
  if (!meta) return cached ? {dump: cached.dump} : null;
  return {dump: await loadLibraryDump(meta), meta};
}

export async function localDumps(): Promise<Dump[]> {
  const stored = await listStoredDumps();
  return stored.map(entry => entry.dump).filter(dump => dump.source === 'local');
}
