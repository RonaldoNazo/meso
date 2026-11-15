import type {ReactNode} from 'react';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Heading, Text} from '@astryxdesign/core/Text';

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <HStack justify="between" align="start" gap={3} wrap="wrap">
      <VStack gap={1} maxWidth={620}>
        <Heading level={1}>{title}</Heading>
        {description ? (
          <Text type="supporting" display="block" className="meso-wrap">
            {description}
          </Text>
        ) : null}
      </VStack>
      {actions ? (
        <HStack gap={2} wrap="wrap">
          {actions}
        </HStack>
      ) : null}
    </HStack>
  );
}

export function StatTile({label, value}: {label: string; value: string | number}) {
  return (
    <Card padding={3}>
      <VStack gap={0.5}>
        <Text type="supporting">{label}</Text>
        <Text type="large" weight="bold" hasTabularNumbers>
          {value}
        </Text>
      </VStack>
    </Card>
  );
}

export function ErrorNote({message, onRetry}: {message: string; onRetry?: () => void}) {
  return (
    <Banner
      status="error"
      title="Something went wrong"
      description={message}
      collapsible={false}
      endContent={
        onRetry ? <Button variant="secondary" size="sm" label="Try again" onClick={onRetry} /> : undefined
      }
    />
  );
}
