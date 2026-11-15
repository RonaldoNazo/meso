import type {ParsedTable} from './csv';
import {hash53} from './hash';
import type {ParseIssue, Question, QuestionType} from './types';

const TYPE_ALIASES: Record<string, QuestionType> = {
  single_choice: 'single_choice',
  singlechoice: 'single_choice',
  single: 'single_choice',
  mcq: 'single_choice',
  sc: 'single_choice',
  one_answer: 'single_choice',
  choice: 'single_choice',
  multi_choice: 'multi_choice',
  multichoice: 'multi_choice',
  multiple_choice: 'multi_choice',
  multiple: 'multi_choice',
  multiplechoice: 'multi_choice',
  multi: 'multi_choice',
  multi_select: 'multi_choice',
  select_all: 'multi_choice',
  true_false: 'true_false',
  truefalse: 'true_false',
  tf: 'true_false',
  boolean: 'true_false',
  'true/false': 'true_false',
  short_answer: 'short_answer',
  shortanswer: 'short_answer',
  short: 'short_answer',
  open: 'short_answer',
  open_ended: 'short_answer',
  free_text: 'short_answer',
  freetext: 'short_answer',
  essay: 'short_answer',
  text: 'short_answer',
};

const TRUE_WORDS = new Set(['true', 't', 'yes', 'y', '1']);
const FALSE_WORDS = new Set(['false', 'f', 'no', 'n', '0']);

const STEM_KEYS = ['question', 'question_text', 'stem', 'prompt', 'q'];
const TYPE_KEYS = ['question_type', 'type', 'qtype'];
const ANSWER_KEYS = ['correct_answer', 'answer', 'correct', 'correct_option', 'correct_answer_s'];
const EXPLANATION_KEYS = ['explanation', 'rationale', 'answer_text', 'model_answer', 'notes'];
const TAGS_KEYS = ['tags', 'tag', 'topics', 'topic', 'subject'];
const REFERENCE_KEYS = ['reference', 'ref', 'source'];
const OPTION_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

export interface NormalizeResult {
  questions: Question[];
  issues: ParseIssue[];
}

export function questionsFromTable(table: ParsedTable): NormalizeResult {
  const issues: ParseIssue[] = [];
  const questions: Question[] = [];
  const seen = new Map<string, number>();

  const columnIndex = new Map<string, number>();
  table.header.forEach((name, index) => {
    if (!columnIndex.has(name)) columnIndex.set(name, index);
  });

  const column = (...keys: string[]): number => {
    for (const key of keys) {
      const index = columnIndex.get(key);
      if (index !== undefined) return index;
    }
    return -1;
  };

  const stemCol = column(...STEM_KEYS);
  const typeCol = column(...TYPE_KEYS);
  const answerCol = column(...ANSWER_KEYS);
  const explanationCol = column(...EXPLANATION_KEYS);
  const tagsCol = column(...TAGS_KEYS);
  const referenceCol = column(...REFERENCE_KEYS);

  if (stemCol === -1) {
    issues.push({row: 1, level: 'error', message: 'No "question" column found in the header row.'});
    return {questions, issues};
  }

  if (table.rows.length > 20000) {
    issues.push({row: 1, level: 'error', message: 'File has more than 20,000 rows. Split it into several dumps.'});
    return {questions, issues};
  }

  table.rows.forEach((row, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const cell = (index: number): string => (index >= 0 ? (row[index] ?? '').trim() : '');

    if (row.length > table.header.length && row.slice(table.header.length).some(value => value.trim() !== '')) {
      issues.push({
        row: rowNumber,
        level: 'error',
        message: `Row has ${row.length} fields but the header has ${table.header.length} — a field containing a comma probably needs quotes, or use a tab-separated file.`,
      });
      return;
    }

    const stem = tidy(cell(stemCol));
    if (!stem) {
      if (row.some(value => value.trim() !== '')) {
        issues.push({row: rowNumber, level: 'error', message: 'Question text is empty.'});
      }
      return;
    }

    const optionValues = OPTION_LETTERS.map(letter => cell(column(letter)));
    const lastFilled = optionValues.reduce((last, value, index) => (value ? index : last), -1);
    const gap = optionValues.findIndex((value, index) => index <= lastFilled && !value);
    if (gap !== -1) {
      issues.push({
        row: rowNumber,
        level: 'error',
        message: `Option ${OPTION_LETTERS[gap].toUpperCase()} is empty but a later option is filled. Options must be continuous from A.`,
      });
      return;
    }

    let options = optionValues.slice(0, lastFilled + 1);
    const rawAnswer = cell(answerCol);
    const rawType = cell(typeCol).toLowerCase().replace(/\s+/g, '_');
    const declaredType = rawType ? TYPE_ALIASES[rawType] : undefined;

    if (rawType && !declaredType) {
      issues.push({
        row: rowNumber,
        level: 'error',
        message: `Unknown question_type "${cell(typeCol)}". Use single_choice, multi_choice, true_false or short_answer.`,
      });
      return;
    }

    const type = declaredType ?? inferType(options.length, rawAnswer);

    if (type === 'true_false') {
      const truth = parseTruth(rawAnswer);
      if (truth === null) {
        issues.push({
          row: rowNumber,
          level: 'error',
          message: `true_false needs correct_answer "true" or "false" (got "${rawAnswer}").`,
        });
        return;
      }
      options = ['True', 'False'];
      const question = buildQuestion({
        type,
        stem,
        options,
        answer: [truth ? 0 : 1],
        explanation: tidy(cell(explanationCol)),
        tags: parseTags(cell(tagsCol)),
        reference: tidy(cell(referenceCol)),
      });
      addQuestion(question, rowNumber);
      return;
    }

    if (type === 'short_answer') {
      const explanation = tidy(cell(explanationCol)) || tidy(rawAnswer);
      if (!explanation) {
        issues.push({
          row: rowNumber,
          level: 'warning',
          message: 'short_answer has no explanation and no correct_answer, so there is nothing to reveal. Row skipped.',
        });
        return;
      }
      addQuestion(
        buildQuestion({
          type,
          stem,
          options: [],
          answer: [],
          explanation,
          tags: parseTags(cell(tagsCol)),
          reference: tidy(cell(referenceCol)),
        }),
        rowNumber,
      );
      return;
    }

    // single_choice / multi_choice
    if (options.length < 2) {
      issues.push({row: rowNumber, level: 'error', message: 'Choice questions need at least two options (A and B).'});
      return;
    }
    if (hasDuplicateOptions(options)) {
      issues.push({row: rowNumber, level: 'error', message: 'Two options have the same text.'});
      return;
    }

    const parsed = parseChoiceAnswer(rawAnswer);
    if (!parsed || parsed.length === 0) {
      issues.push({
        row: rowNumber,
        level: 'error',
        message: `Could not read correct_answer "${rawAnswer}". Use letters (A) or commas for multi (A,B).`,
      });
      return;
    }
    if (type === 'single_choice' && parsed.length !== 1) {
      issues.push({
        row: rowNumber,
        level: 'error',
        message: `single_choice has ${parsed.length} answers (${rawAnswer}). Use multi_choice for more than one.`,
      });
      return;
    }
    const outOfRange = parsed.find(index => index < 0 || index >= options.length);
    if (outOfRange !== undefined) {
      issues.push({
        row: rowNumber,
        level: 'error',
        message: `Answer points at ${OPTION_LETTERS[outOfRange]?.toUpperCase() ?? outOfRange}, but only ${options.length} options are filled.`,
      });
      return;
    }

    addQuestion(
      buildQuestion({
        type,
        stem,
        options,
        answer: [...new Set(parsed)].sort((a, b) => a - b),
        explanation: tidy(cell(explanationCol)),
        tags: parseTags(cell(tagsCol)),
        reference: tidy(cell(referenceCol)),
      }),
      rowNumber,
    );
  });

  return {questions, issues};

  function addQuestion(question: Question, rowNumber: number) {
    const previous = seen.get(question.id);
    if (previous !== undefined) {
      issues.push({
        row: rowNumber,
        level: 'warning',
        message: `Duplicate of row ${previous} — skipped.`,
      });
      return;
    }
    seen.set(question.id, rowNumber);
    questions.push(question);
  }
}

