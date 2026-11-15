import {toCsv} from './csv';

export const TEMPLATE_HEADER = [
  'question',
  'question_type',
  'A',
  'B',
  'C',
  'D',
  'correct_answer',
  'explanation',
  'tags',
  'user_answer',
];

const TEMPLATE_ROWS = [
  ['2 + 2 = ?', 'single_choice', '3', '4', '5', '6', 'B', '2 + 2 = 4', 'Math,Addition', ''],
  ['Select the prime numbers', 'multi_choice', '2', '3', '4', '6', 'A,B', '2 and 3 are prime.', 'Math', ''],
  ['The Earth orbits the Sun', 'true_false', '', '', '', '', 'true', '', 'Science', ''],
  [
    'Explain photosynthesis',
    'short_answer',
    '',
    '',
    '',
    '',
    '',
    'Plants convert light energy into chemical energy.',
    'Biology',
    '',
  ],
];

export const TEMPLATE_ROWS_FULL = [TEMPLATE_HEADER, ...TEMPLATE_ROWS];

export function downloadCsvTemplate(): void {
  download('meso-question-template.csv', 'text/csv;charset=utf-8', toCsv(TEMPLATE_ROWS_FULL));
}

export async function downloadXlsxTemplate(): Promise<void> {
  const XLSX = await import('@e965/xlsx');
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(TEMPLATE_ROWS_FULL), 'Questions');
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ['Meso question template'],
      [],
      ['question', 'The question text. Required.'],
      ['question_type', 'single_choice, multi_choice, true_false or short_answer.'],
      ['A possibly B, C, D', 'Answer options. Continuous from A; leave blank for true_false and short_answer.'],
      ['correct_answer', 'Letter (B) or letters (A,B) for choices. true/false for true_false. Optional for short_answer.'],
      ['explanation', 'Shown after answering. For short_answer this is the model answer.'],
      ['tags', 'Comma-separated, e.g. Math,Addition.'],
      ['user_answer', 'Ignored. Kept so exported dumps round-trip.'],
      [],
      ['Tip', 'Save as CSV UTF-8 if you prefer; both formats import.'],
    ]),
    'Instructions',
  );
  XLSX.writeFile(workbook, 'meso-question-template.xlsx');
}

function download(fileName: string, type: string, content: string): void {
  const blob = new Blob([content], {type});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
