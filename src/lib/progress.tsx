import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {readAllProgress, writeProgress} from './db';
import type {ProgressRecord} from './types';

export interface ProgressApi {
  ready: boolean;
  map: Map<string, ProgressRecord>;
  recordAnswer: (qid: string, dumpId: string, correct: boolean) => void;
  setFlag: (qid: string, dumpId: string, flagged: boolean) => void;
  reload: () => Promise<void>;
}

const ProgressContext = createContext<ProgressApi | null>(null);

export function ProgressProvider({children}: {children: ReactNode}) {
  const [map, setMap] = useState<Map<string, ProgressRecord>>(() => new Map());
  const [ready, setReady] = useState(false);
  const mapRef = useRef(map);
  mapRef.current = map;

  const reload = useCallback(async () => {
    const next = await readAllProgress();
    mapRef.current = next;
    setMap(next);
    setReady(true);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const recordAnswer = useCallback((qid: string, dumpId: string, correct: boolean) => {
    const current = mapRef.current;
    const previous = current.get(qid);
    const next: ProgressRecord = {
      attempts: (previous?.attempts ?? 0) + 1,
      correct: (previous?.correct ?? 0) + (correct ? 1 : 0),
      wrong: (previous?.wrong ?? 0) + (correct ? 0 : 1),
      lastCorrect: correct,
      lastSeenAt: Date.now(),
      dumps: previous?.dumps.includes(dumpId) ? previous.dumps : [...(previous?.dumps ?? []), dumpId],
      flagged: previous?.flagged,
    };
    const updated = new Map(current);
    updated.set(qid, next);
    mapRef.current = updated;
    setMap(updated);
    void writeProgress(qid, next);
  }, []);

  const setFlag = useCallback((qid: string, dumpId: string, flagged: boolean) => {
    const current = mapRef.current;
    const previous = current.get(qid);
    const next: ProgressRecord = {
      attempts: previous?.attempts ?? 0,
      correct: previous?.correct ?? 0,
      wrong: previous?.wrong ?? 0,
      lastCorrect: previous?.lastCorrect ?? false,
      lastSeenAt: previous?.lastSeenAt ?? Date.now(),
      dumps: previous?.dumps.includes(dumpId) ? previous.dumps : [...(previous?.dumps ?? []), dumpId],
      flagged,
    };
    const updated = new Map(current);
    updated.set(qid, next);
    mapRef.current = updated;
    setMap(updated);
    void writeProgress(qid, next);
  }, []);

  const value = useMemo<ProgressApi>(
    () => ({ready, map, recordAnswer, setFlag, reload}),
    [ready, map, recordAnswer, setFlag, reload],
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressApi {
  const context = useContext(ProgressContext);
  if (!context) throw new Error('useProgress must be used inside ProgressProvider');
  return context;
}
