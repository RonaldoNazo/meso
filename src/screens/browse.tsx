import {useEffect, useMemo, useState} from 'react';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {ProgressBar} from '@astryxdesign/core/ProgressBar';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Tab, TabList} from '@astryxdesign/core/TabList';
import {Heading, Text} from '@astryxdesign/core/Text';
import {TextInput} from '@astryxdesign/core/TextInput';
import {ChevronRight, Play, Upload} from 'lucide-react';

import {DumpRow} from '../components/dump-row';
import {ErrorNote, PageHeader} from '../components/page';
import {listSessions} from '../lib/db';
import {messageOf} from '../lib/errors';
import {loadLibraryIndex, localDumps} from '../lib/library';
import {useProgress} from '../lib/progress';
import {navigate} from '../lib/router';
import {aggregateStats, overallStats} from '../lib/stats';
import {useSettings} from '../lib/useSettings';
import {useStartDump} from '../lib/useStartDump';
import type {Dump, DumpMeta} from '../lib/types';

interface ResumeInfo {
  sessionId: string;
  dumpId: string;
  done: number;
  total: number;
}

interface UniversitySummary {
  slug: string;
  name: string;
  dumps: DumpMeta[];
}

export function BrowseScreen() {
  const {map} = useProgress();
  const [settings] = useSettings();
  const {start, busyId, error: startError} = useStartDump();
  const [tab, setTab] = useState<'public' | 'mine'>('public');
  const [index, setIndex] = useState<DumpMeta[]>([]);
  const [mine, setMine] = useState<Dump[]>([]);
  const [resume, setResume] = useState<ResumeInfo | null>(null);
  const [query, setQuery] = useState('');
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
    const groups = new Map<string, UniversitySummary>();
    for (const dump of index) {
      const slug = dump.uniSlug || dump.university.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const existing = groups.get(slug);
      if (existing) existing.dumps.push(dump);
      else groups.set(slug, {slug, name: dump.university, dumps: [dump]});
    }
    return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [index]);

  const needle = query.trim().toLowerCase();

  const matchedUniversities = useMemo(() => {
    if (!needle) return universities;
    return universities.filter(uni => uni.name.toLowerCase().includes(needle));
  }, [universities, needle]);

  const matchedDumps = useMemo(() => {
    if (!needle) return [];
    return index.filter(dump =>
      [dump.title, dump.course, dump.year, ...(dump.tags ?? [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }, [index, needle]);

  const resumeTitle = useMemo(() => {
    if (!resume) return '';
    return (
      index.find(meta => meta.id === resume.dumpId)?.title ??
      mine.find(dump => dump.id === resume.dumpId)?.title ??
      'your last session'
    );
  }, [resume, index, mine]);

  const totals = overallStats(map);

  return (
    <VStack gap={5}>
      <PageHeader
        title="Practice"
        description="Pick your university, then a category. Progress is stored in this browser only — no account, nothing uploaded."
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
      {startError ? <ErrorNote message={startError} /> : null}

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
          <TextInput
            type="search"
            label="Search"
            isLabelHidden
            placeholder="Search university, category or topic…"
            value={query}
            onChange={setQuery}
            hasClear
          />

          {loading ? (
            <Text type="supporting">Loading the library…</Text>
          ) : index.length === 0 ? (
            <EmptyState
              title="No public dumps yet"
              description="The library is empty. Import your own CSV or Excel file to start practising, or add dumps to the library folder and rebuild."
              actions={
                <Button label="Import a file" variant="primary" onClick={() => navigate('/import')} />
              }
            />
          ) : needle ? (
            matchedUniversities.length === 0 && matchedDumps.length === 0 ? (
              <EmptyState
                title="Nothing matches that"
                description="Try a category like “Kardiologji”, or a university name."
                actions={
                  <Button label="Clear search" variant="secondary" onClick={() => setQuery('')} />
                }
              />
            ) : (
              <VStack gap={4}>
                {matchedUniversities.length > 0 ? (
                  <VStack gap={3}>
                    {matchedUniversities.map(uni => (
                      <UniversityCard key={uni.slug} university={uni} />
                    ))}
                  </VStack>
                ) : null}
                {matchedDumps.length > 0 ? (
                  <VStack gap={3}>
                    <Text type="label" weight="bold">
                      Matching categories
                    </Text>
                    {matchedDumps.map(meta => (
                      <DumpRow
                        key={meta.id}
                        meta={meta}
                        done={aggregateStats(map, [meta]).done}
                        wrong={aggregateStats(map, [meta]).wrong}
                        busy={busyId === meta.id}
                        count={settings.count}
                        onStart={() => void start(meta.id)}
                        onOpen={() => navigate(`/dump/${meta.id}`)}
                      />
                    ))}
                  </VStack>
                ) : null}
              </VStack>
            )
          ) : (
            <VStack gap={3}>
              {universities.map(uni => (
                <UniversityCard key={uni.slug} university={uni} />
              ))}
            </VStack>
          )}
        </VStack>
      ) : mine.length === 0 ? (
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
              done={aggregateStats(map, [dump]).done}
              wrong={aggregateStats(map, [dump]).wrong}
              busy={busyId === dump.id}
              count={settings.count}
              onStart={() => void start(dump.id)}
              onOpen={() => navigate(`/dump/${dump.id}`)}
            />
          ))}
        </VStack>
      )}

      <Text type="supporting" display="block" className="meso-wrap">
        Meso keeps everything on this device. Clearing your browser data removes your progress, so
        back it up from the Progress page if you care about it.
      </Text>
    </VStack>
  );
}

function UniversityCard({university}: {university: UniversitySummary}) {
  const {map} = useProgress();
  const stats = aggregateStats(map, university.dumps);
  const courses = new Set(university.dumps.map(dump => dump.course).filter(Boolean));

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack justify="between" align="start" gap={3} wrap="wrap">
          <VStack gap={1} maxWidth={620}>
            <Heading level={2}>{university.name}</Heading>
            <Text type="supporting" display="block">
              {stats.categories} categor{stats.categories === 1 ? 'y' : 'ies'} · {stats.total}{' '}
              questions
              {courses.size > 0 ? ` · ${[...courses].join(', ')}` : ''}
            </Text>
          </VStack>
        </HStack>

        <VStack gap={1}>
          <ProgressBar
            label={`${university.name} progress`}
            isLabelHidden
            value={Math.min(stats.done, stats.total)}
            max={Math.max(stats.total, 1)}
            hasValueLabel
            variant={stats.done >= stats.total && stats.total > 0 ? 'success' : 'accent'}
          />
          <Text type="supporting" display="block">
            {stats.done} done · {Math.max(0, stats.total - stats.done)} left
            {stats.wrong > 0 ? ` · ${stats.wrong} to review` : ''}
          </Text>
        </VStack>

        <HStack>
          <Button
            variant="primary"
            label="Open categories"
            icon={<ChevronRight size={16} />}
            onClick={() => navigate(`/university/${university.slug}`)}
          />
        </HStack>
      </VStack>
    </Card>
  );
}