function buildQuestion(input: Omit<Question, 'id'>): Question {
  const fingerprint = [input.type, canon(input.stem), input.options.map(canon).join('\u0001')].join('\u0000');
  return {...input, id: `q${hash53(fingerprint)}`};
}

function canon(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function tidy(value: string): string {
  return value.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function inferType(optionCount: number, rawAnswer: string): QuestionType {
  if (optionCount === 0) return 'short_answer';
  // Only unambiguous words imply a boolean when the type column is missing;
  // "1" or "F" could just as easily be option 1 or option F.
  if (/^(true|false|yes|no)$/i.test(rawAnswer.trim())) return 'true_false';
  const parsed = parseChoiceAnswer(rawAnswer);
  if (parsed && parsed.length > 1) return 'multi_choice';
  return 'single_choice';
}

function parseTruth(value: string): boolean | null {
  const word = value.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!word) return null;
  if (TRUE_WORDS.has(word)) return true;
  if (FALSE_WORDS.has(word)) return false;
  // A / B when the row has no options at all (true_false keeps A-D empty).
  if (word === 'a') return true;
  if (word === 'b') return false;
  return null;
}

function parseChoiceAnswer(value: string): number[] | null {
  const cleaned = value.replace(/[()[\]]/g, ' ');
  const tokens = cleaned.split(/[,\s;/|&]+/).filter(Boolean);
  if (tokens.length === 0) return null;
  const indices: number[] = [];

  for (const token of tokens) {
    const letters = token.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (!letters) continue;
    if (/^[A-H]+$/.test(letters)) {
      for (const letter of letters) indices.push(letter.charCodeAt(0) - 65);
    } else if (/^[1-8]$/.test(letters)) {
      indices.push(Number(letters) - 1);
    } else {
      return null;
    }
  }

  return indices.length > 0 ? indices : null;
}

function hasDuplicateOptions(options: string[]): boolean {
  const set = new Set(options.map(canon));
  return set.size !== options.length;
}

function parseTags(value: string): string[] {
  return [...new Set(value.split(/[,;|]/).map(tag => tag.trim()).filter(Boolean))];
}
