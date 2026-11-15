import {useEffect, useMemo, useState} from 'react';
import {Badge} from '@astryxdesign/core/Badge';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {ProgressBar} from '@astryxdesign/core/ProgressBar';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {TextInput} from '@astryxdesign/core/TextInput';
import {ArrowLeft} from 'lucide-react';

import {DumpRow} from '../components/dump-row';
import {ErrorNote, PageHeader, StatTile} from '../components/page';
import {messageOf} from '../lib/errors';
import {loadLibraryIndex} from '../lib/library';
import {useProgress} from '../lib/progress';
import {navigate} from '../lib/router';
import {aggregateStats} from '../lib/stats';
import {useStartDump} from '../lib/useStartDump';
import {useSettings} from '../lib/useSettings';
import type {DumpMeta} from '../lib/types';

export function UniversityScreen({slug}: {slug: string}) {
  const {map} = useProgress();
  const [settings] = useSettings();
  const {start, busyId, error: startError} = useStartDump();
  const [dumps, setDumps] = useState<DumpMeta[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    loadLibraryIndex()
      .then(index => {
        if (!alive) return;
        setDumps(index.filter(dump => dump.uniSlug === slug));
      })
      .catch(reason => alive && setError(messageOf(reason)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [slug]);

  const name = dumps[0]?.university ?? 'University';
  const totals = aggregateStats(map, dumps);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return dumps;
    return dumps.filter(dump =>
      [dump.title, dump.course, dump.year, ...(dump.tags ?? [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }, [dumps, query]);

  const courses = useMemo(() => {
    const groups = new Map<string, DumpMeta[]>();
    for (const dump of filtered) {
      const key = dump.course?.trim() || 'Categories';
      const list = groups.get(key);
      if (list) list.push(dump);
      else groups.set(key, [dump]);
    }
    return [...groups.entries()];
  }, [filtered]);

  return (
    <VStack gap={5}>
      <PageHeader
        title={name}
        description={`${totals.categories} categor${totals.categories === 1 ? 'y' : 'ies'} · ${totals.total} questions`}
        actions={
          <Button
            variant="secondary"
            label="All universities"
            icon={<ArrowLeft size={16} />}
            onClick={() => navigate('/')}
          />
        }
      />

      {error ? <ErrorNote message={error} /> : null}
      {startError ? <ErrorNote message={startError} /> : null}

      <HStack gap={3} wrap="wrap">
        <StatTile label="Categories" value={totals.categories} />
        <StatTile label="Questions" value={totals.total} />
        <StatTile label="Done" value={totals.done} />
        <StatTile label="Left" value={Math.max(0, totals.total - totals.done)} />
      </HStack>

      <Card padding={4}>
        <VStack gap={2}>
          <ProgressBar
            label={`${name} progress`}
            value={Math.min(totals.done, totals.total)}
            max={Math.max(totals.total, 1)}
            hasValueLabel
            variant={totals.done >= totals.total && totals.total > 0 ? 'success' : 'accent'}
          />
          <Text type="supporting" display="block">
            {totals.done} answered · {Math.max(0, totals.total - totals.done)} left
            {totals.wrong > 0 ? ` · ${totals.wrong} to review` : ''}
          </Text>
        </VStack>
      </Card>

      <TextInput
        type="search"
        label="Search categories"
        isLabelHidden
        placeholder="Search category or topic…"
        value={query}
        onChange={setQuery}
        hasClear
      />

      {loading ? (
        <Text type="supporting">Loading categories…</Text>
      ) : dumps.length === 0 ? (
        <VStack gap={3}>
          <Text type="supporting">This university has no categories in the current library.</Text>
          <Button label="All universities" variant="secondary" onClick={() => navigate('/')} />
        </VStack>
      ) : filtered.length === 0 ? (
        <VStack gap={3}>
          <Text type="supporting">No category matches “{query}”.</Text>
          <Button label="Clear search" variant="secondary" onClick={() => setQuery('')} />
        </VStack>
      ) : (
        courses.map(([course, items]) => (
          <VStack key={course} gap={3}>
            <HStack justify="between" align="center" gap={2} wrap="wrap">
              <Text type="label" weight="bold">
                {course}
              </Text>
              <Badge label={`${items.length} categor${items.length === 1 ? 'y' : 'ies'}`} />
            </HStack>
            <VStack gap={3}>
              {items.map(meta => (
                <DumpRow
                  key={meta.id}
                  meta={meta}
                  done={aggregateStats(map, [meta]).done}
                  wrong={aggregateStats(map, [meta]).wrong}
                  busy={busyId === meta.id}
                  count={settings.count}
                  showContext={false}
                  onStart={() => void start(meta.id)}
                  onOpen={() => navigate(`/dump/${meta.id}`)}
                />
              ))}
            </VStack>
          </VStack>
        ))
      )}
    </VStack>
  );
}
