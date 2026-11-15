import {useState} from 'react';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {FileInput} from '@astryxdesign/core/FileInput';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Download, Upload} from 'lucide-react';

import {ErrorNote, PageHeader, StatTile} from '../components/page';
import {messageOf} from '../lib/errors';
import {MAX_FILE_BYTES, parseFile, saveLocalDump, type ParsedFile} from '../lib/import';
import {navigate} from '../lib/router';
import {downloadCsvTemplate, downloadXlsxTemplate} from '../lib/template';

const MAX_ISSUES_SHOWN = 40;

export function ImportScreen() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = async (next: File | File[] | null) => {
    const chosen = Array.isArray(next) ? next[0] : next;
    setFile(chosen ?? null);
    setParsed(null);
    setError(null);
    if (!chosen) return;

    setTitle(previous => previous || chosen.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '));
    setParsing(true);
    try {
      setParsed(await parseFile(chosen));
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setParsing(false);
    }
  };

  const doImport = async () => {
    if (!file || !parsed || parsed.questions.length === 0) return;
    setImporting(true);
    setError(null);
    try {
      const dump = await saveLocalDump(file.name, title, parsed.questions);
      navigate(`/dump/${dump.id}`);
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setImporting(false);
    }
  };

  const errors = parsed?.issues.filter(issue => issue.level === 'error') ?? [];
  const warnings = parsed?.issues.filter(issue => issue.level === 'warning') ?? [];
  const allIssues = [...errors, ...warnings];

  return (
    <VStack gap={5}>
      <PageHeader
        title="Import questions"
        description="Bring a CSV, TSV or Excel file. It is read in this browser and stored on this device — nothing is uploaded."
      />

      {error ? <ErrorNote message={error} /> : null}

      <Card padding={4}>
        <VStack gap={4}>
          <FileInput
            label="Question file"
            mode="dropzone"
            accept=".csv,.tsv,.txt,.xlsx,.xls"
            maxSize={MAX_FILE_BYTES}
            value={file}
            onChange={choose}
            description="CSV, TSV, XLSX or XLS · up to 15 MB · the first row must be the header."
            isRequired
          />

          <TextInput
            label="Name this dump"
            value={title}
            onChange={setTitle}
            placeholder="e.g. Anatomy 200L"
            description="Only you see this name."
          />

          <HStack gap={2} wrap="wrap">
            <Button
              variant="primary"
              label={
                parsed && parsed.questions.length > 0
                  ? `Import ${parsed.questions.length} question${parsed.questions.length === 1 ? '' : 's'}`
                  : 'Import'
              }
              icon={<Upload size={16} />}
              isDisabled={!parsed || parsed.questions.length === 0 || parsing}
              isLoading={importing}
              onClick={doImport}
            />
            {parsing ? <Text type="supporting">Reading file…</Text> : null}
          </HStack>

          {parsed ? (
            <HStack gap={3} wrap="wrap">
              <StatTile label="Readable questions" value={parsed.questions.length} />
              <StatTile label="Rows with errors" value={errors.length} />
              <StatTile label="Warnings" value={warnings.length} />
            </HStack>
          ) : null}

          {parsed && allIssues.length > 0 ? (
            <Banner
              status={errors.length > 0 ? 'warning' : 'info'}
              title={
                errors.length > 0
                  ? `${errors.length} row${errors.length === 1 ? '' : 's'} skipped`
                  : `${warnings.length} warning${warnings.length === 1 ? '' : 's'}`
              }
              description="Valid rows can still be imported. Fix the file and import it again to add the rest."
              collapsible={{defaultIsOpen: true}}
            >
              <VStack gap={1}>
                {allIssues.slice(0, MAX_ISSUES_SHOWN).map((issue, index) => (
                  <Text key={index} type="supporting" display="block" className="meso-wrap">
                    Row {issue.row}: {issue.message}
                  </Text>
                ))}
                {allIssues.length > MAX_ISSUES_SHOWN ? (
                  <Text type="supporting" display="block">
                    …and {allIssues.length - MAX_ISSUES_SHOWN} more.
                  </Text>
                ) : null}
              </VStack>
            </Banner>
          ) : null}
        </VStack>
      </Card>

      <Card padding={4}>
        <VStack gap={3}>
          <Text type="label" weight="bold">
            The format
          </Text>
          <Text type="supporting" display="block" className="meso-wrap">
            Header row: question, question_type, A, B, C, D, correct_answer, explanation, tags,
            user_answer. question_type is single_choice, multi_choice, true_false or short_answer.
            Multi answers are comma separated (A,B); true/false uses true or false; short_answer
            reveals the explanation. user_answer is ignored.
          </Text>
          <Text type="supporting" display="block" className="meso-wrap">
            If you save a comma-separated file, quote any field containing a comma — for example
            tags like &quot;Math,Addition&quot;. Tab-separated files (what a spreadsheet copies out)
            need no quoting.
          </Text>
          <HStack gap={2} wrap="wrap">
            <Button
              variant="secondary"
              label="Download CSV template"
              icon={<Download size={16} />}
              onClick={downloadCsvTemplate}
            />
            <Button
              variant="secondary"
              label="Download Excel template"
              icon={<Download size={16} />}
              onClick={() => void downloadXlsxTemplate()}
            />
          </HStack>
        </VStack>
      </Card>
    </VStack>
  );
}
