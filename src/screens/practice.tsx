import {useEffect, useMemo, useRef, useState} from 'react';
import {Banner} from '@astryxdesign/core/Banner';
import {Badge} from '@astryxdesign/core/Badge';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {CheckboxList, CheckboxListItem} from '@astryxdesign/core/CheckboxList';
import {ProgressBar} from '@astryxdesign/core/ProgressBar';
import {RadioList, RadioListItem} from '@astryxdesign/core/RadioList';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Heading, Text} from '@astryxdesign/core/Text';
import {TextArea} from '@astryxdesign/core/TextArea';
import {Bookmark, BookmarkCheck, ChevronRight, LogOut} from 'lucide-react';

import {ErrorNote} from '../components/page';
import {getSession, putSession} from '../lib/db';
import {messageOf} from '../lib/errors';
import {findDump} from '../lib/library';
import {formatAnswer, optionLetter, scorePicked} from '../lib/practice';
import {useProgress} from '../lib/progress';
import {navigate} from '../lib/router';
import type {Dump, Question, Session} from '../lib/types';

export function PracticeScreen({sessionId}: {sessionId: string}) {
  const {map, recordAnswer, setFlag} = useProgress();
  const [session, setSession] = useState<Session | null>(null);
  const [dump, setDump] = useState<Dump | null>(null);
  const [position, setPosition] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const stored = await getSession(sessionId);
      if (!alive) return;
      if (!stored) throw new Error('That session no longer exists. Start a new one.');
      const found = await findDump(stored.dumpId);
      if (!alive) return;
      if (!found) throw new Error('The dump for this session is missing. Import it again.');
      setSession(stored);
      setDump(found.dump);
      setPosition(stored.answers.length);
      if (stored.answers.length >= stored.ids.length && stored.ids.length > 0) {
        navigate(`/results/${stored.id}`);
      }
    })().catch(reason => alive && setError(messageOf(reason)));
    return () => {
      alive = false;
    };
  }, [sessionId]);

  const question = useMemo(() => {
    if (!session || !dump) return null;
    const qid = session.ids[position];
    return dump.questions.find(entry => entry.id === qid) ?? null;
  }, [session, dump, position]);

  if (error) {
    return (
      <VStack gap={4}>
        <ErrorNote message={error} />
        <Button label="Back to practice" variant="secondary" onClick={() => navigate('/')} />
      </VStack>
    );
  }

  if (!session || !dump || !question) {
    return <Text type="supporting">Loading question…</Text>;
  }

  const total = session.ids.length;
  const position_ = position + 1;
  const isLast = position >= total - 1;
  const flagged = Boolean(map.get(question.id)?.flagged);

  const handleAnswer = async (picked: number[], correct: boolean) => {
    if (session.answers.some(answer => answer.qid === question.id)) return;
    const answers = [...session.answers, {qid: question.id, picked, correct, at: Date.now()}];
    const next: Session = {
      ...session,
      answers,
      finishedAt: answers.length === session.ids.length ? Date.now() : undefined,
    };
    setSession(next);
    recordAnswer(question.id, dump.id, correct);
    await putSession(next);
  };

  const handleNext = () => {
    if (isLast) {
      navigate(`/results/${session.id}`);
      return;
    }
    setPosition(current => Math.min(current + 1, session.ids.length - 1));
  };

  return (
    <VStack gap={4}>
      <HStack justify="between" align="center" gap={2} wrap="wrap">
        <Text type="supporting">
          Question {position_} of {total}
        </Text>
        <HStack gap={1}>
          <Button
            variant={flagged ? 'primary' : 'secondary'}
            isIconOnly
            label={flagged ? 'Remove flag' : 'Flag this question'}
            icon={flagged ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
            onClick={() => setFlag(question.id, dump.id, !flagged)}
          />
          <Button
            variant="secondary"
            label="End session"
            icon={<LogOut size={16} />}
            onClick={() => navigate(`/dump/${dump.id}`)}
          />
        </HStack>
      </HStack>

      <ProgressBar label="Session progress" isLabelHidden value={session.answers.length} max={total} hasValueLabel />

      <Card padding={4} className="meso-enter" key={question.id}>
        <QuestionPane
          question={question}
          questionNumber={position_}
          isLast={isLast}
          onAnswer={handleAnswer}
          onNext={handleNext}
          onFlag={() => setFlag(question.id, dump.id, !flagged)}
        />
      </Card>
    </VStack>
  );
}

