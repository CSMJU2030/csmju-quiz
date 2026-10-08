"use client";

// หน้าทดลองเล่น — ใช้ชิ้นส่วนหน้าคำถามและสูตรคะแนนเดียวกับเกมจริง
// ผลการทดลองไม่ถูกบันทึกเป็นรายงาน

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckIcon,
  CloseIcon,
  EditIcon,
  LocalFireDepartmentIcon,
  PlayArrowIcon,
  QuizIcon,
  RefreshIcon,
  ScheduleIcon,
  SkipNextIcon,
} from "@/components/icons";
import { AnswerOptionButton, QuestionPrompt, TimerRing } from "@/components/game/question-view";
import { StatusBadge } from "@/components/game/ui";
import { QuizWorkspaceHeader } from "@/components/quiz/quiz-workspace-header";
import { EmptyState, LoadErrorState, PageSkeleton } from "@/components/shared/states";
import {
  cardClass,
  iconButtonClass,
  primaryButtonClass,
  secondaryButtonClass,
  tdClass,
  thClass,
} from "@/components/shared/ui";
import { formatNumber, formatPercent } from "@/lib/format";
import { calculatePoints } from "@/lib/scoring";
import { formatTimeLimit, issueList } from "@/lib/question-model";
import { quizSummary } from "@/lib/quiz-status";
import { getQuizById } from "@/lib/quiz-store";
import { getQuestionTypeLabel } from "@/lib/utils";
import type { Quiz } from "@/types/quiz";

type Phase = "intro" | "question" | "result" | "summary";

interface PreviewAnswer {
  optionId: string | null;
  correct: boolean;
  points: number;
  seconds: number;
}

const URGENT_SEC = 5;

