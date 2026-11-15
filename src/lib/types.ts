export type QuestionType = 'single_choice' | 'multi_choice' | 'true_false' | 'short_answer';

export interface Question {
  /** Stable hash of type + stem + options. Progress is keyed by this. */
  id: string;
  type: QuestionType;
  stem: string;
  options: string[];
  /** Indices into `options`. Empty for short_answer. */
  answer: number[];
  explanation: string;
  tags: string[];
  reference?: string;
}

export interface DumpMeta {
  id: string;
  title: string;
  university: string;
  uniSlug: string;
  course?: string;
  year?: string;
  tags: string[];
  count: number;
  updatedAt: string;
  license?: string;
  /** Relative to the library base URL. Empty for locally imported dumps. */
  url: string;
  source: 'library' | 'local';
}

export interface Dump extends DumpMeta {
  questions: Question[];
}

export interface LibraryIndex {
  schema: string;
  generatedAt: string;
  dumps: DumpMeta[];
}

export interface ProgressRecord {
  attempts: number;
  correct: number;
  wrong: number;
  lastCorrect: boolean;
  lastSeenAt: number;
  /** Dumps this question has been answered in (it can appear in several). */
  dumps: string[];
  flagged?: boolean;
}

export interface SessionAnswer {
  qid: string;
  picked: number[];
  correct: boolean;
  at: number;
}

export interface Session {
  id: string;
  dumpId: string;
  ids: string[];
  answers: SessionAnswer[];
  createdAt: number;
  finishedAt?: number;
}

export type PracticeMode = 'mixed' | 'unseen' | 'wrong' | 'flagged';

export interface ParseIssue {
  row: number;
  level: 'error' | 'warning';
  message: string;
}
