import type {ProgressRecord} from './types';

export interface DumpStats {
  done: number;
  correct: number;
  wrong: number;
  flagged: number;
}

export function statsForDump(progress: Map<string, ProgressRecord>, dumpId: string): DumpStats {
  let done = 0;
  let correct = 0;
  let wrong = 0;
  let flagged = 0;
  for (const record of progress.values()) {
    if (!record.dumps.includes(dumpId)) continue;
    done++;
    if (record.lastCorrect) correct++;
    else wrong++;
    if (record.flagged) flagged++;
  }
  return {done, correct, wrong, flagged};
}

export interface OverallStats {
  done: number;
  correct: number;
  wrong: number;
  flagged: number;
  accuracy: number;
}

export function overallStats(progress: Map<string, ProgressRecord>): OverallStats {
  let done = 0;
  let correct = 0;
  let wrong = 0;
  let flagged = 0;
  for (const record of progress.values()) {
    if (record.attempts === 0) continue;
    done++;
    if (record.lastCorrect) correct++;
    else wrong++;
    if (record.flagged) flagged++;
  }
  return {
    done,
    correct,
    wrong,
    flagged,
    accuracy: done === 0 ? 0 : Math.round((correct / done) * 100),
  };
}

export function percent(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((done / total) * 100));
}

export interface AggregateStats {
  done: number;
  total: number;
  wrong: number;
  flagged: number;
  categories: number;
}

export function aggregateStats(
  progress: Map<string, ProgressRecord>,
  dumps: ReadonlyArray<{id: string; count: number}>,
): AggregateStats {
  let done = 0;
  let total = 0;
  let wrong = 0;
  let flagged = 0;
  for (const dump of dumps) {
    const stats = statsForDump(progress, dump.id);
    done += stats.done;
    wrong += stats.wrong;
    flagged += stats.flagged;
    total += dump.count;
  }
  return {done, total, wrong, flagged, categories: dumps.length};
}