export default function QuizPreviewPage() {
  const { id: quizId } = useParams<{ id: string }>();
  const [quiz, setQuiz] = useState<Quiz | null | undefined>(undefined);

  const [phase, setPhase] = useState<Phase>("intro");
  const [index, setIndex] = useState(0);
  const [timed, setTimed] = useState(true);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [answers, setAnswers] = useState<Record<string, PreviewAnswer>>({});
  const [streak, setStreak] = useState(0);
  const resultRef = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getQuizById(quizId)
      .then((q) => {
        if (!cancelled) setQuiz(q);
      })
      .catch((err: unknown) => {
        // 403 / 500 / เครือข่าย — แสดงสถานะผิดพลาดแทน skeleton ค้าง (ข้อ 9.3)
        if (!cancelled) setLoadError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [quizId, reloadKey]);

  const retryLoad = useCallback(() => {
    setLoadError(null);
    setQuiz(undefined);
    setReloadKey((k) => k + 1);
  }, []);

  const questions = useMemo(() => quiz?.questions ?? [], [quiz]);
  const question = questions[index] ?? null;
  const total = questions.length;
  const current = question ? answers[question.id] : undefined;

  const durationSec = question?.timeLimit || 20;
  const elapsedSec = phase === "question" ? Math.max(0, (now - startedAt) / 1000) : 0;
  const remainingSec = Math.max(0, durationSec - elapsedSec);
  const secondsLeft = Math.ceil(remainingSec);

  const totalScore = Object.values(answers).reduce((s, a) => s + a.points, 0);
  const correctCount = Object.values(answers).filter((a) => a.correct).length;

  const beginQuestion = useCallback((i: number) => {
    const t = Date.now();
    setIndex(i);
    setStartedAt(t);
    setNow(t);
    setPhase("question");
  }, []);

  const answer = useCallback(
    (optionId: string | null) => {
      if (!question || phase !== "question") return;
      const t = Date.now();
      const seconds = Math.max(0, (t - startedAt) / 1000);
      const option = optionId ? question.options.find((o) => o.id === optionId) : undefined;
      const correct = option?.isCorrect === true;
      const nextStreak = correct ? streak + 1 : 0;
      const points = calculatePoints({
        correct,
        basePoints: question.points,
        speed: timed ? 1 - seconds / (question.timeLimit || 20) : 1,
        streak: nextStreak,
      });
      setStreak(nextStreak);
      setAnswers((a) => ({ ...a, [question.id]: { optionId, correct, points, seconds } }));
      setPhase("result");
      window.setTimeout(() => resultRef.current?.focus(), 0);
    },
    [question, phase, startedAt, streak, timed],
  );

  // นาฬิกา — setState ใน callback ของ interval (ไม่ใช่ใน body ของ effect)
  useEffect(() => {
    if (phase !== "question" || !timed) return;
    const t = window.setInterval(() => {
      const n = Date.now();
      setNow(n);
      if ((n - startedAt) / 1000 >= durationSec) answer(null);
    }, 100);
    return () => window.clearInterval(t);
  }, [phase, timed, startedAt, durationSec, answer]);

  // ปุ่มตัวเลข 1–4 เลือกคำตอบ, Enter ไปข้อถัดไป
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!question) return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (phase === "question") {
        const n = Number(e.key);
        const opt = question.options[n - 1];
        if (opt) answer(opt.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, question, answer]);

  /** ข้อที่ตอบแล้วเปิดดูผลได้อย่างเดียว ตอบซ้ำไม่ได้ (คะแนน/streak ไม่ถูกนับซ้ำ) */
  function openQuestion(i: number) {
    const target = questions[i];
    if (!target) return;
    if (answers[target.id]) {
      setIndex(i);
      setPhase("result");
      window.setTimeout(() => resultRef.current?.focus(), 0);
    } else {
      beginQuestion(i);
    }
  }

  function goNext() {
    if (index + 1 < total) openQuestion(index + 1);
    else setPhase("summary");
  }

  function restart() {
    setAnswers({});
    setStreak(0);
    setPhase("intro");
    setIndex(0);
  }

  if (loadError) {
    return (
      <LoadErrorState
        error={loadError}
        onRetry={retryLoad}
        notFoundTitle="ไม่พบแบบทดสอบ"
        action={
          <Link href="/quiz" className={secondaryButtonClass}>
            กลับไปแบบทดสอบของฉัน
          </Link>
        }
      />
    );
  }
  if (quiz === undefined) return <PageSkeleton />;
  if (quiz === null) {
    return (
      <EmptyState
        icon={QuizIcon}
        title="ไม่พบแบบทดสอบ"
        description="ไม่พบข้อมูลที่คุณกำลังค้นหา อาจถูกลบไปแล้วหรือลิงก์ไม่ถูกต้อง"
        action={
          <Link href="/quiz" className={secondaryButtonClass}>
            กลับไปแบบทดสอบของฉัน
          </Link>
        }
      />
    );
  }

  const summary = quizSummary(quiz);
  const header = (
    <QuizWorkspaceHeader
      quiz={quiz}
      active="preview"
      subtitle="ทดลองเล่นแบบที่ผู้เล่นจะเห็น ผลการทดลองไม่ถูกบันทึก"
    />
  );

  if (total === 0) {
    return (
      <div className="space-y-8">
        {header}
        <EmptyState
          icon={QuizIcon}
          title="ยังไม่มีคำถามให้ทดลองเล่น"
          description="เพิ่มคำถามอย่างน้อย 1 ข้อ แล้วกลับมาทดลองเล่น"
          action={
            <Link href={`/quiz/${quiz.id}/edit`} className={primaryButtonClass}>
              <EditIcon className="h-4 w-4" />
              ไปที่คำถาม
            </Link>
          }
        />
      </div>
    );
  }

  /* ─────────── หน้าเริ่ม ─────────── */
  if (phase === "intro") {
    return (
      <div className="space-y-8">
        {header}
        <section className={`${cardClass} mx-auto max-w-2xl space-y-6 p-8 text-center`}>
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary-container/10 text-primary-container">
            <PlayArrowIcon className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-display text-headline-md text-on-surface">พร้อมทดลองเล่น</h2>
            <p className="mt-1 text-body-md text-on-surface-variant tabular-nums">
              {formatNumber(total)} ข้อ · ประมาณ {formatNumber(summary.estimatedMinutes)} นาที
            </p>
          </div>
          {summary.incomplete > 0 && (
            <p className="rounded-lg bg-brand-amber/15 px-4 py-3 text-body-md text-on-surface">
              มี {formatNumber(summary.incomplete)} ข้อที่ยังไม่ครบ ทดลองได้ แต่ยังเผยแพร่ไม่ได้
            </p>
          )}
          <button
            type="button"
            role="switch"
            aria-checked={timed}
            onClick={() => setTimed((t) => !t)}
            className="mx-auto flex min-h-11 w-full max-w-sm items-center justify-between gap-3 rounded-lg border border-outline-variant/40 px-4 py-2.5 text-left text-label-md text-on-surface hover:bg-surface-variant/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-container"
          >
            <span className="flex items-center gap-2">
              <ScheduleIcon className="h-4 w-4 text-on-surface-variant" />
              จับเวลาเหมือนเกมจริง
            </span>
            <span
              className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${timed ? "bg-primary-container" : "bg-outline"}`}
            >
              <span
                className={`h-5 w-5 rounded-full bg-surface-container-lowest shadow-sm transition-transform ${timed ? "translate-x-5" : ""}`}
              />
            </span>
          </button>
          <button type="button" onClick={() => beginQuestion(0)} className={primaryButtonClass}>
            <PlayArrowIcon className="h-4 w-4" />
            เริ่มทดลองเล่น
          </button>
        </section>
      </div>
    );
  }

  /* ─────────── สรุปผล ─────────── */
  if (phase === "summary") {
    return (
      <div className="space-y-8">
        {header}
        <section aria-labelledby="preview-summary" className={`${cardClass} mx-auto max-w-3xl`}>
          <div className="space-y-2 border-b border-outline-variant/40 p-6 text-center">
            <h2 id="preview-summary" className="font-display text-headline-md text-on-surface">
              ทดลองเล่นจบแล้ว
            </h2>
            <p className="font-display text-display-lg text-primary-container tabular-nums">
              {formatNumber(totalScore)}
            </p>
            <p className="text-body-md text-on-surface-variant tabular-nums">
              ตอบถูก {formatNumber(correctCount)}/{formatNumber(total)} ข้อ (
              {formatPercent((correctCount / total) * 100)})
            </p>
          </div>
          <div className="relative overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-outline-variant/40 bg-surface text-label-md text-on-surface-variant">
                  <th scope="col" className={thClass}>
                    ข้อ
                  </th>
                  <th scope="col" className={thClass}>
                    โจทย์
                  </th>
                  <th scope="col" className={`${thClass} text-right`}>
                    ผล
                  </th>
                  <th scope="col" className={`${thClass} text-right`}>
                    คะแนน
                  </th>
                  <th scope="col" className={thClass}>
                    <span className="sr-only">แก้ไข</span>
                  </th>
                </tr>
              </thead>
              <tbody className="text-body-md">
                {questions.map((q, i) => {
                  const a = answers[q.id];
                  return (
                    <tr key={q.id} className="border-b border-outline-variant/40 last:border-0">
                      <td className={`${tdClass} tabular-nums`}>{i + 1}</td>
                      <td className={`${tdClass} max-w-xs truncate`}>{q.prompt}</td>
                      <td className={`${tdClass} text-right`}>
                        {!a ? (
                          <span className="text-on-surface-variant">—</span>
                        ) : a.correct ? (
                          <span className="inline-flex items-center gap-1 text-on-surface">
                            <CheckIcon className="h-4 w-4 text-success" />
                            ถูก
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-error">
                            <CloseIcon className="h-4 w-4" />
                            {a.optionId ? "ผิด" : "หมดเวลา"}
                          </span>
                        )}
                      </td>
                      <td className={`${tdClass} text-right tabular-nums`}>
                        {formatNumber(a?.points ?? 0)}
                      </td>
                      <td className={tdClass}>
                        <Link
                          href={`/quiz/${quiz.id}/edit#q-${q.id}`}
                          className={iconButtonClass}
                          aria-label={`แก้ไขข้อที่ ${i + 1}`}
                        >
                          <EditIcon className="h-5 w-5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap justify-center gap-3 border-t border-outline-variant/40 p-6">
            <button type="button" onClick={restart} className={secondaryButtonClass}>
              <RefreshIcon className="h-4 w-4" />
              เล่นอีกครั้ง
            </button>
            <Link href={`/quiz/${quiz.id}`} className={primaryButtonClass}>
              กลับไปภาพรวม
            </Link>
          </div>
        </section>
      </div>
    );
  }

  /* ─────────── ระหว่างเล่น ─────────── */
  if (!question) return null;
  const showResult = phase === "result";
  const issues = issueList(question);

  return (
    <div className="space-y-6">
      {header}

      <nav aria-label="ไปยังข้อ" className="flex flex-wrap items-center gap-2">
        {questions.map((q, i) => {
          const a = answers[q.id];
          const isCurrent = i === index;
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => {
                if (!isCurrent) openQuestion(i);
              }}
              aria-current={isCurrent ? "step" : undefined}
              aria-label={`ข้อที่ ${i + 1}${a ? (a.correct ? " ตอบถูก" : " ตอบไม่ถูก") : ""}`}
              className={`grid h-11 w-11 place-items-center rounded-lg border text-label-md tabular-nums transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-container ${
                isCurrent
                  ? "border-primary-container bg-primary-container text-on-primary"
                  : a
                    ? a.correct
                      ? "border-success bg-success/10 text-on-surface"
                      : "border-error bg-error-container text-on-error-container"
                    : "border-outline-variant text-on-surface-variant hover:bg-surface-variant/50"
              }`}
            >
              {i + 1}
            </button>
          );
        })}
      </nav>

      <section
        aria-label={`คำถามข้อที่ ${index + 1}`}
        className="mx-auto max-w-4xl overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-lowest shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="info">
              ข้อ {index + 1}/{total}
            </StatusBadge>
            <StatusBadge tone="neutral">{getQuestionTypeLabel(question.type)}</StatusBadge>
            {issues.length > 0 && <StatusBadge tone="warning">ยังไม่ครบ</StatusBadge>}
          </div>
          <div className="flex items-center gap-2">
            {streak >= 2 && (
              <span className="inline-flex items-center gap-1 text-label-sm text-on-surface">
                <LocalFireDepartmentIcon className="h-4 w-4 text-brand-amber" />
                ตอบถูกติดกัน {formatNumber(streak)} ข้อ
              </span>
            )}
            <span className="rounded-full bg-primary-container px-3 py-1 text-label-sm text-on-primary tabular-nums">
              {formatNumber(totalScore)} คะแนน
            </span>
            <Link
              href={`/quiz/${quiz.id}/edit#q-${question.id}`}
              className={iconButtonClass}
              aria-label={`แก้ไขข้อที่ ${index + 1}`}
            >
              <EditIcon className="h-5 w-5" />
            </Link>
          </div>
        </div>

        <div
          className="mt-3 h-1 bg-surface-variant"
          role="progressbar"
          aria-label="ความคืบหน้า"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={index + 1}
        >
          <div
            className="h-full bg-primary-container transition-[width] duration-300"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>

        <div className="px-4 pt-6">
          <QuestionPrompt prompt={question.prompt || "ยังไม่มีโจทย์"} image={question.image} />
        </div>

        <div className="my-5 flex items-center justify-center">
          {phase === "question" && timed ? (
            <TimerRing
              ratio={remainingSec / durationSec}
              seconds={secondsLeft}
              urgent={secondsLeft <= URGENT_SEC}
            />
          ) : phase === "question" ? (
            <p className="text-label-md text-on-surface-variant">
              ไม่จับเวลา (เกมจริง {formatTimeLimit(durationSec)})
            </p>
          ) : null}
        </div>

        <div className="grid gap-3 p-4 md:grid-cols-2">
          {question.options.map((option, i) => (
            <AnswerOptionButton
              key={option.id}
              option={option}
              index={i}
              mine={current?.optionId === option.id}
              showResult={showResult}
              locked={phase !== "question"}
              onSelect={() => answer(option.id)}
              showKeyHint
            />
          ))}
        </div>

        <div
          ref={resultRef}
          tabIndex={-1}
          aria-live="polite"
          className="border-t border-outline-variant/40 bg-surface p-4"
        >
          {phase === "question" ? (
            <p className="text-center text-body-md text-on-surface-variant">
              เลือกคำตอบ หรือกดปุ่มตัวเลข 1–{question.options.length} บนแป้นพิมพ์
            </p>
          ) : current ? (
            <div className="flex flex-col items-center gap-3">
              <p
                className={`flex items-center gap-2 text-body-lg font-bold ${
                  current.correct ? "text-on-surface" : "text-error"
                }`}
              >
                {current.correct ? (
                  <CheckIcon className="h-6 w-6 text-success" />
                ) : (
                  <CloseIcon className="h-6 w-6" />
                )}
                {current.correct ? "ถูกต้อง" : current.optionId ? "ยังไม่ถูก" : "หมดเวลา"}
                {current.points > 0 && (
                  <span className="text-primary-container tabular-nums">
                    +{formatNumber(current.points)} คะแนน
                  </span>
                )}
              </p>
              {current.correct && question.points === 0 && (
                <p className="text-label-sm text-on-surface-variant">
                  ข้อนี้ตั้งเป็น “ไม่คิดคะแนน”
                </p>
              )}
              <button type="button" onClick={goNext} className={primaryButtonClass}>
                {index + 1 < total ? (
                  <>
                    <SkipNextIcon className="h-4 w-4" />
                    ข้อถัดไป
                  </>
                ) : (
                  "ดูสรุปผล"
                )}
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
