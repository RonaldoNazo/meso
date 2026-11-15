import {useEffect, useMemo, useState} from 'react';
import {AlertDialog} from '@astryxdesign/core/AlertDialog';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {FileInput} from '@astryxdesign/core/FileInput';
import {ProgressBar} from '@astryxdesign/core/ProgressBar';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {Download, Trash2, Upload} from 'lucide-react';

import {ErrorNote, PageHeader, StatTile} from '../components/page';
import {exportProgress, importProgress} from '../lib/backup';
import {clearEverything} from '../lib/db';
import {messageOf} from '../lib/errors';
import {loadLibraryIndex, localDumps} from '../lib/library';
import {useProgress} from '../lib/progress';
import {navigate} from '../lib/router';
import {overallStats, statsForDump} from '../lib/stats';
import type {DumpMeta} from '../lib/types';
import {useSettings} from '../lib/useSettings';

export function ProgressScreen() {
  const {map, reload} = useProgress();
  const [settings, update] = useSettings();
  const [dumps, setDumps] = useState<DumpMeta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([loadLibraryIndex(), localDumps()])
      .then(([library, local]) => {
        if (!alive) return;
        setDumps([...local, ...library]);
      })
      .catch(reason => alive && setError(messageOf(reason)));
    return () => {
      alive = false;
    };
  }, []);

  const totals = overallStats(map);

  const tracked = useMemo(() => {
    return dumps
      .map(meta => ({meta, stats: statsForDump(map, meta.id)}))
      .sort((a, b) => b.stats.done - a.stats.done || a.meta.title.localeCompare(b.meta.title));
  }, [dumps, map]);

  const restore = async (file: File | null) => {
    setBackupFile(file);
    if (!file) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const merged = await importProgress(file);
      await reload();
      setNote(`Merged ${merged} progress record${merged === 1 ? '' : 's'} from the backup.`);
      setBackupFile(null);
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <VStack gap={5}>
      <PageHeader
        title="Progress"
        description="Everything here lives in this browser's storage. Clearing site data — or using another device — starts from zero."
        actions={
          <Button
            variant="secondary"
            label="Export backup"
            icon={<Download size={16} />}
            onClick={() => void exportProgress()}
          />
        }
      />

      {error ? <ErrorNote message={error} /> : null}
      {note ? <Banner status="success" title={note} collapsible={false} /> : null}

      <HStack gap={3} wrap="wrap">
        <StatTile label="Answered" value={totals.done} />
        <StatTile label="Latest attempt correct" value={totals.correct} />
        <StatTile label="To review" value={totals.wrong} />
        <StatTile label="Flagged" value={totals.flagged} />
        <StatTile label="Accuracy" value={`${totals.accuracy}%`} />
      </HStack>

      <VStack gap={3}>
        <Text type="label" weight="bold">
          By dump
        </Text>
        {tracked.length === 0 ? (
          <EmptyState
            title="No dumps yet"
            description="Practice a public dump or import your own file, and progress shows up here."
            actions={<Button label="Browse dumps" variant="primary" onClick={() => navigate('/')} />}
          />
        ) : (
          tracked.map(({meta, stats}) => {
            const total = Math.max(meta.count, stats.done);
            return (
              <Card key={meta.id} padding={3}>
                <VStack gap={2}>
                  <HStack justify="between" align="start" gap={2} wrap="wrap">
                    <VStack gap={0.5}>
                      <Text weight="bold" display="block" className="meso-wrap">
                        {meta.title}
                      </Text>
                      <Text type="supporting" display="block">
                        {[meta.university, meta.course, meta.year].filter(Boolean).join(' · ')}
                      </Text>
                    </VStack>
                    <Text type="supporting" hasTabularNumbers>
                      {stats.done}/{total}
                    </Text>
                  </HStack>
                  <ProgressBar
                    label={`${meta.title} progress`}
                    value={Math.min(stats.done, total)}
                    max={Math.max(total, 1)}
                    variant={stats.done >= total && total > 0 ? 'success' : 'accent'}
                    isLabelHidden
                  />
                  <HStack justify="between" align="center" gap={2} wrap="wrap">
                    <Text type="supporting">
                      {Math.max(0, total - stats.done)} left
                      {stats.wrong > 0 ? ` · ${stats.wrong} to review` : ''}
                    </Text>
                    <Button
                      size="sm"
                      variant="secondary"
                      label="Open"
                      onClick={() => navigate(`/dump/${meta.id}`)}
                    />
                  </HStack>
                </VStack>
              </Card>
            );
          })
        )}
      </VStack>

      <Card padding={4}>
        <VStack gap={3}>
          <Text type="label" weight="bold">
            Study settings
          </Text>
          <VStack gap={2}>
            <Text type="supporting">Questions per session</Text>
            <HStack gap={2} wrap="wrap">
              {[10, 20, 30, 50].map(count => (
                <Button
                  key={count}
                  size="sm"
                  variant={settings.count === count ? 'primary' : 'secondary'}
                  label={String(count)}
                  onClick={() => update({count})}
                />
              ))}
            </HStack>
          </VStack>
          <VStack gap={2}>
            <Text type="supporting">Theme</Text>
            <HStack gap={2} wrap="wrap">
              {(
                [
                  ['system', 'System'],
                  ['light', 'Light'],
                  ['dark', 'Dark'],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value}
                  size="sm"
                  variant={settings.theme === value ? 'primary' : 'secondary'}
                  label={label}
                  onClick={() => update({theme: value})}
                />
              ))}
            </HStack>
          </VStack>
        </VStack>
      </Card>

      <Card padding={4}>
        <VStack gap={3}>
          <Text type="label" weight="bold">
            Backup
          </Text>
          <Text type="supporting" display="block">
            Export your answers to a JSON file and restore them on another device or after clearing
            your browser. Question files themselves are not included.
          </Text>
          <HStack gap={2} wrap="wrap">
            <Button
              variant="secondary"
              label="Export backup"
              icon={<Download size={16} />}
              onClick={() => void exportProgress()}
            />
          </HStack>
          <FileInput
            label="Restore from backup"
            accept=".json,application/json"
            value={backupFile}
            onChange={file => void restore(Array.isArray(file) ? (file[0] ?? null) : file)}
            description="Merges into your current progress; nothing is overwritten with less data."
            isDisabled={busy}
          />
          <Button
            variant="secondary"
            label="Clear all data on this device"
            icon={<Trash2 size={16} />}
            onClick={() => setConfirmClear(true)}
          />
        </VStack>
      </Card>

      <AlertDialog
        isOpen={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear everything?"
        description="Deletes imported files, cached dumps and all answer history from this browser. Export a backup first if you might want it back."
        actionLabel="Clear everything"
        cancelLabel="Cancel"
        onAction={async () => {
          await clearEverything();
          await reload();
          setNote('All local data cleared.');
          navigate('/');
        }}
      />
    </VStack>
  );
}
