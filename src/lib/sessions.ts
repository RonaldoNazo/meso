import {putSession} from './db';
import {hash53} from './hash';
import {pickQuestionIds} from './practice';
import type {Dump, PracticeMode, ProgressRecord, Session} from './types';

export async function createSession(
  dump: Dump,
  progress: Map<string, ProgressRecord>,
  mode: PracticeMode,
  count: number,
): Promise<Session> {
  const ids = pickQuestionIds(dump.questions, progress, {mode, count});
  if (ids.length === 0) throw new Error('No questions match that filter yet.');
  const session: Session = {
    id: `s${Date.now().toString(36)}${hash53(`${dump.id}|${ids.join(',')}`).slice(0, 4)}`,
    dumpId: dump.id,
    ids,
    answers: [],
    createdAt: Date.now(),
  };
  await putSession(session);
  return session;
}

export async function createRetrySession(dumpId: string, ids: string[]): Promise<Session> {
  const session: Session = {
    id: `s${Date.now().toString(36)}${hash53(`${dumpId}|${ids.join(',')}|retry`).slice(0, 4)}`,
    dumpId,
    ids,
    answers: [],
    createdAt: Date.now(),
  };
  await putSession(session);
  return session;
}
