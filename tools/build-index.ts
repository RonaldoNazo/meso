import {cp, mkdir, readFile, readdir, rm, stat, writeFile} from 'node:fs/promises';
import {basename, extname, join, relative, sep} from 'node:path';

import {parseDelimited} from '../src/lib/csv';
import {hash53} from '../src/lib/hash';
import {questionsFromTable} from '../src/lib/normalize';
import type {DumpMeta, LibraryIndex} from '../src/lib/types';

/**
 * Turns the `library/` folder into the static catalogue the app searches:
 *
 *   library/unilag/_meta.json
 *   library/unilag/medicine-anatomy-200l.csv
 *        ↓
 *   public/library/index.json
 *   public/library/dumps/unilag-medicine-anatomy-200l.csv?v=…
 */

const root = process.cwd();
const libraryDir = join(root, 'library');
const outputDir = join(root, 'public', 'library');
const dumpsDir = join(outputDir, 'dumps');

interface FolderMeta {
  university?: string;
  course?: string;
  year?: string;
  license?: string;
  tags?: string[];
}

interface FileMeta extends FolderMeta {
  title?: string;
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function titleize(value: string): string {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\p{L}/gu, letter => letter.toUpperCase());
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    return null;
  }
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, {withFileTypes: true});
  const files: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (/\.(csv|tsv)$/i.test(entry.name)) files.push(full);
  }
  return files;
}

async function main() {
  try {
    await stat(libraryDir);
  } catch {
    console.warn('[library] no library/ folder — writing an empty index.');
    await mkdir(dumpsDir, {recursive: true});
    await writeFile(join(outputDir, 'index.json'), JSON.stringify(emptyIndex(), null, 2));
    return;
  }

  await rm(dumpsDir, {recursive: true, force: true});
  await mkdir(dumpsDir, {recursive: true});

  const files = await walk(libraryDir);
  const dumps: DumpMeta[] = [];
  const usedIds = new Set<string>();
  let problemCount = 0;

  for (const file of files) {
    const relativePath = relative(libraryDir, file);
    const folder = join(file, '..');
    const folderMeta = (await readJson<FolderMeta>(join(folder, '_meta.json'))) ?? {};
    const stem = basename(file).replace(/\.(csv|tsv)$/i, '');
    const fileMeta = (await readJson<FileMeta>(join(folder, `${stem}.meta.json`))) ?? {};
    const meta: FileMeta = {...folderMeta, ...fileMeta};

    const directorySlug = relative(libraryDir, folder).split(sep).filter(Boolean).map(slugify).join('-');
    const baseId = directorySlug ? `${directorySlug}-${slugify(stem)}` : slugify(stem);
    let id = baseId || 'dump';
    let suffix = 2;
    while (usedIds.has(id)) id = `${baseId}-${suffix++}`;
    usedIds.add(id);

    const content = await readFile(file, 'utf8');
    const {questions, issues} = questionsFromTable(parseDelimited(content));
    const errors = issues.filter(issue => issue.level === 'error');
    problemCount += errors.length;

    if (questions.length === 0) {
      console.warn(`[library] skipped ${relativePath}: no readable questions`);
      errors.slice(0, 3).forEach(issue => console.warn(`  row ${issue.row}: ${issue.message}`));
      continue;
    }

    const fileName = `${id}.csv`;
    await cp(file, join(dumpsDir, fileName));

    const info = await stat(file);
    dumps.push({
      id,
      title: meta.title ?? titleize(stem),
      university: meta.university ?? titleize(directorySlug || 'Library'),
      uniSlug: slugify(directorySlug || 'library'),
      course: meta.course,
      year: meta.year,
      tags: [...new Set([...(meta.tags ?? []), ...questions.flatMap(question => question.tags)])].slice(0, 12),
      count: questions.length,
      updatedAt: info.mtime.toISOString().slice(0, 10),
      license: meta.license,
      url: `dumps/${fileName}?v=${hash53(content).slice(0, 6)}`,
      source: 'library',
    });

    const errorNote = errors.length > 0 ? `, ${errors.length} bad rows skipped` : '';
    console.log(`[library] ${id}: ${questions.length} questions${errorNote}`);
  }

  dumps.sort((a, b) => a.university.localeCompare(b.university) || a.title.localeCompare(b.title));

  const index: LibraryIndex = {
    schema: 'meso/index/1',
    generatedAt: new Date().toISOString(),
    dumps,
  };

  await writeFile(join(outputDir, 'index.json'), JSON.stringify(index, null, 2));
  console.log(`[library] index.json: ${dumps.length} dump(s), ${dumps.reduce((sum, dump) => sum + dump.count, 0)} questions`);
  if (problemCount > 0) console.warn(`[library] ${problemCount} row(s) had errors and were skipped.`);
}

function emptyIndex(): LibraryIndex {
  return {schema: 'meso/index/1', generatedAt: new Date().toISOString(), dumps: []};
}

main().catch(error => {
  console.error('[library] build failed:', error);
  process.exit(1);
});
