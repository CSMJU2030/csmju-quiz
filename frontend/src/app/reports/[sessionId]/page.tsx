// src/app/reports/[sessionId]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ConfirmDeleteModal } from "@/components/shared/modal";
import { ErrorAlert } from "@/components/shared/notice";
import {
  ArrowBackIcon,
  BoltIcon,
  DeleteIcon,
  DownloadIcon,
  GroupIcon,
  LayersIcon,
  SearchIcon,
  TrackChangesIcon,
} from "@/components/icons";
import { PAGE_SIZE, Pagination } from "@/components/shared/pagination";
import { StatCard } from "@/components/game/ui";
import { EmptyState, LoadErrorState, PageHeader, PageSkeleton } from "@/components/shared/states";
import {
  cardClass,
  cardHeaderClass,
  inputClass,
  labelClass,
  linkClass,
  secondaryButtonClass,
  tdClass,
  thClass,
} from "@/components/shared/ui";
import { downloadCsv } from "@/lib/csv";
import { formatDateTime, formatFileStamp, formatNumber, formatPercent } from "@/lib/format";
import { deleteReport, getReportById, type GameReport } from "@/lib/report-store";
import { errorMessage, type PageMeta } from "@/lib/api";
import { Can } from "@/hooks/use-current-user";
import { Permission } from "@/lib/permissions";
import { PlayerIdentity } from "@/components/game/player-avatar";

