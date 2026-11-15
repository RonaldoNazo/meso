import {shuffle} from './hash';
import type {PracticeMode, ProgressRecord, Question} from './types';

export interface PickerOptions {
  mode: PracticeMode;
  count: number;
}

/**
 * Unseen-first selection: a session never re-shows a question the student has
 * already answered until the untouched pool is used up, then it serves
 * previously-wrong ones before previously-correct ones.
 */
export function pickQuestionIds(
  questions: Question[],
  progress: Map<string, ProgressRecord>,
  {mode, count}: PickerOptions,
): string[] {
  const unseen: Question[] = [];
  const wrong: Question[] = [];
  const correct: Question[] = [];
  const flagged: Question[] = [];

  for (const question of questions) {
    const record = progress.get(question.id);
    if (!record || record.attempts === 0) unseen.push(question);
    else if (record.lastCorrect) correct.push(question);
    else wrong.push(question);
    if (record?.flagged) flagged.push(question);
  }

  let pool: Question[];
  switch (mode) {
    case 'unseen':
      pool = shuffle(unseen);
      break;
    case 'wrong':
      pool = shuffle(wrong);
      break;
    case 'flagged':
      pool = shuffle(flagged);
      break;
    default:
      pool = [...shuffle(unseen), ...shuffle(wrong), ...shuffle(correct)];
  }

  const take = Math.max(1, Math.min(count, pool.length));
  return shuffle(pool.slice(0, take)).map(question => question.id);
}

export function scorePicked(question: Question, picked: number[]): boolean {
  if (question.type === 'short_answer') return false;
  if (question.answer.length !== picked.length) return false;
  const a = [...question.answer].sort((x, y) => x - y);
  const b = [...picked].sort((x, y) => x - y);
  return a.every((value, index) => value === b[index]);
}

export function formatAnswer(question: Question): string {
  if (question.type === 'short_answer') return 'See the answer';
  if (question.type === 'true_false') return question.answer[0] === 0 ? 'True' : 'False';
  return question.answer
    .map(index => String.fromCharCode(65 + index))
    .join(', ');
}

export function optionLetter(index: number): string {
  return String.fromCharCode(65 + index);
}
