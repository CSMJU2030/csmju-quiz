// src/app/reports/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
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
import { errorMessage, type PageMeta } from "@/lib/api";
import { Permission } from "@/lib/permissions";
import { deleteReport, listReportPage, type GameReportSummary } from "@/lib/report-store";
import { ConfirmDeleteModal } from "@/components/shared/modal";
import { ErrorAlert, SuccessToast } from "@/components/shared/notice";
import { SelectionBar } from "@/components/shared/selection-bar";

const SEARCH_DELAY_MS = 300;

export default function ReportsPage() {
  const [reports, setReports] = useState<GameReportSummary[] | null>(null);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [search, setSearch] = useState("");
  const [attempt, setAttempt] = useState(0);
  /** ติ๊กเลือกเพื่อลบหลายรายงาน (เฉพาะหน้าที่เห็นอยู่) */
  const [picked, setPicked] = useState<string[]>([]);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const clearNotice = useCallback(() => setNotice(""), []);

  // เปลี่ยนหน้า/คำค้น → ล้างที่เลือก
  const [pickScope, setPickScope] = useState("");
  const scope = `${page}|${search}`;
  if (scope !== pickScope) {
    setPickScope(scope);
    if (picked.length) setPicked([]);
  }

  const handleBulkDelete = async () => {
    if (bulkBusy) return;
    setBulkBusy(true);
    setActionError("");
    let done = 0;
    try {
      for (const id of picked) {
        await deleteReport(id);
        done++;
      }
      setNotice(`ลบรายงาน ${done} รายการแล้ว`);
    } catch (err) {
      setActionError(
        `ลบได้ ${done} จาก ${picked.length} รายการ ที่เหลือลบไม่สำเร็จ: ${errorMessage(err)}`,
      );
    } finally {
      setPicked([]);
      setConfirmBulk(false);
      setBulkBusy(false);
      setAttempt((n) => n + 1);
    }
  };

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
      <SuccessToast message={notice} onDone={clearNotice} />
      <ErrorAlert message={actionError} onClose={() => setActionError("")} />

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
                  <th scope="col" className="w-14 py-2 pl-4">
                    <label className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg has-focus-visible:outline-2 has-focus-visible:outline-accent">
                      <input
                        type="checkbox"
                        checked={reports.length > 0 && picked.length === reports.length}
                        ref={(el) => {
                          if (el)
                            el.indeterminate = picked.length > 0 && picked.length < reports.length;
                        }}
                        onChange={(e) =>
                          setPicked(e.target.checked ? reports.map((r) => r.sessionId) : [])
                        }
                        aria-label="เลือกรายงานทั้งหมดในหน้านี้"
                        className="h-5 w-5 accent-primary"
                      />
                    </label>
                  </th>
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
                    className={`border-b border-outline-variant/40 last:border-0 hover:bg-surface/50 ${
                      picked.includes(report.sessionId) ? "bg-primary-container/5" : ""
                    }`}
                  >
                    <td className="py-2 pl-4">
                      <label className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg has-focus-visible:outline-2 has-focus-visible:outline-accent">
                        <input
                          type="checkbox"
                          checked={picked.includes(report.sessionId)}
                          onChange={(e) =>
                            setPicked((cur) =>
                              e.target.checked
                                ? [...cur, report.sessionId]
                                : cur.filter((id) => id !== report.sessionId),
                            )
                          }
                          aria-label={`เลือกรายงาน ${report.quizTitle} (${formatDateTime(report.finishedAt)})`}
                          className="h-5 w-5 accent-primary"
                        />
                      </label>
                    </td>
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

      <SelectionBar
        label="การกระทำกับรายงานที่เลือก"
        count={picked.length}
        unit="รายการ"
        total={reports?.length ?? 0}
        busy={bulkBusy}
        onDelete={() => setConfirmBulk(true)}
        onSelectAll={() => setPicked((reports ?? []).map((r) => r.sessionId))}
        onClear={() => setPicked([])}
      />

      <ConfirmDeleteModal
        open={confirmBulk}
        title="ลบรายงานที่เลือก"
        itemName={`${picked.length} รายการ`}
        consequence="จะถูกลบถาวรพร้อมชื่อเล่น คะแนน และคำตอบของผู้เล่นทุกคนในเกมเหล่านี้ และกู้คืนไม่ได้"
        confirmLabel={`ลบ ${picked.length} รายการ`}
        busy={bulkBusy}
        onCancel={() => setConfirmBulk(false)}
        onConfirm={() => void handleBulkDelete()}
      />
    </div>
  );
}
