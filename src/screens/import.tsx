import {useState} from 'react';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {Dialog, DialogHeader} from '@astryxdesign/core/Dialog';
import {FileInput} from '@astryxdesign/core/FileInput';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {TextArea} from '@astryxdesign/core/TextArea';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Copy, Download, Sparkles, Upload} from 'lucide-react';

import {ErrorNote, PageHeader, StatTile} from '../components/page';
import {messageOf} from '../lib/errors';
import {MAX_FILE_BYTES, parseFile, saveLocalDump, type ParsedFile} from '../lib/import';
import {buildFixPrompt, CREATE_PROMPT} from '../lib/prompts';
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
  const [aiMode, setAiMode] = useState<'create' | 'fix' | null>(null);
  const [copied, setCopied] = useState(false);

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
        actions={
          <Button
            variant="secondary"
            label="AI"
            icon={<Sparkles size={16} />}
            onClick={() => {
              setCopied(false);
              setAiMode('create');
            }}
          />
        }
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
              description="Valid rows can still be imported. Fix the file and import it again to add the rest — or paste the file and these errors into the AI fix prompt at the bottom of this page."
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
                <HStack justify="between" align="center" gap={2} wrap="wrap">
                  <Text type="supporting" display="block">
                    Want these rows repaired? The prompt below already includes this error list.
                  </Text>
                  <Button
                    size="sm"
                    variant="secondary"
                    label="Fix this CSV with AI"
                    icon={<Sparkles size={14} />}
                    onClick={() => {
                      setCopied(false);
                      setAiMode('fix');
                    }}
                  />
                </HStack>
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
            Header row: question, question_type, A, B, C, D, E, correct_answer, explanation, tags,
            user_answer. question_type is single_choice, multi_choice, true_false or short_answer.
            Multi answers are comma separated (A,B); true/false uses true or false; short_answer
            reveals the explanation. user_answer is ignored.
          </Text>
          <Text type="supporting" display="block" className="meso-wrap">
            If you save a comma-separated file, quote any field containing a comma — for example
            tags like &quot;Math,Addition&quot;. Tab-separated files (what a spreadsheet copies out)
            need no quoting. Empty option cells and repeated option texts are repaired automatically;
            a question with no correct_answer is skipped.
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

      <Dialog
        isOpen={aiMode !== null}
        onOpenChange={(open: boolean) => {
          if (!open) setAiMode(null);
        }}
        width={680}
        maxHeight="82dvh"
        padding={0}
      >
        <DialogHeader
          title={aiMode === 'fix' ? 'Fix this CSV with AI' : 'Create a CSV with AI'}
          onOpenChange={(open: boolean) => {
            if (!open) setAiMode(null);
          }}
        />
        <VStack gap={3} padding={4}>
          <Text type="supporting" display="block" className="meso-wrap">
            {aiMode === 'fix'
              ? 'Copy the prompt, then paste your CSV where it says so. The AI returns the same questions with the quoting and option problems repaired.'
              : 'Copy the prompt into any AI chat, attach the document and say how many questions you want. It knows the columns, the four question types and the quoting rules, so the CSV it returns imports here as is.'}
          </Text>

          <TextArea
            label="Prompt"
            isLabelHidden
            value={
              aiMode === 'fix'
                ? buildFixPrompt(
                    (parsed?.issues ?? []).filter(issue => issue.level === 'error').length > 0
                      ? (parsed?.issues ?? []).filter(issue => issue.level === 'error')
                      : (parsed?.issues ?? []),
                  )
                : CREATE_PROMPT
            }
            isReadOnly
            rows={12}
          />

          <HStack gap={2} wrap="wrap">
            <Button
              variant="primary"
              label={copied ? 'Copied' : 'Copy prompt'}
              icon={<Copy size={16} />}
              onClick={async () => {
                const text =
                  aiMode === 'fix'
                    ? buildFixPrompt(
                        (parsed?.issues ?? []).filter(issue => issue.level === 'error').length > 0
                          ? (parsed?.issues ?? []).filter(issue => issue.level === 'error')
                          : (parsed?.issues ?? []),
                      )
                    : CREATE_PROMPT;
                const ok = await copyText(text);
                setCopied(ok);
                if (ok) setTimeout(() => setCopied(false), 2000);
              }}
            />
          </HStack>
        </VStack>
      </Dialog>
    </VStack>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers / non-secure contexts.
    const helper = document.createElement('textarea');
    helper.value = text;
    helper.setAttribute('readonly', '');
    helper.style.position = 'fixed';
    helper.style.opacity = '0';
    document.body.appendChild(helper);
    helper.select();
    const copied = document.execCommand('copy');
    helper.remove();
    return copied;
  }
}
