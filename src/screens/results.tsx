import {useEffect, useMemo, useState} from 'react';
import {Badge} from '@astryxdesign/core/Badge';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {ProgressBar} from '@astryxdesign/core/ProgressBar';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Heading, Text} from '@astryxdesign/core/Text';
import {ArrowLeft, Play, RotateCcw} from 'lucide-react';

import {ErrorNote, PageHeader} from '../components/page';
import {getSession} from '../lib/db';
import {messageOf} from '../lib/errors';
import {findDump} from '../lib/library';
import {formatAnswer, optionLetter} from '../lib/practice';
import {navigate} from '../lib/router';
import {createRetrySession, createSession} from '../lib/sessions';
import {useProgress} from '../lib/progress';
import {useSettings} from '../lib/useSettings';
import type {Dump, Question, Session} from '../lib/types';

export function ResultsScreen({sessionId}: {sessionId: string}) {
  const {map} = useProgress();
  const [settings] = useSettings();
  const [session, setSession] = useState<Session | null>(null);
  const [dump, setDump] = useState<Dump | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const stored = await getSession(sessionId);
      if (!alive) return;
      if (!stored) throw new Error('That session no longer exists.');
      const found = await findDump(stored.dumpId);
      if (!alive) return;
      if (!found) throw new Error('The dump for this session is missing.');
      setSession(stored);
      setDump(found.dump);
    })().catch(reason => alive && setError(messageOf(reason)));
    return () => {
      alive = false;
    };
  }, [sessionId]);

  const byId = useMemo(() => {
    const lookup = new Map<string, Question>();
    dump?.questions.forEach(question => lookup.set(question.id, question));
    return lookup;
  }, [dump]);

  if (error) {
    return (
      <VStack gap={4}>
        <ErrorNote message={error} />
        <Button label="Back to practice" variant="secondary" onClick={() => navigate('/')} />
      </VStack>
    );
  }

  if (!session || !dump) return <Text type="supporting">Loading results…</Text>;

  const answered = session.answers;
  const correctCount = answered.filter(answer => answer.correct).length;
  const wrongAnswers = answered.filter(answer => !answer.correct);
  const score = answered.length === 0 ? 0 : Math.round((correctCount / answered.length) * 100);
  const finished = answered.length >= session.ids.length;

  const retry = async () => {
    setBusy(true);
    try {
      const next = await createRetrySession(dump.id, wrongAnswers.map(answer => answer.qid));
      navigate(`/practice/${next.id}`);
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  };

  const restart = async () => {
    setBusy(true);
    try {
      const next = await createSession(dump, map, 'mixed', settings.count);
      navigate(`/practice/${next.id}`);
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <VStack gap={5}>
      <PageHeader
        title={finished ? 'Session complete' : `${answered.length} of ${session.ids.length} answered`}
        description={dump.title}
        actions={
          <Button
            variant="secondary"
            label="Back to dump"
            icon={<ArrowLeft size={16} />}
            onClick={() => navigate(`/dump/${dump.id}`)}
          />
        }
      />

      {error ? <ErrorNote message={error} /> : null}

      <Card padding={4}>
        <VStack gap={3}>
          <HStack justify="between" align="center" gap={3} wrap="wrap">
            <VStack gap={0.5}>
              <Text type="supporting">Score this session</Text>
              <Heading level={2}>
                {correctCount} / {answered.length} · {score}%
              </Heading>
            </VStack>
            <Badge
              label={`${wrongAnswers.length} to review`}
              variant={wrongAnswers.length === 0 ? 'success' : 'warning'}
            />
          </HStack>
          <ProgressBar
            label="Session score"
            value={correctCount}
            max={Math.max(answered.length, 1)}
            hasValueLabel
            variant={score >= 70 ? 'success' : 'accent'}
          />
          <HStack gap={2} wrap="wrap">
            {wrongAnswers.length > 0 ? (
              <Button
                variant="primary"
                label={`Retry ${wrongAnswers.length} missed`}
                icon={<RotateCcw size={16} />}
                isLoading={busy}
                onClick={retry}
              />
            ) : null}
            <Button
              variant="secondary"
              label={`New ${Math.min(settings.count, dump.count)}`}
              icon={<Play size={16} />}
              isLoading={busy}
              onClick={restart}
            />
            {!finished ? (
              <Button
                variant="secondary"
                label="Continue this session"
                onClick={() => navigate(`/practice/${session.id}`)}
              />
            ) : null}
          </HStack>
        </VStack>
      </Card>

      {wrongAnswers.length > 0 ? (
        <VStack gap={3}>
          <Heading level={2}>Review</Heading>
          {wrongAnswers.map(answer => {
            const question = byId.get(answer.qid);
            if (!question) return null;
            return (
              <Card key={answer.qid} padding={4} variant="muted">
                <VStack gap={2}>
                  <Text type="supporting">
                    {typeLabel(question.type)}
                    {question.tags.length > 0 ? ` · ${question.tags.join(' · ')}` : ''}
                  </Text>
                  <Text display="block" weight="bold" className="meso-wrap">
                    {question.stem}
                  </Text>
                  <Text type="supporting" display="block">
                    Your answer:{' '}
                    {answer.picked.length === 0
                      ? 'self-graded as missed'
                      : answer.picked.map(optionLetter).join(', ')}
                  </Text>
                  <Text display="block">
                    Correct answer: {formatAnswer(question)}
                  </Text>
                  {question.explanation ? (
                    <Text type="supporting" display="block" className="meso-wrap">
                      {question.explanation}
                    </Text>
                  ) : null}
                </VStack>
              </Card>
            );
          })}
        </VStack>
      ) : (
        <Text type="supporting" display="block">
          Nothing to review in this session.
        </Text>
      )}
    </VStack>
  );
}

function typeLabel(type: Question['type']): string {
  switch (type) {
    case 'single_choice':
      return 'Single choice';
    case 'multi_choice':
      return 'Multiple choice';
    case 'true_false':
      return 'True / false';
    case 'short_answer':
      return 'Short answer';
  }
}
