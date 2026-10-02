// src/app/game/create/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AddIcon,
  LayersIcon,
  ScheduleIcon,
  SearchIcon,
  ShuffleIcon,
  SportsEsportsIcon,
  WarningIcon,
} from "@/components/icons";
import { StatusBadge } from "@/components/game/ui";
import {
  EmptyState,
  LoadErrorState,
  PageHeader,
  PageSkeleton,
  Skeleton,
} from "@/components/shared/states";
import {
  cardClass,
  inputClass,
  labelClass,
  inlineLinkClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/shared/ui";
import type { PageMeta } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { createGame, gameErrorMessage } from "@/lib/game-api";
import { countQuizzes, getQuizById, listQuizPage, type QuizListItem } from "@/lib/quiz-store";
import { formatTimeLimit } from "@/lib/question-model";
import { estimateMinutes } from "@/lib/quiz-status";
import type { Quiz } from "@/types/quiz";

/** "PER_QUESTION" = ใช้เวลาที่ตั้งไว้ในแต่ละข้อ */
type DurationChoice = "PER_QUESTION" | number;
const DURATIONS: DurationChoice[] = ["PER_QUESTION", 10, 20, 30, 60];
/** จำนวนแบบทดสอบต่อครั้งที่โหลด (ค้นหาและแบ่งหน้าที่ backend · ข้อ 8.2) */
const PICKER_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

type PickerItem = Pick<
  QuizListItem,
  "id" | "title" | "questionCount" | "incompleteCount" | "totalTimeLimit"
>;

/** เวลาโดยประมาณจากสรุปของรายการ — ตามที่ตั้งไว้ = เวลารวมทุกข้อ · ตั้งเท่ากัน = จำนวนข้อ × เวลา */
function estimateFor(item: PickerItem | null, duration: DurationChoice) {
  if (!item) return 0;
  const answerSeconds =
    duration === "PER_QUESTION" ? item.totalTimeLimit : item.questionCount * duration;
  return estimateMinutes(item.questionCount, answerSeconds);
}

function toPickerItem(quiz: Quiz): PickerItem {
  const questions = quiz.questions ?? [];
  return {
    id: quiz.id,
    title: quiz.title,
    questionCount: questions.length,
    incompleteCount: 0,
    totalTimeLimit: questions.reduce((s, q) => s + (q.timeLimit || 0), 0),
  };
}

export default function CreateGamePage() {
  const router = useRouter();

  const [items, setItems] = useState<QuizListItem[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [search, setSearch] = useState("");
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [draftCount, setDraftCount] = useState(0);

  const [selectedQuizId, setSelectedQuizId] = useState("");
  /** สรุปของชุดที่เลือก — เก็บแยกเพื่อไม่ให้หายเมื่อค้นหาจนชุดนั้นไม่อยู่ในรายการ */
  const [selectedItem, setSelectedItem] = useState<PickerItem | null>(null);
  /** รายละเอียดเต็มของชุดที่เลือก (เวลาของแต่ละข้อ) */
  const [selectedDetail, setSelectedDetail] = useState<Quiz | null>(null);
  const [preselectDone, setPreselectDone] = useState(false);

  const [duration, setDuration] = useState<DurationChoice>("PER_QUESTION");
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // หน่วงการค้นหา แล้วเริ่มหน้า 1 ใหม่
  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(keyword.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [keyword]);

  // เปิดเกมได้เฉพาะแบบทดสอบที่เผยแพร่แล้ว (ผ่านการตรวจความครบตอนเผยแพร่) — ค้นหา/แบ่งหน้าที่ backend
  useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(() => {
      setListLoading(true);
      setListError(null);
      listQuizPage({ page, limit: PICKER_PAGE_SIZE, status: "PUBLISHED", search })
        .then((res) => {
          if (cancelled) return;
          setItems((current) => (page === 1 ? res.data : [...current, ...res.data]));
          setMeta(res.meta);
        })
        .catch((err: unknown) => {
          if (!cancelled) setListError(err);
        })
        .finally(() => {
          if (!cancelled) setListLoading(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [page, search, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    countQuizzes("DRAFT")
      .then((n) => {
        if (!cancelled) setDraftCount(n);
      })
      .catch(() => {
        // จำนวนแบบร่างเป็นข้อมูลประกอบ — โหลดไม่ได้ก็ไม่ขวางการเปิดห้อง
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // เปิดจากปุ่ม "เปิดห้องเล่นเกม" ของแบบทดสอบ (?quiz=) → เลือกชุดนั้นไว้ให้ ไม่งั้นเลือกชุดแรก
  useEffect(() => {
    if (preselectDone || !meta) return;
    let cancelled = false;
    const wanted = new URLSearchParams(window.location.search).get("quiz");
    const first = items[0] ?? null;
    const pick = (item: PickerItem | null) => {
      if (cancelled) return;
      setPreselectDone(true);
      if (!item) return;
      setSelectedQuizId(item.id);
      setSelectedItem(item);
    };
    const inList = wanted ? items.find((q) => q.id === wanted) : undefined;
    if (!wanted || inList) {
      const t = window.setTimeout(() => pick(inList ?? first), 0);
      return () => {
        cancelled = true;
        window.clearTimeout(t);
      };
    }
    getQuizById(wanted)
      .then((quiz) => pick(quiz && quiz.status === "PUBLISHED" ? toPickerItem(quiz) : first))
      .catch(() => pick(first));
    return () => {
      cancelled = true;
    };
  }, [preselectDone, meta, items]);

  // รายละเอียดชุดที่เลือก (เวลาของแต่ละข้อ)
  useEffect(() => {
    if (!selectedQuizId) return;
    let cancelled = false;
    getQuizById(selectedQuizId)
      .then((quiz) => {
        if (!cancelled) setSelectedDetail(quiz);
      })
      .catch(() => {
        if (!cancelled) setSelectedDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedQuizId]);

  const selectQuiz = useCallback((item: QuizListItem) => {
    setSelectedQuizId(item.id);
    setSelectedItem(item);
    setSelectedDetail(null);
  }, []);

  const selected = selectedItem;
  const detail = selectedDetail?.id === selectedQuizId ? selectedDetail : null;
  const questionCount = selected?.questionCount ?? 0;
  const incomplete = selected?.incompleteCount ?? 0;
  const estimatedMin = estimateFor(selected, duration);
  const times = (detail?.questions ?? []).map((q) => q.timeLimit);
  const timeSummary =
    duration !== "PER_QUESTION"
      ? `${formatTimeLimit(duration)} ทุกข้อ`
      : times.length && times.every((t) => t === times[0])
        ? `${formatTimeLimit(times[0])} (ตามที่ตั้งไว้)`
        : times.length
          ? `${formatTimeLimit(Math.min(...times))}–${formatTimeLimit(Math.max(...times))} (ตามที่ตั้งไว้)`
          : "-";
  const cannotStart = !selected || questionCount === 0 || incomplete > 0;

  const handleCreateGame = () => {
    // กันกด Enter/คลิกซ้ำระหว่างเปิดห้อง (ห้ามเปิดสองห้อง)
    if (creating) return;
    setError("");
    if (!selected) return setError("กรุณาเลือกแบบทดสอบก่อนเปิดห้อง");
    if (questionCount === 0) return setError("แบบทดสอบนี้ยังไม่มีคำถาม กรุณาเพิ่มคำถามก่อน");
    if (incomplete > 0)
      return setError(`มีคำถาม ${incomplete} ข้อที่ยังไม่ครบ กรุณาแก้ไขแบบทดสอบก่อนเปิดห้อง`);

    setCreating(true);
    // backend ทำสำเนาแบบทดสอบ ณ ตอนเปิดห้อง (ตั้งเวลา/สุ่มลำดับตามที่เลือก) — ต้นฉบับไม่เปลี่ยน
    createGame({
      quizId: selected.id,
      timeLimitOverride: duration === "PER_QUESTION" ? null : duration,
      shuffleQuestions,
      shuffleOptions,
    })
      .then((game) => router.push(`/game/${game.id}/host`))
      .catch((err: unknown) => {
        setCreating(false);
        setError(`เปิดห้องไม่สำเร็จ: ${gameErrorMessage(err)}`);
      });
  };

  const retryList = () => setReloadKey((k) => k + 1);
  const initialLoading = !meta && !listError;
  /** ยังไม่มีแบบทดสอบที่เผยแพร่เลย (ไม่ได้ค้นหาอยู่) */
  const noPublished = meta !== null && meta.total === 0 && !search && page === 1;
  const hasMore = meta !== null && meta.page < meta.totalPages;

  if (initialLoading || (!preselectDone && !listError)) return <PageSkeleton />;

  const header = (
    <PageHeader
      title="เปิดห้องเล่นเกม"
      description="เลือกชุดคำถาม ตั้งค่าเวลา แล้วเปิดห้องให้ผู้เล่นเข้าร่วมด้วยรหัสเกม"
    />
  );

  // โหลดรายการแรกไม่สำเร็จ (403/500/เครือข่าย) → แสดงข้อผิดพลาด ไม่ใช่ "ยังไม่มีแบบทดสอบ" (ข้อ 9.3)
  if (listError && !meta) {
    return (
      <div className="space-y-8">
        {header}
        <LoadErrorState error={listError} onRetry={retryList} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {header}

      {noPublished ? (
        <EmptyState
          icon={LayersIcon}
          title={draftCount === 0 ? "ยังไม่มีแบบทดสอบ" : "ยังไม่มีแบบทดสอบที่เผยแพร่"}
          description={
            draftCount === 0
              ? "สร้างแบบทดสอบชุดแรกของคุณก่อนเปิดห้องเล่นเกม"
              : `มีแบบร่าง ${formatNumber(draftCount)} ชุด เปิดแบบทดสอบแล้วกด “บันทึกและเผยแพร่” เพื่อใช้เปิดห้องเล่นเกม`
          }
          action={
            draftCount === 0 ? (
              <Link href="/quiz/create" className={primaryButtonClass}>
                <AddIcon className="h-4 w-4" />
                สร้างแบบทดสอบ
              </Link>
            ) : (
              <Link href="/quiz" className={primaryButtonClass}>
                ไปที่แบบทดสอบของฉัน
              </Link>
            )
          }
        />
      ) : (
        <div className="grid gap-8 xl:grid-cols-3">
          <section aria-labelledby="pick-quiz" className={`${cardClass} xl:col-span-2`}>
            <div className="flex flex-col gap-4 border-b border-outline-variant/40 px-6 py-5 md:flex-row md:items-end md:justify-between">
              <h2 id="pick-quiz" className="font-display text-headline-md text-on-surface">
                เลือกชุดคำถาม
              </h2>
              <div className="space-y-2 md:w-72">
                <label htmlFor="game-quiz-search" className={labelClass}>
                  ค้นหา
                </label>
                <div className="relative">
                  <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-outline" />
                  <input
                    id="game-quiz-search"
                    type="search"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    className={`${inputClass} pl-10`}
                  />
                </div>
              </div>
            </div>

            <fieldset className="max-h-104 space-y-3 overflow-y-auto p-6" aria-busy={listLoading}>
              <legend className="sr-only">ชุดคำถาม</legend>
              {selected && !items.some((q) => q.id === selected.id) && (
                <p className="text-caption text-on-surface-variant">
                  เลือกไว้: <span className="font-medium text-on-surface">{selected.title}</span>
                </p>
              )}
              {items.map((quiz) => {
                const active = selectedQuizId === quiz.id;
                const count = quiz.questionCount;
                return (
                  <label
                    key={quiz.id}
                    className={`flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary-container ${
                      active
                        ? "border-primary-container bg-primary-container/10"
                        : "border-outline-variant/40 hover:border-accent"
                    }`}
                  >
                    <input
                      type="radio"
                      name="game-quiz"
                      value={quiz.id}
                      checked={active}
                      onChange={() => selectQuiz(quiz)}
                      className="h-5 w-5 shrink-0 accent-primary"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body-md font-medium text-on-surface">
                        {quiz.title}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-3 text-label-sm text-on-surface-variant tabular-nums">
                        <span className="inline-flex items-center gap-1.5">
                          <LayersIcon className="h-4 w-4" />
                          {formatNumber(count)} ข้อ
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <ScheduleIcon className="h-4 w-4" />
                          ประมาณ {formatNumber(estimateFor(quiz, duration))} นาที
                        </span>
                        {count === 0 && <StatusBadge tone="warning">ยังไม่มีคำถาม</StatusBadge>}
                      </span>
                    </span>
                  </label>
                );
              })}

              {listLoading && (
                <div role="status" aria-live="polite" className="space-y-3">
                  <span className="sr-only">กำลังโหลดแบบทดสอบ...</span>
                  <Skeleton className="h-20" />
                  <Skeleton className="h-20" />
                </div>
              )}

              {listError !== null && !listLoading && (
                <LoadErrorState error={listError} onRetry={retryList} />
              )}

              {!listLoading && !listError && items.length === 0 && (
                <EmptyState
                  icon={SearchIcon}
                  title="ไม่พบแบบทดสอบที่ค้นหา"
                  description="ลองใช้คำค้นอื่น หรือล้างคำค้นหาเพื่อดูแบบทดสอบทั้งหมด"
                  action={
                    <button
                      type="button"
                      onClick={() => setKeyword("")}
                      className={secondaryButtonClass}
                    >
                      ล้างคำค้นหา
                    </button>
                  }
                />
              )}

              {hasMore && !listLoading && !listError && (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-caption text-on-surface-variant tabular-nums">
                    แสดง {formatNumber(items.length)} จาก {formatNumber(meta?.total ?? 0)} ชุด
                  </p>
                  <button
                    type="button"
                    onClick={() => setPage((p) => p + 1)}
                    className={secondaryButtonClass}
                  >
                    โหลดเพิ่ม
                  </button>
                </div>
              )}

              {draftCount > 0 && (
                <p className="text-caption text-on-surface-variant">
                  แสดงเฉพาะแบบทดสอบที่เผยแพร่แล้ว (มีแบบร่างอีก {formatNumber(draftCount)} ชุดใน{" "}
                  <Link href="/quiz" className={inlineLinkClass}>
                    แบบทดสอบของฉัน
                  </Link>
                  )
                </p>
              )}
            </fieldset>
          </section>

          <aside className="space-y-6">
            <section aria-labelledby="game-settings" className={`${cardClass} space-y-6 p-6`}>
              <h2 id="game-settings" className="font-display text-headline-md text-on-surface">
                ตั้งค่าเกม
              </h2>

              <fieldset>
                <legend className={labelClass}>เวลาต่อข้อ</legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {DURATIONS.map((d) => (
                    <label
                      key={d}
                      className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-2 text-center text-label-md tabular-nums transition-colors ${d === "PER_QUESTION" ? "col-span-2" : ""} has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary-container ${
                        duration === d
                          ? "border-primary-container bg-primary-container text-on-primary"
                          : "border-outline-variant text-on-surface-variant hover:bg-surface-variant/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="game-duration"
                        value={d}
                        checked={duration === d}
                        onChange={() => setDuration(d)}
                        className="sr-only"
                      />
                      {d === "PER_QUESTION"
                        ? "ตามที่ตั้งในแต่ละข้อ"
                        : `${formatTimeLimit(d)} ทุกข้อ`}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="space-y-3">
                <Toggle
                  label="สุ่มลำดับคำถาม"
                  checked={shuffleQuestions}
                  onChange={setShuffleQuestions}
                />
                <Toggle
                  label="สุ่มลำดับตัวเลือก"
                  checked={shuffleOptions}
                  onChange={setShuffleOptions}
                />
              </div>
            </section>

            {selected && (
              <section aria-labelledby="game-summary" className={`${cardClass} p-6`}>
                <h2 id="game-summary" className="text-label-md text-on-surface-variant">
                  สรุปก่อนเริ่ม
                </h2>
                <p className="mt-2 truncate text-body-md font-medium text-on-surface">
                  {selected.title}
                </p>
                <dl className="mt-4 space-y-2 text-body-md">
                  <Line label="จำนวนคำถาม" value={`${formatNumber(questionCount)} ข้อ`} />
                  <Line label="เวลาต่อข้อ" value={timeSummary} />
                  <Line label="เวลาโดยประมาณ" value={`${formatNumber(estimatedMin)} นาที`} />
                </dl>
              </section>
            )}

            {selected && incomplete > 0 && (
              <p className="text-body-md text-error">
                มีคำถาม {incomplete} ข้อที่ยังไม่ครบ{" "}
                <Link href={`/quiz/${selected.id}/edit`} className="underline underline-offset-2">
                  แก้ไขแบบทดสอบ
                </Link>
              </p>
            )}

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg bg-error-container px-4 py-3 text-body-md text-on-error-container"
              >
                <WarningIcon className="mt-1 h-5 w-5 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleCreateGame}
              disabled={cannotStart || creating}
              aria-describedby={cannotStart ? "create-disabled-reason" : undefined}
              aria-busy={creating}
              className={`${primaryButtonClass} w-full ${creating ? "btn-loading" : ""}`}
            >
              <span className="btn-text flex items-center gap-2">
                <SportsEsportsIcon className="h-4 w-4" />
                เปิดห้องเล่นเกม
              </span>
              <span className="dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </button>
            {cannotStart && (
              <p id="create-disabled-reason" className="text-caption text-on-surface-variant">
                เลือกแบบทดสอบที่เผยแพร่แล้วและมีคำถามครบทุกข้อเพื่อเปิดห้อง
              </p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

/* ─────── helpers ─────── */

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className="text-on-surface tabular-nums">{value}</dd>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-outline-variant/40 px-4 py-2.5 text-left text-label-md text-on-surface transition-colors hover:bg-surface-variant/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-container"
    >
      <span className="flex items-center gap-2">
        <ShuffleIcon className="h-4 w-4 text-on-surface-variant" />
        {label}
      </span>
      <span
        className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${checked ? "bg-primary-container" : "bg-outline"}`}
      >
        <span
          className={`h-5 w-5 rounded-full bg-surface-container-lowest shadow-sm transition-transform ${checked ? "translate-x-5" : ""}`}
        />
      </span>
    </button>
  );
}
