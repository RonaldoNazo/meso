import {openDB, type DBSchema, type IDBPDatabase} from 'idb';
import type {Dump, ProgressRecord, Session} from './types';

export interface StoredDump {
  key: string;
  dump: Dump;
  savedAt: number;
  version?: string;
}

interface MesoDB extends DBSchema {
  packs: {key: string; value: StoredDump};
  progress: {key: string; value: ProgressRecord};
  sessions: {key: string; value: Session};
}

let dbPromise: Promise<IDBPDatabase<MesoDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<MesoDB>> {
  if (!dbPromise) {
    dbPromise = openDB<MesoDB>('meso', 1, {
      upgrade(db) {
        db.createObjectStore('packs');
        db.createObjectStore('progress');
        db.createObjectStore('sessions');
      },
    });
  }
  return dbPromise;
}

export async function getStoredDump(key: string): Promise<StoredDump | undefined> {
  return (await getDb()).get('packs', key);
}

export async function putStoredDump(entry: StoredDump): Promise<void> {
  await (await getDb()).put('packs', entry, entry.key);
}

export async function deleteStoredDump(key: string): Promise<void> {
  await (await getDb()).delete('packs', key);
}

export async function listStoredDumps(): Promise<StoredDump[]> {
  const all = await (await getDb()).getAll('packs');
  return all.sort((a, b) => b.savedAt - a.savedAt);
}

export async function readAllProgress(): Promise<Map<string, ProgressRecord>> {
  const db = await getDb();
  const keys = await db.getAllKeys('progress');
  const values = await db.getAll('progress');
  const map = new Map<string, ProgressRecord>();
  keys.forEach((key, index) => map.set(String(key), values[index]));
  return map;
}

export async function writeProgress(qid: string, record: ProgressRecord): Promise<void> {
  await (await getDb()).put('progress', record, qid);
}

export async function getSession(id: string): Promise<Session | undefined> {
  return (await getDb()).get('sessions', id);
}

export async function putSession(session: Session): Promise<void> {
  await (await getDb()).put('sessions', session, session.id);
}

export async function listSessions(): Promise<Session[]> {
  const all = await (await getDb()).getAll('sessions');
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteSession(id: string): Promise<void> {
  await (await getDb()).delete('sessions', id);
}

export async function clearEverything(): Promise<void> {
  const db = await getDb();
  await Promise.all([db.clear('packs'), db.clear('progress'), db.clear('sessions')]);
}
