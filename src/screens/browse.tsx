import {useEffect, useMemo, useState} from 'react';
import {Badge} from '@astryxdesign/core/Badge';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {ProgressBar} from '@astryxdesign/core/ProgressBar';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Tab, TabList} from '@astryxdesign/core/TabList';
import {Heading, Text} from '@astryxdesign/core/Text';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Play, Upload} from 'lucide-react';

import {ErrorNote, PageHeader} from '../components/page';
import {listSessions} from '../lib/db';
import {messageOf} from '../lib/errors';
import {findDump, loadLibraryIndex, localDumps} from '../lib/library';
import {createSession} from '../lib/sessions';
import {navigate} from '../lib/router';
import {statsForDump, overallStats} from '../lib/stats';
import {useProgress} from '../lib/progress';
import {useSettings} from '../lib/useSettings';
import type {Dump, DumpMeta, PracticeMode} from '../lib/types';

interface ResumeInfo {
  sessionId: string;
  dumpId: string;
  done: number;
  total: number;
}

export function BrowseScreen() {
  const {map} = useProgress();
  const [settings] = useSettings();
  const [tab, setTab] = useState<'public' | 'mine'>('public');
  const [index, setIndex] = useState<DumpMeta[]>([]);
  const [mine, setMine] = useState<Dump[]>([]);
  const [resume, setResume] = useState<ResumeInfo | null>(null);
  const [query, setQuery] = useState('');
  const [university, setUniversity] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([loadLibraryIndex(), localDumps(), listSessions()])
      .then(([dumps, local, sessions]) => {
        setIndex(dumps);
        setMine(local);
        const open = sessions.find(session => session.ids.length > 0 && session.answers.length < session.ids.length);
        setResume(
          open
            ? {
                sessionId: open.id,
                dumpId: open.dumpId,
                done: open.answers.length,
                total: open.ids.length,
              }
            : null,
        );
      })
      .catch(reason => setError(messageOf(reason)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const universities = useMemo(() => {
    const set = new Set(index.map(meta => meta.university).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [index]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return index.filter(meta => {
      if (university && meta.university !== university) return false;
      if (!needle) return true;
      const haystack = [meta.title, meta.university, meta.course, meta.year, ...(meta.tags ?? [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [index, query, university]);

  const resumeTitle = useMemo(() => {
    if (!resume) return '';
    return (
      index.find(meta => meta.id === resume.dumpId)?.title ??
      mine.find(dump => dump.id === resume.dumpId)?.title ??
      'your last session'
    );
  }, [resume, index, mine]);

  const start = async (id: string, mode: PracticeMode = 'mixed', count?: number) => {
    setBusyId(id);
    setError(null);
    try {
      const found = await findDump(id);
      if (!found) throw new Error('That dump could not be found. Import it again or refresh.');
      const session = await createSession(found.dump, map, mode, count ?? settings.count);
      navigate(`/practice/${session.id}`);
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusyId(null);
    }
  };

  const totals = overallStats(map);

  const grouped = useMemo(() => {
    const map = new Map<string, DumpMeta[]>();
    for (const meta of filtered) {
      const list = map.get(meta.university);
      if (list) list.push(meta);
      else map.set(meta.university, [meta]);
    }
    return [...map.entries()];
  }, [filtered]);

  const row = (meta: DumpMeta) => (
    <DumpRow
      key={meta.id}
      meta={meta}
      done={statsForDump(map, meta.id).done}
      wrong={statsForDump(map, meta.id).wrong}
      busy={busyId === meta.id}
      count={settings.count}
      onStart={() => start(meta.id)}
      onOpen={() => navigate(`/dump/${meta.id}`)}
    />
  );

  return (
    <VStack gap={5}>
      <PageHeader
        title="Practice"
        description="Choose a dump and start. Progress is stored in this browser only — no account, nothing uploaded."
        actions={
          <Button
            variant="secondary"
            label="Import a file"
            icon={<Upload size={16} />}
            onClick={() => navigate('/import')}
          />
        }
      />

      {error ? <ErrorNote message={error} onRetry={load} /> : null}

      {resume ? (
        <Banner
          status="info"
          title={`Continue "${resumeTitle}"`}
          description={`${resume.done} of ${resume.total} answered in your unfinished session.`}
          collapsible={false}
          endContent={
            <Button
              variant="primary"
              size="sm"
              label="Resume"
              icon={<Play size={14} />}
              onClick={() => navigate(`/practice/${resume.sessionId}`)}
            />
          }
        />
      ) : null}

      {totals.done > 0 ? (
        <Text type="supporting" display="block">
          {totals.done} question{totals.done === 1 ? '' : 's'} answered in this browser ·{' '}
          {totals.accuracy}% correct on the latest attempt.
        </Text>
      ) : null}

      <TabList value={tab} onChange={value => setTab(value as 'public' | 'mine')} hasDivider>
        <Tab value="public" label="Public dumps" />
        <Tab value="mine" label="My files" />
      </TabList>

      {tab === 'public' ? (
        <VStack gap={4}>
          <HStack gap={2} wrap="wrap" align="center">
            <TextInput
              type="search"
              label="Search dumps"
              isLabelHidden
              placeholder="Search university, course, topic…"
              value={query}
              onChange={setQuery}
              width="100%"
              hasClear
            />
          </HStack>

          {universities.length > 1 ? (
            <HStack gap={2} wrap="wrap">
              <Button
                size="sm"
                variant={university === null ? 'primary' : 'secondary'}
                label="All universities"
                onClick={() => setUniversity(null)}
              />
              {universities.map(name => (
                <Button
                  key={name}
                  size="sm"
                  variant={university === name ? 'primary' : 'secondary'}
                  label={name}
                  onClick={() => setUniversity(university === name ? null : name)}
                />
              ))}
            </HStack>
          ) : null}

          {loading ? (
            <Text type="supporting">Loading the library…</Text>
          ) : filtered.length === 0 ? (
            <EmptyState
              title={index.length === 0 ? 'No public dumps yet' : 'Nothing matches that'}
              description={
                index.length === 0
                  ? 'The library is empty. Import your own CSV or Excel file to start practising, or add dumps to the library folder and rebuild.'
                  : 'Try a different search term or clear the university filter.'
              }
              actions={
                index.length === 0 ? (
                  <Button label="Import a file" variant="primary" onClick={() => navigate('/import')} />
                ) : (
                  <Button
                    label="Clear filters"
                    variant="secondary"
                    onClick={() => {
                      setQuery('');
                      setUniversity(null);
                    }}
                  />
                )
              }
            />
          ) : query.trim() || university ? (
            <VStack gap={3}>
              {filtered.map(meta => row(meta))}
            </VStack>
          ) : (
            <VStack gap={4}>
              {grouped.map(([name, items]) => (
                <VStack key={name} gap={2}>
                  <Text type="label" weight="bold">
                    {name}
                  </Text>
                  <VStack gap={3}>{items.map(meta => row(meta))}</VStack>
                </VStack>
              ))}
            </VStack>
          )}
        </VStack>
      ) : (
        <VStack gap={4}>
          {mine.length === 0 ? (
            <EmptyState
              title="No files imported yet"
              description="Bring your own questions as CSV, TSV or Excel. They stay on this device."
              actions={
                <Button
                  label="Import a file"
                  variant="primary"
                  icon={<Upload size={16} />}
                  onClick={() => navigate('/import')}
                />
              }
            />
          ) : (
            <VStack gap={3}>
              {mine.map(dump => (
                <DumpRow
                  key={dump.id}
                  meta={dump}
                  done={statsForDump(map, dump.id).done}
                  wrong={statsForDump(map, dump.id).wrong}
                  busy={busyId === dump.id}
                  count={settings.count}
                  onStart={() => start(dump.id)}
                  onOpen={() => navigate(`/dump/${dump.id}`)}
                />
              ))}
            </VStack>
          )}
        </VStack>
      )}

      <Text type="supporting" display="block" className="meso-wrap">
        Meso keeps everything on this device. Clearing your browser data removes your progress, so
        back it up from the Progress page if you care about it.
      </Text>
    </VStack>
  );
}

function DumpRow({
  meta,
  done,
  wrong,
  busy,
  count,
  onStart,
  onOpen,
}: {
  meta: DumpMeta;
  done: number;
  wrong: number;
  busy: boolean;
  count: number;
  onStart: () => void;
  onOpen: () => void;
}) {
  const total = Math.max(meta.count, done);
  const metaLine = [meta.university, meta.course, meta.year].filter(Boolean).join(' · ');
  const startCount = Math.min(count, Math.max(1, total));

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack justify="between" align="start" gap={3} wrap="wrap">
          <VStack gap={1} maxWidth={620}>
            <Heading level={2}>{meta.title}</Heading>
            {metaLine ? (
              <Text type="supporting" display="block" className="meso-wrap">
                {metaLine}
              </Text>
            ) : null}
          </VStack>
          <Badge label={`${meta.count} questions`} />
        </HStack>

        <VStack gap={1}>
          <ProgressBar
            label={`${meta.title} progress`}
            isLabelHidden
            value={Math.min(done, total)}
            max={total}
            hasValueLabel
            variant={done >= total && total > 0 ? 'success' : 'accent'}
          />
          <Text type="supporting" display="block">
            {done} done · {Math.max(0, total - done)} left
            {wrong > 0 ? ` · ${wrong} to review` : ''}
          </Text>
        </VStack>

        <HStack gap={2} wrap="wrap">
          <Button
            variant="primary"
            label={`Start ${startCount}`}
            icon={<Play size={16} />}
            isLoading={busy}
            onClick={onStart}
          />
          <Button variant="secondary" label="Open" onClick={onOpen} />
        </HStack>
      </VStack>
    </Card>
  );
}
