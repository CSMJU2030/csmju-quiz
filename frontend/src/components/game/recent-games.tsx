// src/components/game/recent-games.tsx
// หน้าภาพรวมผู้สอน: เกมที่จบล่าสุด 3 เกม — กดเพื่อดูรายงานของเกมนั้น
// ข้อมูลจากรายงานของ backend เท่านั้น · ยังไม่เคยจบเกม = แสดงคำแนะนำให้เปิดห้อง
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRightIcon } from "@/components/icons";
import { Skeleton } from "@/components/shared/states";
import { cardClass, cardHeaderClass, linkClass } from "@/components/shared/ui";
import { formatNumber, formatPercent, formatRelative } from "@/lib/format";
import { listRecentReports, type GameReportSummary } from "@/lib/report-store";

export function RecentGames() {
  const [games, setGames] = useState<GameReportSummary[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listRecentReports(3)
      .then((list) => {
        if (!cancelled) setGames(list);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ส่วนเสริม — โหลดไม่ได้ก็ไม่ขวางหน้าภาพรวม
  if (failed) return null;

  return (
    <section aria-labelledby="recent-games" className={cardClass}>
      <div className={`${cardHeaderClass} flex items-center justify-between gap-3`}>
        <div>
          <h2 id="recent-games" className="font-display text-headline-md text-on-surface">
            เกมล่าสุด
          </h2>
          <p className="text-body-md text-on-surface-variant">เกมที่จบแล้ว 3 เกมล่าสุด</p>
        </div>
        <Link href="/reports" className={linkClass}>
          ดูรายงานทั้งหมด
        </Link>
      </div>
      {games === null ? (
        <div className="space-y-3 p-6">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : games.length === 0 ? (
        <p className="px-6 py-10 text-center text-body-md text-on-surface-variant">
          ยังไม่มีเกมที่จบ เปิดห้องเล่นเกมเพื่อดูผลที่นี่
        </p>
      ) : (
        <ul className="divide-y divide-outline-variant/40">
          {games.map((g) => (
            <li key={g.id}>
              <Link
                href={`/reports/${g.id}`}
                className="flex items-center gap-3 px-6 py-4 transition-colors hover:bg-surface/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-container"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-md font-medium text-on-surface">
                    {g.quizTitle}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-x-3 text-label-sm text-on-surface-variant tabular-nums">
                    <span>{formatRelative(g.finishedAt)}</span>
                    <span>ผู้เล่น {formatNumber(g.totalPlayers)} คน</span>
                    <span>แม่นยำเฉลี่ย {formatPercent(g.averageAccuracy)}</span>
                  </span>
                </span>
                <ChevronRightIcon className="h-5 w-5 shrink-0 text-outline" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
