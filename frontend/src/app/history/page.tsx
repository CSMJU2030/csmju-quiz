// src/app/history/page.tsx
// ประวัติการเล่นของฉัน — สถิติรวม + รายการเกมที่เล่นจบแล้ว (ใหม่สุดก่อน) · ข้อมูลจาก backend เท่านั้น
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronRightIcon,
  EmojiEventsIcon,
  SportsEsportsIcon,
  StarIcon,
  TrackChangesIcon,
} from "@/components/icons";
import { RankIcon, rankStyle, StatCard } from "@/components/game/ui";
import { EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/shared/states";
import {
  cardClass,
  cardHeaderClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/shared/ui";
import type { GameHistorySummaryView, PlayerStatsView } from "@/lib/api-types";
import { AWARD_INFO, isAwardKind } from "@/lib/awards";
import { formatDateTime, formatNumber, formatPercent } from "@/lib/format";
import { formatRank, getMyStats, listMyGames } from "@/lib/player-review";

type LoadState = "loading" | "ready" | "error";

export default function HistoryPage() {
  const [stats, setStats] = useState<PlayerStatsView | null>(null);
  const [games, setGames] = useState<GameHistorySummaryView[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [state, setState] = useState<LoadState>("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getMyStats(), listMyGames(1)])
      .then(([s, list]) => {
        if (cancelled) return;
        setStats(s);
        setGames(list.data);
        setPage(1);
        setTotalPages(list.meta.totalPages);
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    setMoreError(false);
    try {
      const next = await listMyGames(page + 1);
      setGames((prev) => [...prev, ...next.data.filter((g) => !prev.some((p) => p.id === g.id))]);
      setPage(page + 1);
      setTotalPages(next.meta.totalPages);
    } catch {
      setMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }, [page]);

  const joinButton = (
    <Link href="/game/join" className={primaryButtonClass}>
      <SportsEsportsIcon className="h-4 w-4" />
      เข้าร่วมเกม
    </Link>
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="ประวัติการเล่น"
        description="ผลการเล่นของคุณในทุกเกมที่เข้าด้วยบัญชี MJU และจบแล้ว กดเข้าไปเพื่อทบทวนคำตอบรายข้อ (เกมที่เล่นแบบไม่ล็อกอินจะไม่อยู่ในนี้)"
        action={joinButton}
      />

      {state === "error" ? (
        <ErrorState
          onRetry={() => {
            setState("loading");
            setAttempt((n) => n + 1);
          }}
        />
      ) : (
        <>
          <section aria-label="สถิติของฉัน" className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {state === "loading" || !stats ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40" />)
            ) : (
              <>
                <StatCard
                  icon={SportsEsportsIcon}
                  label="เกมที่เล่น"
                  value={formatNumber(stats.gamesPlayed)}
                  tone="info"
                />
                <StatCard
                  icon={EmojiEventsIcon}
                  label="ได้อันดับ 1"
                  value={`${formatNumber(stats.wins)} ครั้ง`}
                  tone="warning"
                />
                <StatCard
                  icon={TrackChangesIcon}
                  label="ความแม่นยำเฉลี่ย"
                  value={formatPercent(stats.averageAccuracy)}
                  tone="success"
                />
                <StatCard
                  icon={StarIcon}
                  label="คะแนนสูงสุด"
                  value={formatNumber(stats.bestScore)}
                  tone="neutral"
                />
              </>
            )}
          </section>

          {state === "ready" && stats && stats.gamesPlayed > 0 && (
            <p className="flex flex-wrap gap-x-6 gap-y-2 text-body-md text-on-surface-variant tabular-nums">
              <span>ติด 3 อันดับแรก {formatNumber(stats.podiumFinishes)} ครั้ง</span>
              <span>รางวัลพิเศษ {formatNumber(stats.awardsEarned)} รางวัล</span>
              <span>ตอบถูกติดกันสูงสุด {formatNumber(stats.bestStreak)} ข้อ</span>
              <span>
                ตอบถูกรวม {formatNumber(stats.totalCorrect)} / {formatNumber(stats.totalQuestions)}{" "}
                ข้อ
              </span>
            </p>
          )}

          <section aria-labelledby="my-games" className={cardClass}>
            <div className={cardHeaderClass}>
              <h2 id="my-games" className="font-display text-headline-md text-on-surface">
                เกมที่เล่นแล้ว
              </h2>
            </div>

            {state === "loading" ? (
              <div className="space-y-3 p-6">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            ) : games.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="ยังไม่มีประวัติการเล่น"
                  description="เมื่อคุณเข้าร่วมด้วยบัญชี MJU และเล่นจนจบ ผลการเล่นจะแสดงที่นี่"
                  action={joinButton}
                />
              </div>
            ) : (
              <>
                <ul className="divide-y divide-outline-variant/40">
                  {games.map((g) => (
                    <li key={g.id}>
                      <Link
                        href={`/history/${g.id}`}
                        className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-surface/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-container"
                      >
                        <span
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${rankStyle(g.rank)}`}
                        >
                          <RankIcon place={g.rank} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-body-md font-medium text-on-surface">
                            {g.quizTitle}
                          </span>
                          <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-label-sm text-on-surface-variant tabular-nums">
                            <span>{formatDateTime(g.finishedAt)}</span>
                            <span>{formatRank(g.rank, g.playerCount)}</span>
                            <span>
                              ถูก {formatNumber(g.correct)}/{formatNumber(g.questionCount)} ข้อ
                            </span>
                            {/* ข้ามรางวัลชนิดที่หน้าเว็บยังไม่รู้จัก */}
                            {g.awards.filter(isAwardKind).map((kind) => (
                              <span key={kind} className="text-on-surface">
                                {AWARD_INFO[kind].title}
                              </span>
                            ))}
                          </span>
                        </span>
                        <span className="hidden text-right sm:block">
                          <span className="block font-display text-headline-md text-primary-container tabular-nums">
                            {formatNumber(g.score)}
                          </span>
                          <span className="text-label-sm text-on-surface-variant">
                            แม่นยำ {formatPercent(g.accuracy)}
                          </span>
                        </span>
                        <ChevronRightIcon className="h-5 w-5 shrink-0 text-outline" />
                      </Link>
                    </li>
                  ))}
                </ul>
                {page < totalPages && (
                  <div className="flex flex-col items-center gap-2 border-t border-outline-variant/40 p-6">
                    {moreError && (
                      <p role="alert" className="text-label-sm text-error">
                        โหลดเพิ่มไม่สำเร็จ กรุณาลองอีกครั้ง
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={loadMore}
                      disabled={loadingMore}
                      className={secondaryButtonClass}
                    >
                      {loadingMore ? "กำลังโหลด..." : "แสดงเพิ่ม"}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
