"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  AddIcon,
  BarChartIcon,
  CheckCircleIcon,
  ContentCopyIcon,
  DeleteIcon,
  EditIcon,
  ArchiveIcon,
  VisibilityOffIcon,
  QuizIcon,
  RefreshIcon,
  SportsEsportsIcon,
  WarningIcon,
} from "@/components/icons";
import { StatusBadge } from "@/components/game/ui";
import { QuizWorkspaceHeader } from "@/components/quiz/quiz-workspace-header";
import { ConfirmDeleteModal } from "@/components/shared/modal";
import { ErrorAlert, SuccessToast } from "@/components/shared/notice";
import { EmptyState, LoadErrorState, PageSkeleton } from "@/components/shared/states";
import {
  cardClass,
  cardHeaderClass,
  iconButtonClass,
  linkClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/shared/ui";
import { Can } from "@/hooks/use-current-user";
import { errorMessage } from "@/lib/api";
import { Permission } from "@/lib/permissions";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/format";
import { answerTheme } from "@/components/game/answer-theme";
import { AnswerBadge } from "@/components/game/question-view";
import { formatTimeLimit, issueList } from "@/lib/question-model";
import { canPublish, QUIZ_DELETE_CONSEQUENCE, quizStatus, quizSummary } from "@/lib/quiz-status";
import { deleteQuiz, duplicateQuiz, getQuizById, saveQuiz } from "@/lib/quiz-store";
import { listReports, type GameReportSummary } from "@/lib/report-store";
import { getQuestionTypeLabel } from "@/lib/utils";
import type { Quiz, QuizStatus } from "@/types/quiz";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; quiz: Quiz | null }
  | { status: "error"; error: unknown };