export default function ReportDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [report, setReport] = useState<GameReport | null | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const router = useRouter();
  const [playerQuery, setPlayerQuery] = useState("");
  const [playerPage, setPlayerPage] = useState(1);

  // ค้นหาและแบ่งหน้าตารางผู้เล่นฝั่งหน้าเว็บ — endpoint รายงานส่งผู้เล่นทั้งหมดของเกมมาในครั้งเดียว
  // (ห้องหนึ่งมีผู้เล่นไม่เกิน 100 คน) จึงไม่ต้องยิงคำขอเพิ่ม (ui-design-system.md ข้อ 8.2)
  const filteredPlayers = useMemo(() => {
    const q = playerQuery.trim().toLowerCase();
    const players = report?.players ?? [];
    return q ? players.filter((p) => p.nickname.toLowerCase().includes(q)) : players;
  }, [report, playerQuery]);
  const playerMeta: PageMeta = {
    total: filteredPlayers.length,
    page: playerPage,
    limit: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(filteredPlayers.length / PAGE_SIZE)),
  };
  const shownPlayers = filteredPlayers.slice((playerPage - 1) * PAGE_SIZE, playerPage * PAGE_SIZE);

  const handleDelete = async () => {
    // กันกด Enter/คลิกซ้ำระหว่างลบ
    if (busy) return;
    setBusy(true);
    setDeleteError("");
    try {
      await deleteReport(sessionId);
      router.replace("/reports");
    } catch (err) {
      setDeleteError(`ลบรายงานไม่สำเร็จ: ${errorMessage(err)}`);
      setBusy(false);
      setDeleting(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    getReportById(sessionId)
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, attempt]);

  const backToReports = (
    <Link href="/reports" className={secondaryButtonClass}>
      <ArrowBackIcon className="h-4 w-4" />
      กลับไปหน้ารายงาน
    </Link>
  );

  if (error) {
    return (
      <LoadErrorState
        error={error}
        notFoundTitle="ไม่พบรายงาน"
        action={backToReports}
        onRetry={() => {
          setError(null);
          setAttempt((n) => n + 1);
        }}
      />
    );
  }

  if (report === undefined) return <PageSkeleton />;

  if (report === null) {
    return (
      <EmptyState
        title="ไม่พบรายงาน"
        description="ไม่พบข้อมูลที่คุณกำลังค้นหา อาจถูกลบไปแล้วหรือลิงก์ไม่ถูกต้อง"
        action={
          <Link href="/reports" className={secondaryButtonClass}>
            <ArrowBackIcon className="h-4 w-4" />
            กลับไปหน้ารายงาน
          </Link>
        }
      />
    );
  }

  // ใช้ค่าสรุปจาก backend ชุดเดียวกับหน้ารายการรายงานและหน้าภาพรวม เพื่อให้ตัวเลขตรงกันทุกหน้า
  const topScore = report.topScore;
  const accuracy = report.averageAccuracy;

  return (
    <div className="space-y-8">
      <PageHeader
        title={report.quizTitle}
        description={`จบเกมเมื่อ ${formatDateTime(report.finishedAt)}`}
        action={
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => exportReport(report)}
              className={secondaryButtonClass}
            >
              <DownloadIcon className="h-4 w-4" />
              ดาวน์โหลด CSV
            </button>
            <Can permission={Permission.REPORT_READ_OWN}>
              <button
                type="button"
                onClick={() => setDeleting(true)}
                disabled={busy}
                className={secondaryButtonClass}
              >
                <DeleteIcon className="h-4 w-4" />
                ลบรายงาน
              </button>
            </Can>
          </div>
        }
      />
      <ErrorAlert message={deleteError} onClose={() => setDeleteError("")} />
      <ConfirmDeleteModal
        open={deleting}
        title="ลบรายงาน"
        itemName={`“${report.quizTitle}” (จบเกมเมื่อ ${formatDateTime(report.finishedAt)})`}
        consequence="จะถูกลบถาวรพร้อมชื่อเล่น คะแนน และคำตอบของผู้เล่นทุกคนในเกมนี้ และกู้คืนไม่ได้"
        confirmLabel="ลบรายงาน"
        busy={busy}
        onCancel={() => setDeleting(false)}
        onConfirm={() => void handleDelete()}
      />

      <section aria-label="สรุปผล" className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={GroupIcon} label="ผู้เล่น" value={formatNumber(report.totalPlayers)} />
        <StatCard
          icon={LayersIcon}
          label="คำถาม"
          value={formatNumber(report.totalQuestions)}
          tone="neutral"
        />
        <StatCard
          icon={TrackChangesIcon}
          label="ความแม่นยำเฉลี่ย"
          value={formatPercent(accuracy)}
          tone="success"
        />
        <StatCard
          icon={BoltIcon}
          label="คะแนนสูงสุด"
          value={formatNumber(topScore)}
          tone="warning"
        />
      </section>

      <section aria-labelledby="player-results" className={cardClass}>
        <div
          className={`${cardHeaderClass} flex flex-col gap-4 md:flex-row md:items-end md:justify-between`}
        >
          <h2 id="player-results" className="font-display text-headline-md text-on-surface">
            ผลของผู้เล่น
          </h2>
          {report.players.length > 0 && (
            <div className="space-y-2 md:w-72">
              <label htmlFor="report-player-search" className={labelClass}>
                ค้นหาผู้เล่น
              </label>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-on-surface-variant" />
                <input
                  id="report-player-search"
                  type="search"
                  value={playerQuery}
                  onChange={(e) => {
                    setPlayerQuery(e.target.value);
                    setPlayerPage(1);
                  }}
                  placeholder="ชื่อเล่น"
                  className={`${inputClass} pl-10`}
                />
              </div>
            </div>
          )}
        </div>
        {report.players.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={GroupIcon}
              title="ไม่มีผู้เล่นในเกมนี้"
              description="เกมนี้จบโดยไม่มีผู้เล่นเข้าร่วม"
            />
          </div>
        ) : filteredPlayers.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={SearchIcon}
              title="ไม่พบผู้เล่นที่ค้นหา"
              description="ลองใช้ชื่อเล่นอื่น หรือล้างคำค้นหาเพื่อดูผู้เล่นทั้งหมด"
              action={
                <button
                  type="button"
                  onClick={() => {
                    setPlayerQuery("");
                    setPlayerPage(1);
                  }}
                  className={secondaryButtonClass}
                >
                  ล้างคำค้นหา
                </button>
              }
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-outline-variant/40 bg-surface text-label-md text-on-surface-variant">
                    <th scope="col" className={thClass}>
                      อันดับ
                    </th>
                    <th scope="col" className={thClass}>
                      ผู้เล่น
                    </th>
                    <th scope="col" className={`${thClass} text-right`}>
                      คะแนน
                    </th>
                    <th scope="col" className={`${thClass} text-right`}>
                      ตอบถูก
                    </th>
                    <th scope="col" className={`${thClass} text-right`}>
                      ความแม่นยำ
                    </th>
                    <th scope="col" className={`${thClass} text-right`}>
                      <span className="sr-only">คำตอบรายข้อ</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="text-body-md">
                  {shownPlayers.map((player) => (
                    <tr
                      key={player.playerId}
                      className="border-b border-outline-variant/40 last:border-0 hover:bg-surface/50"
                    >
                      <td className={`${tdClass} tabular-nums text-on-surface`}>{player.rank}</td>
                      <td className={tdClass}>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <PlayerIdentity
                            avatarIndex={player.avatarIndex}
                            nickname={player.nickname}
                            size="xs"
                            nameClassName="font-medium text-on-surface"
                            className="max-w-56"
                          />
                          <span className="text-label-sm text-on-surface-variant">
                            {joinedWith(player)}
                          </span>
                        </div>
                      </td>
                      <td className={`${tdClass} text-right tabular-nums text-primary-container`}>
                        {formatNumber(player.score)}
                      </td>
                      <td className={`${tdClass} text-right tabular-nums text-on-surface-variant`}>
                        {formatNumber(player.correct)} / {formatNumber(player.totalAnswered)}
                      </td>
                      <td className={`${tdClass} text-right tabular-nums text-on-surface-variant`}>
                        {formatPercent(player.accuracy)}
                      </td>
                      <td className={`${tdClass} text-right`}>
                        <Link
                          href={`/reports/${report.sessionId}/players/${player.playerId}`}
                          className={`${linkClass} -my-2 whitespace-nowrap`}
                          aria-label={`ดูคำตอบรายข้อของ ${player.nickname}`}
                        >
                          ดูคำตอบ
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-outline-variant/40 px-6 py-4">
              <Pagination meta={playerMeta} onPage={setPlayerPage} label="คน" />
            </div>
          </>
        )}
      </section>

      <section aria-labelledby="question-results" className={cardClass}>
        <div className={cardHeaderClass}>
          <h2 id="question-results" className="font-display text-headline-md text-on-surface">
            ผลรายข้อ
          </h2>
        </div>
        <ol className="divide-y divide-outline-variant/40">
          {report.questions.map((q) => {
            const rate = q.totalAnswers > 0 ? (q.correctAnswers / q.totalAnswers) * 100 : 0;
            return (
              <li key={q.questionId} className="px-6 py-4">
                <p className="text-body-md text-on-surface">
                  <span className="text-label-md text-on-surface-variant tabular-nums">
                    ข้อ {q.questionNumber} ·{" "}
                  </span>
                  {q.prompt}
                </p>
                <div className="mt-2 flex flex-wrap gap-4 text-label-sm text-on-surface-variant tabular-nums">
                  <span>ตอบถูก {formatNumber(q.correctAnswers)}</span>
                  <span>ตอบผิด {formatNumber(q.incorrectAnswers)}</span>
                  <span>หมดเวลา {formatNumber(q.timeoutAnswers)}</span>
                  <span>อัตราตอบถูก {formatPercent(rate)}</span>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

/** ผู้เล่นเข้าห้องทางไหน */
function joinedWith(player: { withAccount: boolean }) {
  return player.withAccount ? "บัญชี MJU" : "ไม่ล็อกอิน";
}

function exportReport(report: GameReport) {
  const rows = [
    ["แบบทดสอบ", report.quizTitle],
    ["จบเกมเมื่อ", formatDateTime(report.finishedAt)],
    [],
    ["อันดับ", "ผู้เล่น", "เข้าร่วมด้วย", "คะแนน", "ตอบถูก", "ตอบผิด", "หมดเวลา", "ความแม่นยำ (%)"],
    ...report.players.map((p) => [
      p.rank,
      p.nickname,
      joinedWith(p),
      p.score,
      p.correct,
      p.incorrect,
      p.timeout,
      p.accuracy,
    ]),
    [],
    ["ข้อที่", "โจทย์", "ตอบทั้งหมด", "ตอบถูก", "ตอบผิด", "หมดเวลา"],
    ...report.questions.map((q) => [
      q.questionNumber,
      q.prompt,
      q.totalAnswers,
      q.correctAnswers,
      q.incorrectAnswers,
      q.timeoutAnswers,
    ]),
  ];
  // ชื่อไฟล์เป็นอักษรอังกฤษ เพราะบางเบราว์เซอร์ตัดชื่อภาษาไทยทิ้ง (ชื่อแบบทดสอบอยู่ในไฟล์แล้ว)
  // เวลาในชื่อไฟล์เป็นเวลาไทยเสมอ ไม่ขึ้นกับ timezone ของเครื่องผู้ใช้
  const stamp = formatFileStamp(report.finishedAt) ?? report.sessionId.slice(0, 8);
  downloadCsv(`csmju-quiz-report-${stamp}`, rows);
}
