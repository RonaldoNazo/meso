import {useEffect, useMemo, useState} from 'react';
import {AlertDialog} from '@astryxdesign/core/AlertDialog';
import {Badge} from '@astryxdesign/core/Badge';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {ProgressBar} from '@astryxdesign/core/ProgressBar';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {ArrowLeft, Play, RotateCcw, Trash2} from 'lucide-react';

import {ErrorNote, PageHeader, StatTile} from '../components/page';
import {deleteStoredDump} from '../lib/db';
import {messageOf} from '../lib/errors';
import {findDump} from '../lib/library';
import {useProgress} from '../lib/progress';
import {navigate} from '../lib/router';
import {createSession} from '../lib/sessions';
import {statsForDump} from '../lib/stats';
import type {Dump, PracticeMode} from '../lib/types';
import {useSettings} from '../lib/useSettings';

export function DumpScreen({id}: {id: string}) {
  const {map} = useProgress();
  const [settings] = useSettings();
  const [dump, setDump] = useState<Dump | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    findDump(id)
      .then(found => {
        if (!alive) return;
        if (!found) throw new Error('That dump could not be found.');
        setDump(found.dump);
      })
      .catch(reason => alive && setError(messageOf(reason)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  const stats = dump ? statsForDump(map, dump.id) : null;

  const types = useMemo(() => {
    if (!dump) return [];
    const counts = new Map<string, number>();
    for (const question of dump.questions) {
      counts.set(question.type, (counts.get(question.type) ?? 0) + 1);
    }
    return [...counts.entries()];
  }, [dump]);

  const start = async (mode: PracticeMode, count: number) => {
    if (!dump) return;
    setBusy(true);
    setError(null);
    try {
      const session = await createSession(dump, map, mode, count);
      navigate(`/practice/${session.id}`);
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Text type="supporting">Loading dump…</Text>;
  if (!dump) {
    return (
      <VStack gap={4}>
        <ErrorNote message={error ?? 'That dump does not exist.'} />
        <Button label="Back to practice" variant="secondary" onClick={() => navigate('/')} />
      </VStack>
    );
  }

  const total = dump.count;
  const done = stats?.done ?? 0;
  const wrong = stats?.wrong ?? 0;
  const flagged = stats?.flagged ?? 0;
  const metaLine = [dump.university, dump.course, dump.year].filter(Boolean).join(' · ');

  return (
    <VStack gap={5}>
      <PageHeader
        title={dump.title}
        description={metaLine}
        actions={
          <Button
            variant="secondary"
            label="All dumps"
            icon={<ArrowLeft size={16} />}
            onClick={() => navigate('/')}
          />
        }
      />

      {error ? <ErrorNote message={error} /> : null}

      <HStack gap={3} wrap="wrap">
        <StatTile label="Questions" value={total} />
        <StatTile label="Done" value={done} />
        <StatTile label="Left" value={Math.max(0, total - done)} />
        <StatTile label="To review" value={wrong} />
        <StatTile label="Flagged" value={flagged} />
      </HStack>

      <Card padding={4}>
        <VStack gap={3}>
          <ProgressBar
            label="Progress for this dump"
            value={Math.min(done, total)}
            max={Math.max(total, 1)}
            hasValueLabel
            variant={done >= total && total > 0 ? 'success' : 'accent'}
          />
          <Text type="supporting" display="block">
            {done >= total && total > 0
              ? 'Every question has been answered at least once. “Start” now mixes in the ones you got wrong first.'
              : `${total - done} question${total - done === 1 ? '' : 's'} still untouched.`}
          </Text>
          <HStack gap={2} wrap="wrap">
            <Button
              variant="primary"
              label={`Start ${Math.min(settings.count, total)}`}
              icon={<Play size={16} />}
              isLoading={busy}
              onClick={() => start('mixed', settings.count)}
            />
            <Button
              variant="secondary"
              label="Practice all"
              onClick={() => start('mixed', total)}
            />
            <Button
              variant="secondary"
              label="Unseen only"
              onClick={() => start('unseen', total)}
            />
            <Button
              variant="secondary"
              label="Review mistakes"
              icon={<RotateCcw size={16} />}
              isDisabled={wrong === 0}
              onClick={() => start('wrong', total)}
            />
            <Button
              variant="secondary"
              label="Flagged"
              isDisabled={flagged === 0}
              onClick={() => start('flagged', total)}
            />
          </HStack>
        </VStack>
      </Card>

      <VStack gap={2}>
        <Text type="label" weight="bold">
          Contents
        </Text>
        <HStack gap={2} wrap="wrap">
          {types.map(([type, count]) => (
            <Badge key={type} label={`${labelForType(type)}: ${count}`} variant="neutral" />
          ))}
        </HStack>
        {dump.tags.length > 0 ? (
          <HStack gap={2} wrap="wrap">
            {dump.tags.map(tag => (
              <Badge key={tag} label={tag} variant="blue" />
            ))}
          </HStack>
        ) : null}
      </VStack>

      {dump.source === 'local' ? (
        <VStack gap={2}>
          <Button
            variant="secondary"
            label="Remove this file"
            icon={<Trash2 size={16} />}
            onClick={() => setConfirmDelete(true)}
          />
          <Text type="supporting" display="block">
            Removing the file keeps your answers, so re-importing the same questions later picks up
            where you left off.
          </Text>
        </VStack>
      ) : null}

      <AlertDialog
        isOpen={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Remove this file?"
        description="The questions are deleted from this device. Your answer history stays."
        actionLabel="Remove"
        cancelLabel="Keep"
        onAction={async () => {
          await deleteStoredDump(`local:${dump.id}`);
          navigate('/');
        }}
      />
    </VStack>
  );
}

function labelForType(type: string): string {
  switch (type) {
    case 'single_choice':
      return 'Single choice';
    case 'multi_choice':
      return 'Multiple choice';
    case 'true_false':
      return 'True / false';
    case 'short_answer':
      return 'Short answer';
    default:
      return type;
  }
}