function QuestionPane({
  question,
  questionNumber,
  isLast,
  onAnswer,
  onNext,
  onFlag,
}: {
  question: Question;
  questionNumber: number;
  isLast: boolean;
  onAnswer: (picked: number[], correct: boolean) => void;
  onNext: () => void;
  onFlag: () => void;
}) {
  const [picked, setPicked] = useState<number[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [graded, setGraded] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [typed, setTyped] = useState('');
  const revealedRef = useRef(false);
  const gradedRef = useRef(false);

  const reveal = (selection: number[], isCorrect: boolean) => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    gradedRef.current = true;
    setPicked(selection);
    setCorrect(isCorrect);
    setRevealed(true);
    setGraded(true);
    onAnswer(selection, isCorrect);
  };

  const chooseSingle = (index: number) => {
    if (revealedRef.current) return;
    reveal([index], question.answer.length === 1 && question.answer[0] === index);
  };

  const confirmMulti = () => {
    if (revealedRef.current || picked.length === 0) return;
    reveal(picked, scorePicked(question, picked));
  };

  const showAnswer = () => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    setRevealed(true);
  };

  const grade = (isCorrect: boolean) => {
    if (gradedRef.current) return;
    gradedRef.current = true;
    setCorrect(isCorrect);
    setGraded(true);
    onAnswer([], isCorrect);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLTextAreaElement) return;
      const key = event.key;

      if (key === 'Enter') {
        if (gradedRef.current) {
          event.preventDefault();
          onNext();
        } else if (question.type === 'multi_choice' && picked.length > 0) {
          event.preventDefault();
          confirmMulti();
        }
        return;
      }

      if (key.toLowerCase() === 'f' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        onFlag();
        return;
      }

      if (revealedRef.current) return;
      if (!/^[1-8]$/.test(key)) return;
      const index = Number(key) - 1;
      if (index >= question.options.length) return;

      if (question.type === 'single_choice' || question.type === 'true_false') {
        chooseSingle(index);
      } else if (question.type === 'multi_choice') {
        setPicked(previous =>
          previous.includes(index) ? previous.filter(value => value !== index) : [...previous, index],
        );
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const isChoice = question.type !== 'short_answer';
  const correctMark = (index: number) =>
    revealed && question.answer.includes(index) ? <Badge label="Correct" variant="success" /> : undefined;

  return (
    <VStack gap={4}>
      <VStack gap={1}>
        <Text type="supporting">
          {typeLabel(question.type)}
          {question.tags.length > 0 ? ` · ${question.tags.join(' · ')}` : ''}
        </Text>
        <Heading level={2} className="meso-wrap">
          {question.stem}
        </Heading>
      </VStack>

      {question.type === 'multi_choice' ? (
        <VStack gap={3}>
          <CheckboxList
            label="Select all that apply"
            value={picked.map(String)}
            onChange={values => setPicked(values.map(Number))}
            isDisabled={revealed}
          >
            {question.options.map((option, index) => (
              <CheckboxListItem
                key={index}
                value={String(index)}
                label={`${optionLetter(index)}. ${option}`}
                endContent={correctMark(index)}
              />
            ))}
          </CheckboxList>
          {!revealed ? (
            <HStack>
              <Button
                variant="primary"
                label="Confirm answer"
                isDisabled={picked.length === 0}
                onClick={confirmMulti}
              />
            </HStack>
          ) : null}
        </VStack>
      ) : question.type === 'short_answer' ? (
        <VStack gap={3}>
          <TextArea
            label="Your answer (optional)"
            description="Think it through, then reveal the model answer. Nothing is uploaded."
            placeholder="Write your answer here if you want…"
            value={typed}
            onChange={setTyped}
            rows={3}
            isDisabled={revealed}
          />
          {!revealed ? (
            <HStack>
              <Button variant="primary" label="Show answer" onClick={showAnswer} />
            </HStack>
          ) : (
            <VStack gap={2}>
              {!graded ? (
                <>
                  <Text type="label" weight="bold">
                    How did you do?
                  </Text>
                  <HStack gap={2} wrap="wrap">
                    <Button variant="primary" label="I got it" onClick={() => grade(true)} />
                    <Button variant="secondary" label="I missed it" onClick={() => grade(false)} />
                  </HStack>
                </>
              ) : (
                <Text type="supporting" display="block">
                  {correct ? 'Marked as known.' : 'Marked for review.'}
                </Text>
              )}
            </VStack>
          )}
        </VStack>
      ) : (
        <RadioList
          label={question.type === 'true_false' ? 'True or false?' : 'Choose one answer'}
          value={picked.length > 0 ? String(picked[0]) : ''}
          onChange={value => chooseSingle(Number(value))}
          isDisabled={revealed}
        >
          {question.options.map((option, index) => (
            <RadioListItem
              key={index}
              value={String(index)}
              label={
                question.type === 'true_false' ? option : `${optionLetter(index)}. ${option}`
              }
              endContent={correctMark(index)}
            />
          ))}
        </RadioList>
      )}

      {revealed && isChoice ? (
        <FeedbackBanner
          question={question}
          correct={correct}
          picked={picked}
          explanation={question.explanation}
        />
      ) : null}

      {revealed && !isChoice ? (
        <Banner
          status="info"
          title="Model answer"
          description={question.answer.length > 0 ? formatAnswer(question) : undefined}
          collapsible={false}
        >
          <Text display="block" className="meso-wrap">
            {question.explanation}
          </Text>
        </Banner>
      ) : null}

      <HStack justify="between" align="center" gap={2} wrap="wrap">
        <Text type="supporting">
          {question.type === 'short_answer'
            ? `Enter after grading · F flags · Question ${questionNumber}`
            : `Keys: 1–${question.options.length} · Enter next · F flags · Question ${questionNumber}`}
        </Text>
        {revealed && (isChoice || graded) ? (
          <Button
            variant="primary"
            label={isLast ? 'See results' : 'Next question'}
            icon={<ChevronRight size={16} />}
            onClick={onNext}
          />
        ) : null}
      </HStack>
    </VStack>
  );
}

function FeedbackBanner({
  question,
  correct,
  picked,
  explanation,
}: {
  question: Question;
  correct: boolean;
  picked: number[];
  explanation: string;
}) {
  const title = correct
    ? 'Correct'
    : question.type === 'multi_choice'
      ? `Not quite — ${picked.filter(index => question.answer.includes(index)).length} of ${question.answer.length} correct options picked`
      : 'Not quite';

  return (
    <Banner
      status={correct ? 'success' : 'error'}
      title={title}
      description={`Answer: ${formatAnswer(question)}`}
      collapsible={false}
    >
      {explanation ? (
        <Text display="block" className="meso-wrap">
          {explanation}
        </Text>
      ) : null}
    </Banner>
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
