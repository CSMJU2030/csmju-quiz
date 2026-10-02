// src/components/history/player-progress.tsx
// ส่วน "การเล่นของฉัน" บนหน้าแรก — สถิติสั้น ๆ · เกมล่าสุด 3 เกม (ทางเข้าเกมอยู่ใน "เริ่มต้นใช้งาน")
// ผู้สอนที่ยังไม่เคยเล่นจะไม่เห็นส่วนนี้
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRightIcon } from "@/components/icons";
import { RankIcon, rankStyle } from "@/components/game/ui";
import { Skeleton } from "@/components/shared/states";
import { cardClass, cardHeaderClass, linkClass } from "@/components/shared/ui";
import type { GameHistorySummaryView, PlayerStatsView } from "@/lib/api-types";
import { formatNumber, formatPercent, formatRelative } from "@/lib/format";
import { getMyStats, listMyGames } from "@/lib/player-review";

const RECENT_COUNT = 3;

export function PlayerProgress({ isPlayer }: { isPlayer: boolean }) {
  const [stats, setStats] = useState<PlayerStatsView | null>(null);
  const [recent, setRecent] = useState<GameHistorySummaryView[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    Promise.all([getMyStats(), listMyGames(1, RECENT_COUNT)])
      .then(([s, list]) => {
        if (cancelled) return;
        setStats(s);
        setRecent(list.data);
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hasGames = state === "ready" && stats !== null && stats.gamesPlayed > 0;
  // ผู้สอนที่ไม่เคยเล่น: ไม่แสดงอะไรเลย (ทางลัดเข้าร่วมเกมมีอยู่แล้วด้านล่าง)
  if (!isPlayer && !hasGames) return null;

  return (
    <section aria-labelledby="player-progress" className="space-y-4">
      <h2
        id="player-progress"
        className="border-l-4 border-primary-container pl-3 font-display text-headline-md text-on-surface"
      >
        การเล่นของฉัน
      </h2>

      <div className="space-y-6">
        <div className={cardClass}>
          <div className={`${cardHeaderClass} flex items-center justify-between`}>
            <h3 className="font-display text-headline-md text-on-surface">เกมล่าสุด</h3>
            {hasGames && (
              <Link href="/history" className={linkClass}>
                ดูประวัติทั้งหมด
              </Link>
            )}
          </div>

          {state === "loading" ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : state === "error" ? (
            <p className="px-6 py-8 text-center text-body-md text-on-surface-variant">
              โหลดประวัติการเล่นไม่สำเร็จ ลองเปิดหน้านี้ใหม่อีกครั้ง
            </p>
          ) : !hasGames || !stats ? (
            <p className="px-6 py-8 text-center text-body-md text-on-surface-variant">
              ยังไม่มีประวัติการเล่น เล่นเกมแรกให้จบเพื่อดูผลที่นี่
            </p>
          ) : (
            <>
              <dl className="grid grid-cols-3 gap-3 px-6 pt-5 md:max-w-xl">
                {(
                  [
                    ["เล่นแล้ว", `${formatNumber(stats.gamesPlayed)} เกม`],
                    ["อันดับ 1", `${formatNumber(stats.wins)} ครั้ง`],
                    ["แม่นยำเฉลี่ย", formatPercent(stats.averageAccuracy)],
                  ] as [string, string][]
                ).map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-surface-container p-3">
                    <dt className="text-label-sm text-on-surface-variant">{label}</dt>
                    <dd className="mt-1 text-label-md text-primary-container tabular-nums">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              <ul className="divide-y divide-outline-variant/40 pt-2">
                {recent.map((g) => (
                  <li key={g.id}>
                    <Link
                      href={`/history/${g.id}`}
                      className="flex items-center gap-3 px-6 py-3 transition-colors hover:bg-surface/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-container"
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${rankStyle(g.rank)}`}
                      >
                        <RankIcon place={g.rank} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body-md text-on-surface">
                          {g.quizTitle}
                        </span>
                        <span className="text-label-sm text-on-surface-variant tabular-nums">
                          {formatRelative(g.finishedAt)} · {formatNumber(g.score)} คะแนน
                        </span>
                      </span>
                      <ChevronRightIcon className="h-5 w-5 shrink-0 text-outline" />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
