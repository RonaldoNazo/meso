export interface ParsedTable {
  header: string[];
  rows: string[][];
  delimiter: '\t' | ',' | ';';
}

export function normalizeHeaderCell(cell: string): string {
  return cell
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/["']/g, '')
    .replace(/[\s\-.]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Parses CSV, TSV and semicolon-delimited text (RFC 4180 quoting, BOM, CRLF,
 * quoted newlines). The delimiter is auto-detected from the header line.
 */
export function parseDelimited(input: string): ParsedTable {
  let text = input.replace(/^\uFEFF/, '');
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // Excel's "sep=," hint line.
  text = text.replace(/^sep=(.)\n/i, '');

  const firstLine = firstNonEmptyLine(text);
  const delimiter = detectDelimiter(firstLine);
  const table = parseWithDelimiter(text, delimiter);
  const header = table.length > 0 ? table[0].map(normalizeHeaderCell) : [];
  const rows = table.slice(1).filter(row => row.some(cell => cell.trim() !== ''));
  return {header, rows, delimiter};
}

function firstNonEmptyLine(text: string): string {
  for (const line of text.split('\n')) {
    if (line.trim() !== '') return line;
  }
  return '';
}

function detectDelimiter(line: string): '\t' | ',' | ';' {
  const counts: Record<'\t' | ',' | ';', number> = {'\t': 0, ',': 0, ';': 0};
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') i++;
      else inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && (ch === '\t' || ch === ',' || ch === ';')) counts[ch]++;
  }
  if (counts['\t'] >= counts[','] && counts['\t'] >= counts[';'] && counts['\t'] > 0) return '\t';
  if (counts[';'] > counts[',']) return ';';
  return ',';
}

function parseWithDelimiter(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"' && field.trim() === '') {
      // Opening quote; ignore any leading spaces inside the cell.
      field = '';
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter(r => r.some(cell => cell.trim() !== ''));
}

/** Serialises rows to CSV with correct quoting. Used by template + export. */
export function toCsv(rows: string[][]): string {
  return rows
    .map(row =>
      row
        .map(cell => {
          const value = cell ?? '';
          return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
        })
        .join(','),
    )
    .join('\r\n');
}
