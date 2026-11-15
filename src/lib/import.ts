import {normalizeHeaderCell, parseDelimited, type ParsedTable} from './csv';
import {putStoredDump} from './db';
import {hash53} from './hash';
import {questionsFromTable} from './normalize';
import type {Dump, ParseIssue, Question} from './types';

export const MAX_FILE_BYTES = 15 * 1024 * 1024;

export interface ParsedFile {
  questions: Question[];
  issues: ParseIssue[];
}

export interface ImportResult extends ParsedFile {
  dump: Dump;
}

export function isSpreadsheet(fileName: string): boolean {
  return /\.(xlsx|xls)$/i.test(fileName);
}

export async function parseFile(file: File): Promise<ParsedFile> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('That file is larger than 15 MB. Split it into smaller dumps.');
  }
  const table = isSpreadsheet(file.name) ? await readSpreadsheet(file) : readDelimited(await file.text());
  return questionsFromTable(table);
}

export async function saveLocalDump(fileName: string, rawTitle: string, questions: Question[]): Promise<Dump> {
  const title = rawTitle.trim() || fileName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
  const id = `local-${hash53(`${title}|${fileName}|${questions.length}`)}`;

  const dump: Dump = {
    id,
    title,
    university: 'My files',
    uniSlug: 'mine',
    course: '',
    year: '',
    tags: [...new Set(questions.flatMap(question => question.tags))].slice(0, 8),
    count: questions.length,
    updatedAt: new Date().toISOString().slice(0, 10),
    url: '',
    source: 'local',
    questions,
  };

  await putStoredDump({key: `local:${id}`, dump, savedAt: Date.now()});
  return dump;
}

export async function importFile(file: File, title: string): Promise<ImportResult> {
  const parsed = await parseFile(file);
  if (parsed.questions.length === 0) {
    throw new Error(parsed.issues.find(issue => issue.level === 'error')?.message ?? 'No questions found in that file.');
  }
  const dump = await saveLocalDump(file.name, title, parsed.questions);
  return {...parsed, dump};
}

function readDelimited(text: string): ParsedTable {
  return parseDelimited(text);
}

async function readSpreadsheet(file: File): Promise<ParsedTable> {
  // Loaded only when someone actually picks an Excel file.
  const XLSX = await import('@e965/xlsx');
  const workbook = XLSX.read(new Uint8Array(await file.arrayBuffer()), {type: 'array'});
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('That workbook has no sheets.');
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {header: 1, raw: false, defval: ''});

  const rows = matrix.map(row => row.map(cell => (cell === null || cell === undefined ? '' : String(cell))));
  const header = rows[0]?.map(normalizeHeaderCell) ?? [];
  return {
    header,
    rows: rows.slice(1).filter(row => row.some(cell => cell.trim() !== '')),
    delimiter: ',',
  };
}
