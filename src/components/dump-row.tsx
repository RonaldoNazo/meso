import {Badge} from '@astryxdesign/core/Badge';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {ProgressBar} from '@astryxdesign/core/ProgressBar';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Heading, Text} from '@astryxdesign/core/Text';
import {Play} from 'lucide-react';

import type {DumpMeta} from '../lib/types';

export function DumpRow({
  meta,
  done,
  wrong,
  busy,
  count,
  showContext = true,
  onStart,
  onOpen,
}: {
  meta: DumpMeta;
  done: number;
  wrong: number;
  busy: boolean;
  count: number;
  showContext?: boolean;
  onStart: () => void;
  onOpen: () => void;
}) {
  const total = Math.max(meta.count, done);
  const metaLine = showContext
    ? [meta.university, meta.course, meta.year].filter(Boolean).join(' · ')
    : '';
  const startCount = Math.min(count, Math.max(1, total));

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack justify="between" align="start" gap={3} wrap="wrap">
          <VStack gap={1} maxWidth={620}>
            <Heading level={3}>{meta.title}</Heading>
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
