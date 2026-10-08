// src/app/reports/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChartIcon, SearchIcon, SportsEsportsIcon } from "@/components/icons";
import { PAGE_SIZE, Pagination } from "@/components/shared/pagination";
import { EmptyState, LoadErrorState, PageHeader, Skeleton } from "@/components/shared/states";
import {
  cardClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  tdClass,
  thClass,
  tonalButtonClass,
} from "@/components/shared/ui";
import { formatDateTime, formatNumber } from "@/lib/format";
import { Can } from "@/hooks/use-current-user";
import type { PageMeta } from "@/lib/api";
import { Permission } from "@/lib/permissions";
import { listReportPage, type GameReportSummary } from "@/lib/report-store";

const SEARCH_DELAY_MS = 300;

export default function ReportsPage() {
  const [reports, setReports] = useState<GameReportSummary[] | null>(null);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [search, setSearch] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchQuery.trim());
      setPage(1);
    }, SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    let cancelled = false;
    listReportPage({ page, limit: PAGE_SIZE, search })
      .then(({ data, meta: next }) => {
        if (cancelled) return;
        setReports(data);
        setMeta(next);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [page, search, attempt]);

  return (
    <div className="space-y-8">
      <PageHeader title="รายงาน" description="ผลการเล่นของแต่ละห้องเกมที่จบแล้ว" />

      <section aria-label="รายการรายงาน" className={cardClass}>
        <div className="border-b border-outline-variant/40 px-6 py-5">
          <div className="max-w-md space-y-2">
            <label htmlFor="report-search" className={labelClass}>
              ค้นหา
            </label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-outline" />
              <input
                id="report-search"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="ชื่อแบบทดสอบ"
                className={`${inputClass} pl-10`}
              />
            </div>
          </div>
        </div>
        {error ? (
          <div className="p-6">
            <LoadErrorState
              error={error}
              onRetry={() => {
                setError(null);
                setAttempt((n) => n + 1);
              }}
            />
          </div>
        ) : reports === null ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : reports.length === 0 && search ? (
          <div className="p-6">
            <EmptyState
              icon={SearchIcon}
              title="ค้นหาแล้วไม่พบรายงาน"
              description="ลองเปลี่ยนคำค้นหา"
              action={
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className={secondaryButtonClass}
                >
                  ล้างคำค้นหา
                </button>
              }
            />
          </div>
        ) : reports.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={BarChartIcon}
              title="ยังไม่มีรายงาน"
              description="รายงานจะแสดงที่นี่หลังจากเกมจบ เริ่มด้วยการเปิดห้องเล่นเกมจากแบบทดสอบของคุณ"
              action={
                <Can permission={Permission.GAME_HOST}>
                  <Link href="/game/create" className={primaryButtonClass}>
                    <SportsEsportsIcon className="h-4 w-4" />
                    เปิดห้องเล่นเกม
                  </Link>
                </Can>
              }
            />
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-outline-variant/40 bg-surface text-label-md text-on-surface-variant">
                  <th scope="col" className={thClass}>
                    แบบทดสอบ
                  </th>
                  <th scope="col" className={thClass}>
                    จบเกมเมื่อ
                  </th>
                  <th scope="col" className={`${thClass} text-right`}>
                    ผู้เล่น
                  </th>
                  <th scope="col" className={`${thClass} text-right`}>
                    คำถาม
                  </th>
                  <th scope="col" className={`${thClass} text-right`}>
                    จัดการ
                  </th>
                </tr>
              </thead>
              <tbody className="text-body-md">
                {reports.map((report) => (
                  <tr
                    key={report.id}
                    className="border-b border-outline-variant/40 last:border-0 hover:bg-surface/50"
                  >
                    <td className={`${tdClass} font-medium text-on-surface`}>{report.quizTitle}</td>
                    <td className={`${tdClass} whitespace-nowrap text-on-surface-variant`}>
                      {formatDateTime(report.finishedAt)}
                    </td>
                    <td className={`${tdClass} text-right tabular-nums text-on-surface-variant`}>
                      {formatNumber(report.totalPlayers)}
                    </td>
                    <td className={`${tdClass} text-right tabular-nums text-on-surface-variant`}>
                      {formatNumber(report.totalQuestions)}
                    </td>
                    <td className={`${tdClass} text-right`}>
                      <Link href={`/reports/${report.sessionId}`} className={tonalButtonClass}>
                        ดูรายละเอียด
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {meta && (
              <div className="border-t border-outline-variant/40 px-6 py-4">
                <Pagination meta={meta} onPage={setPage} label="รายงาน" />
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