export default function QuizOverviewPage() {
  const { id: quizId } = useParams<{ id: string }>();
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [reports, setReports] = useState<GameReportSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState("");
  const [actionError, setActionError] = useState("");
  const clearToast = useCallback(() => setToast(""), []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getQuizById(quizId), listReports(quizId).catch(() => [])])
      .then(([quiz, played]) => {
        if (cancelled) return;
        setState({ status: "ready", quiz });
        setReports(played);
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ status: "error", error: err });
      });
    return () => {
      cancelled = true;
    };
  }, [quizId, attempt]);

  if (state.status === "loading") return <PageSkeleton />;
  if (state.status === "error") {
    return (
      <LoadErrorState
        error={state.error}
        onRetry={() => {
          setState({ status: "loading" });
          setAttempt((n) => n + 1);
        }}
      />
    );
  }

  const { quiz } = state;
  if (!quiz) {
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
  const status = quizStatus(quiz);
  const publishable = canPublish(quiz);

  async function setStatus(next: QuizStatus, message: string) {
    if (!quiz || busy) return;
    setBusy(true);
    setActionError("");
    try {
      const saved = await saveQuiz({ ...quiz, status: next, updatedAt: new Date().toISOString() });
      setState({ status: "ready", quiz: saved });
      setToast(message);
    } catch (err) {
      setActionError(`เปลี่ยนสถานะไม่สำเร็จ: ${errorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    // กันกด Enter/คลิกซ้ำ · ปิดกล่องหลังคำขอเสร็จเท่านั้น (แสดงสถานะกำลังลบระหว่างรอ)
    if (!quiz || deleting) return;
    setDeleting(true);
    setActionError("");
    try {
      await deleteQuiz(quiz.id);
      router.push("/quiz");
    } catch (err) {
      setConfirmDelete(false);
      setActionError(`ลบแบบทดสอบไม่สำเร็จ: ${errorMessage(err)}`);
      setDeleting(false);
    }
  }

  async function handleDuplicate() {
    if (!quiz || busy) return;
    setBusy(true);
    setActionError("");
    try {
      const copy = await duplicateQuiz(quiz.id);
      if (copy) router.push(`/quiz/${copy.id}/edit`);
    } catch (err) {
      setActionError(`ทำสำเนาไม่สำเร็จ: ${errorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  }

  const primaryAction =
    quiz.status === "PUBLISHED" ? (
      <Link href={`/game/create?quiz=${quiz.id}`} className={primaryButtonClass}>
        <SportsEsportsIcon className="h-4 w-4" />
        เปิดห้องเล่นเกม
      </Link>
    ) : quiz.status === "ARCHIVED" ? (
      <button
        type="button"
        onClick={() => setStatus("DRAFT", "กู้คืนเป็นแบบร่างแล้ว")}
        disabled={busy}
        className={primaryButtonClass}
      >
        <RefreshIcon className="h-4 w-4" />
        กู้คืนเป็นแบบร่าง
      </button>
    ) : publishable ? (
      <button
        type="button"
        onClick={() => setStatus("PUBLISHED", "เผยแพร่แล้ว พร้อมเปิดห้องเล่นเกม")}
        disabled={busy}
        className={primaryButtonClass}
      >
        <CheckCircleIcon className="h-4 w-4" />
        เผยแพร่
      </button>
    ) : (
      <Link href={`/quiz/${quiz.id}/edit`} className={primaryButtonClass}>
        <EditIcon className="h-4 w-4" />
        {summary.count === 0 ? "เพิ่มคำถาม" : "แก้คำถามให้ครบ"}
      </Link>
    );

  return (
    <div className="space-y-8">
      <QuizWorkspaceHeader
        quiz={quiz}
        active="overview"
        subtitle={
          <>
            {quiz.description || "ไม่มีรายละเอียด"}
            <span className="mt-1 block text-label-sm">
              แก้ไขล่าสุด {formatRelative(quiz.updatedAt)} · สร้างเมื่อ{" "}
              {formatDateTime(quiz.createdAt)}
            </span>
          </>
        }
        actions={<Can permission={Permission.QUIZ_MANAGE_OWN}>{primaryAction}</Can>}
      />

      <ErrorAlert message={actionError} onClose={() => setActionError("")} />

      <div className="grid gap-8 lg:grid-cols-3">
        {/* ─────────── รายการคำถาม ─────────── */}
        <section
          aria-labelledby="overview-questions"
          className={`${cardClass} min-w-0 lg:col-span-2`}
        >
          <div className={`${cardHeaderClass} flex flex-wrap items-center justify-between gap-3`}>
            <h2 id="overview-questions" className="font-display text-headline-md text-on-surface">
              คำถาม <span className="tabular-nums">({summary.count})</span>
            </h2>
            <Link href={`/quiz/${quiz.id}/edit`} className={secondaryButtonClass}>
              <EditIcon className="h-4 w-4" />
              แก้ไขคำถาม
            </Link>
          </div>

          {summary.count === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={QuizIcon}
                title="ยังไม่มีคำถาม"
                description="เพิ่มคำถามใหม่ หรือดึงคำถามจากคลังคำถาม"
                action={
                  <Link href={`/quiz/${quiz.id}/edit`} className={primaryButtonClass}>
                    <AddIcon className="h-4 w-4" />
                    เพิ่มคำถาม
                  </Link>
                }
              />
            </div>
          ) : (
            <ol className="divide-y divide-outline-variant/40">
              {quiz.questions.map((q, index) => {
                const issues = issueList(q);
                return (
                  <li key={q.id} className="px-6 py-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-label-md text-on-surface-variant tabular-nums">
                            ข้อที่ {index + 1}
                          </span>
                          <StatusBadge tone="info">{getQuestionTypeLabel(q.type)}</StatusBadge>
                          <span className="text-label-sm text-on-surface-variant tabular-nums">
                            {formatTimeLimit(q.timeLimit)} ·{" "}
                            {q.points ? `${formatNumber(q.points)} คะแนน` : "ไม่คิดคะแนน"}
                          </span>
                          {issues.length > 0 && <StatusBadge tone="warning">ยังไม่ครบ</StatusBadge>}
                        </div>
                        <p className="mt-2 text-body-lg font-medium text-on-surface wrap-break-word">
                          {q.prompt || "ยังไม่มีโจทย์"}
                        </p>
                      </div>
                      <Link
                        href={`/quiz/${quiz.id}/edit#q-${q.id}`}
                        className={iconButtonClass}
                        aria-label={`แก้ไขข้อที่ ${index + 1}`}
                      >
                        <EditIcon className="h-5 w-5" />
                      </Link>
                    </div>
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {q.options.map((o, i) => {
                        const theme = answerTheme(i);
                        return (
                          <li
                            key={o.id}
                            className={`flex items-center gap-2 rounded-lg border border-l-4 px-3 py-2 text-body-md ${theme.edge} ${
                              o.isCorrect
                                ? "border-success bg-success/5 text-on-surface"
                                : "border-outline-variant/40 text-on-surface-variant"
                            }`}
                          >
                            <AnswerBadge index={i} />
                            <span className="min-w-0 flex-1 wrap-break-word">{o.text || "—"}</span>
                            {o.isCorrect && (
                              <span className="inline-flex items-center gap-1 text-label-sm text-on-surface">
                                <CheckCircleIcon className="h-4 w-4 text-success" />
                                คำตอบที่ถูก
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* ─────────── แถบข้าง ─────────── */}
        <aside className="space-y-6">
          <section aria-labelledby="overview-summary" className={`${cardClass} p-6`}>
            <h2
              id="overview-summary"
              className="font-display text-body-lg font-semibold text-on-surface"
            >
              สรุป
            </h2>
            <dl className="mt-4 space-y-3 text-body-md">
              <Row label="จำนวนคำถาม" value={`${formatNumber(summary.count)} ข้อ`} />
              <Row
                label="เวลาเล่นโดยประมาณ"
                value={`${formatNumber(summary.estimatedMinutes)} นาที`}
              />
              <Row label="คะแนนฐานรวม" value={formatNumber(summary.maxBasePoints)} />
              <Row
                label="ความครบถ้วน"
                value={
                  summary.incomplete ? (
                    <span className="text-error">ไม่ครบ {summary.incomplete} ข้อ</span>
                  ) : summary.count ? (
                    <span className="font-semibold text-on-surface">ครบทุกข้อ</span>
                  ) : (
                    "—"
                  )
                }
              />
            </dl>
          </section>

          <section aria-labelledby="overview-status" className={`${cardClass} space-y-4 p-6`}>
            <div className="flex items-center justify-between gap-2">
              <h2
                id="overview-status"
                className="font-display text-body-lg font-semibold text-on-surface"
              >
                สถานะ
              </h2>
              <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
            </div>
            <p className="text-body-md text-on-surface-variant">{status.hint}</p>
            {quiz.status === "DRAFT" && !publishable && summary.count > 0 && (
              <p className="flex items-start gap-2 text-label-sm text-error">
                <WarningIcon className="mt-0.5 h-4 w-4 shrink-0" />
                แก้คำถามที่ยังไม่ครบก่อนจึงจะเผยแพร่ได้
              </p>
            )}
            <Can permission={Permission.QUIZ_MANAGE_OWN}>
              <div className="flex flex-col gap-2">
                {quiz.status === "PUBLISHED" && (
                  <button
                    type="button"
                    onClick={() => setStatus("DRAFT", "ยกเลิกการเผยแพร่แล้ว กลับเป็นแบบร่าง")}
                    disabled={busy}
                    className={secondaryButtonClass}
                  >
                    <VisibilityOffIcon className="h-4 w-4" />
                    ยกเลิกการเผยแพร่
                  </button>
                )}
                {quiz.status !== "ARCHIVED" && (
                  <button
                    type="button"
                    onClick={() => setStatus("ARCHIVED", "เก็บถาวรแล้ว")}
                    disabled={busy}
                    className={secondaryButtonClass}
                  >
                    <ArchiveIcon className="h-4 w-4" />
                    เก็บถาวร
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDuplicate}
                  disabled={busy}
                  className={secondaryButtonClass}
                >
                  <ContentCopyIcon className="h-4 w-4" />
                  ทำสำเนาเป็นแบบร่างใหม่
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  disabled={busy || deleting}
                  className={`${secondaryButtonClass} text-error`}
                >
                  <DeleteIcon className="h-4 w-4" />
                  ลบแบบทดสอบ
                </button>
              </div>
            </Can>
          </section>

          <section aria-labelledby="overview-reports" className={`${cardClass} p-6`}>
            <h2
              id="overview-reports"
              className="font-display text-body-lg font-semibold text-on-surface"
            >
              ผลการเล่น
            </h2>
            {reports.length === 0 ? (
              <p className="mt-3 text-body-md text-on-surface-variant">
                ยังไม่มีเกมที่เล่นจบจากแบบทดสอบนี้
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {reports.slice(0, 5).map((r) => (
                  <li key={r.sessionId}>
                    <Link
                      href={`/reports/${r.sessionId}`}
                      className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-surface-variant/50 focus-visible:outline-2 focus-visible:outline-primary-container"
                    >
                      <span className="flex items-center gap-2 text-body-md text-on-surface">
                        <BarChartIcon className="h-4 w-4 text-on-surface-variant" />
                        {formatDateTime(r.finishedAt)}
                      </span>
                      <span className="text-label-sm text-on-surface-variant tabular-nums">
                        {formatNumber(r.totalPlayers)} คน
                      </span>
                    </Link>
                  </li>
                ))}
                {reports.length > 5 && (
                  <li>
                    <Link href="/reports" className={linkClass}>
                      ดูทั้งหมด {formatNumber(reports.length)} เกม
                    </Link>
                  </li>
                )}
              </ul>
            )}
          </section>
        </aside>
      </div>

      <ConfirmDeleteModal
        open={confirmDelete}
        title="ลบแบบทดสอบ"
        itemName={`“${quiz.title || "ไม่มีชื่อ"}”`}
        consequence={QUIZ_DELETE_CONSEQUENCE}
        confirmLabel="ลบแบบทดสอบ"
        busy={deleting}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void handleDelete()}
      />

      <SuccessToast message={toast} onDone={clearToast} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className="text-right text-on-surface tabular-nums">{value}</dd>
    </div>
  );
}
