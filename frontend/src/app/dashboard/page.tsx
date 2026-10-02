// src/app/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AddIcon,
  ArrowForwardIcon,
  CheckIcon,
  HubIcon,
  MenuBookIcon,
  ScheduleIcon,
  SportsEsportsIcon,
} from "@/components/icons";
import { OpenRooms } from "@/components/game/open-rooms";
import { RecentGames } from "@/components/game/recent-games";
import { StatCard, StatusBadge } from "@/components/game/ui";
import { EmptyState, LoadErrorState, PageHeader, Skeleton } from "@/components/shared/states";
import {
  cardClass,
  linkClass,
  primaryButtonClass,
  secondaryButtonClass,
  tonalButtonClass,
} from "@/components/shared/ui";
import { Can } from "@/hooks/use-current-user";
import { formatNumber } from "@/lib/format";
import { Permission } from "@/lib/permissions";
import { countBankItems } from "@/lib/question-bank";
import { countQuizzes, listQuizPage, type QuizListItem } from "@/lib/quiz-store";
import { quizStatus } from "@/lib/quiz-status";

type LoadState = "loading" | "ready" | "error";

interface DashboardCounts {
  /** ตรงกับแท็บ "ทั้งหมด" ของ /quiz (แบบร่าง + เผยแพร่แล้ว ไม่รวมเก็บถาวร) */
  active: number;
  published: number;
  draft: number;
  bank: number;
}

export default function DashboardPage() {
  const [recentQuizzes, setRecentQuizzes] = useState<QuizListItem[]>([]);
  const [counts, setCounts] = useState<DashboardCounts>({
    active: 0,
    published: 0,
    draft: 0,
    bank: 0,
  });
  const [state, setState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // นับที่ backend (meta.total) — ไม่โหลดแบบทดสอบทุกชุดมานับเอง
    Promise.all([
      countQuizzes("ACTIVE"),
      countQuizzes("PUBLISHED"),
      countQuizzes("DRAFT"),
      countBankItems(),
      listQuizPage({ page: 1, limit: 3, status: "ACTIVE", sort: "updatedAt" }),
    ])
      .then(([active, published, draft, bank, recent]) => {
        if (cancelled) return;
        setCounts({ active, published, draft, bank });
        setRecentQuizzes(recent.data);
        setState("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err);
        setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="ภาพรวมระบบผู้สอน"
        description="ห้องที่เปิดอยู่ ผลเกมล่าสุด และแบบทดสอบของคุณในหน้าเดียว"
        action={
          <Can permission={Permission.GAME_HOST}>
            <Link href="/game/create" className={primaryButtonClass}>
              <SportsEsportsIcon className="h-4 w-4" />
              เปิดห้องเล่นเกม
            </Link>
          </Can>
        }
      />

      {state === "error" ? (
        <LoadErrorState
          error={loadError}
          onRetry={() => {
            setState("loading");
            setAttempt((n) => n + 1);
          }}
        />
      ) : (
        <>
          <section aria-label="สถิติ" className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {state === "loading" ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40" />)
            ) : (
              <>
                <StatCard
                  icon={MenuBookIcon}
                  label="แบบทดสอบทั้งหมด"
                  value={formatNumber(counts.active)}
                  tone="info"
                />
                <StatCard
                  icon={CheckIcon}
                  label="เผยแพร่แล้ว"
                  value={formatNumber(counts.published)}
                  tone="success"
                />
                <StatCard
                  icon={ScheduleIcon}
                  label="แบบร่าง"
                  value={formatNumber(counts.draft)}
                  tone="warning"
                />
                <StatCard
                  icon={HubIcon}
                  label="คำถามในคลัง"
                  value={formatNumber(counts.bank)}
                  tone="neutral"
                />
              </>
            )}
          </section>

          <OpenRooms />

          <RecentGames />

          <section aria-labelledby="recent-quizzes" className={cardClass}>
            <div className="flex items-center justify-between border-b border-outline-variant/40 px-6 py-5">
              <div>
                <h2 id="recent-quizzes" className="font-display text-headline-md text-on-surface">
                  แบบทดสอบล่าสุด
                </h2>
                <p className="text-body-md text-on-surface-variant">
                  แบบทดสอบที่คุณสร้างหรือแก้ไขล่าสุด
                </p>
              </div>
              <Link href="/quiz" className={linkClass}>
                ดูทั้งหมด
              </Link>
            </div>

            {state === "loading" ? (
              <div className="space-y-3 p-6">
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            ) : recentQuizzes.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="ยังไม่มีแบบทดสอบ"
                  description="เริ่มต้นด้วยการสร้างแบบทดสอบชุดแรกของคุณ"
                  action={
                    <Link href="/quiz/create" className={tonalButtonClass}>
                      <AddIcon className="h-4 w-4" />
                      สร้างแบบทดสอบ
                    </Link>
                  }
                />
              </div>
            ) : (
              <ul className="divide-y divide-outline-variant/40">
                {recentQuizzes.map((q) => {
                  const status = quizStatus(q);
                  return (
                    <li
                      key={q.id}
                      className="flex flex-col gap-3 px-6 py-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/quiz/${q.id}`}
                          className="block truncate rounded-sm text-body-md font-medium text-on-surface hover:text-primary-container hover:underline"
                        >
                          {q.title || "ไม่มีชื่อแบบทดสอบ"}
                        </Link>
                        <div className="mt-1 flex items-center gap-3">
                          <span className="text-label-sm text-secondary tabular-nums">
                            {formatNumber(q.questionCount)} คำถาม
                          </span>
                          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        {q.status === "PUBLISHED" && (
                          <Link href={`/game/create?quiz=${q.id}`} className={tonalButtonClass}>
                            <SportsEsportsIcon className="h-4 w-4" />
                            เปิดห้อง
                          </Link>
                        )}
                        <Link href={`/quiz/${q.id}/edit`} className={secondaryButtonClass}>
                          แก้ไข
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-label="ทางลัด" className="grid gap-6 md:grid-cols-2">
            <div className={`${cardClass} p-6`}>
              <h2 className="font-display text-headline-md text-on-surface">สร้างแบบทดสอบใหม่</h2>
              <p className="mt-1 text-body-md text-on-surface-variant">
                ออกแบบคำถามหลากหลายรูปแบบ เพื่อใช้จัดกิจกรรมการเรียนการสอนในชั้นเรียน
              </p>
              <Link href="/quiz/create" className={`${tonalButtonClass} mt-6`}>
                <AddIcon className="h-4 w-4" />
                สร้างแบบทดสอบ
              </Link>
            </div>

            <div className={`${cardClass} p-6`}>
              <h2 className="font-display text-headline-md text-on-surface">จัดการคลังคำถามกลาง</h2>
              <p className="mt-1 text-body-md text-on-surface-variant">
                นำเข้าจากไฟล์ CSV หรือดึงคำถามเดิมมาจัดหมวดหมู่ เพื่อนำไปใช้ซ้ำข้ามชุดได้
              </p>
              <Link href="/question-bank" className={`${secondaryButtonClass} mt-6`}>
                เปิดคลังคำถาม
                <ArrowForwardIcon className="h-4 w-4" />
              </Link>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
