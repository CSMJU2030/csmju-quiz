// src/app/game/[sessionId]/leaderboard/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  BoltIcon,
  CheckIcon,
  EmojiEventsIcon,
  ErrorIcon,
  GroupIcon,
  LayersIcon,
  LeaderboardIcon,
  SignalCellularAltIcon,
} from "@/components/icons";
import { isFatalLoadError, ms, useGameState, useServerClock } from "@/lib/game-api";
import { PodiumBlock } from "@/components/game/podium-block";
import {
  ConnectionBanner,
  PageLoader,
  RankDelta,
  RankIcon,
  StatCard,
  StatusBadge,
  rankStyle,
} from "@/components/game/ui";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { cardClass, primaryButtonClass, secondaryButtonClass } from "@/components/shared/ui";
import { formatNumber } from "@/lib/format";
import { PlayerIdentity } from "@/components/game/player-avatar";

type Row = {
  id: string;
  nickname: string;
  avatarIndex: number | null;
  score: number;
  streak: number;
};

export default function LeaderboardPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = typeof params.sessionId === "string" ? params.sessionId : "";

  // จอแสดงอันดับ (เช่น จอโปรเจกเตอร์) — ใช้ได้ทั้ง host และผู้เล่นที่อยู่ในห้อง
  const { state: game, error: loadError, loading, serverNow } = useGameState(sessionId);
  const ready = !loading;

  const phase = game?.phase ?? "";
  const now = useServerClock(serverNow, 250, phase !== "PODIUM");
  const questionIndex = game?.currentQuestionIndex ?? 0;
  const totalQuestions = game?.totalQuestions ?? 0;
  const quizTitle = game?.quizTitle || "CSMJU Quiz";

  const players: Row[] = useMemo(
    () =>
      (game?.players ?? []).map((p) => ({
        id: p.id,
        nickname: p.nickname || "ผู้เล่น",
        avatarIndex: p.avatarIndex,
        score: p.score,
        streak: p.streak,
      })),
    [game],
  );

  /* ─────── เก็บอันดับเดิมไว้เทียบ (ปรับ state ระหว่าง render ตามแนวทาง React) ─────── */
  const [snapshot, setSnapshot] = useState<{ index: number; prev: Record<string, number> }>({
    index: -1,
    prev: {},
  });
  if (players.length > 0 && snapshot.index !== questionIndex) {
    setSnapshot({
      index: questionIndex,
      prev: snapshot.index === -1 ? {} : Object.fromEntries(players.map((p, i) => [p.id, i + 1])),
    });
  }

  /* ─────── countdown จาก host ─────── */
  const endsAt = ms(game?.countdownEndsAt) ?? ms(game?.phaseEndsAt) ?? 0;
  const countdown = endsAt && endsAt > now ? Math.ceil((endsAt - now) / 1000) : 0;

  /* ─────── redirect ─────── */
  useEffect(() => {
    if (phase !== "PODIUM") return;
    const t = window.setTimeout(() => router.replace(`/game/${sessionId}/podium`), 1200);
    return () => window.clearTimeout(t);
  }, [phase, router, sessionId]);

  if (!ready) return <PageLoader />;

  // แยกตามชนิดข้อผิดพลาดเหมือนหน้าเล่น/ควบคุมเกม — "ไม่พบเกม" เฉพาะ 404 จริง
  const fatalError = loadError && (!game || isFatalLoadError(loadError)) ? loadError : null;
  if (fatalError && fatalError.kind !== "not-found") {
    const title =
      fatalError.kind === "forbidden"
        ? "ไม่มีสิทธิ์ดูอันดับของห้องนี้"
        : fatalError.kind === "closed"
          ? "ห้องนี้ใช้ต่อไม่ได้แล้ว"
          : "โหลดอันดับไม่สำเร็จ";
    return (
      <div role="alert">
        <EmptyState
          icon={ErrorIcon}
          title={title}
          description={fatalError.message}
          action={
            <>
              {fatalError.kind === "other" && (
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className={primaryButtonClass}
                >
                  ลองอีกครั้ง
                </button>
              )}
              <Link href="/" className={secondaryButtonClass}>
                กลับหน้าหลัก
              </Link>
            </>
          }
        />
      </div>
    );
  }

  if (!game || fatalError) {
    return (
      <EmptyState
        icon={LeaderboardIcon}
        title="ไม่พบเกม"
        description="ไม่พบข้อมูลที่คุณกำลังค้นหา อาจถูกลบไปแล้วหรือลิงก์ไม่ถูกต้อง"
        action={
          <Link href="/" className={secondaryButtonClass}>
            กลับหน้าหลัก
          </Link>
        }
      />
    );
  }

  const [first, second, third] = players;
  const isFinal = phase === "PODIUM";
  const topScore = first?.score ?? 0;
  const visible = isFinal ? players : players.slice(0, 10);

  return (
    <div className="space-y-8">
      <div>
        <PageHeader title={isFinal ? "จบเกมแล้ว" : "อันดับคะแนน"} description={quizTitle} />
        <ConnectionBanner show={!!loadError} className="mt-4" />
      </div>

      <section aria-label="สรุป" className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={GroupIcon} label="ผู้เล่น" value={`${players.length} คน`} />
        <StatCard
          icon={LayersIcon}
          label="ความคืบหน้า"
          value={`${Math.min(questionIndex + 1, totalQuestions || 1)}/${totalQuestions || "-"}`}
          tone="neutral"
        />
        <StatCard icon={BoltIcon} label="คะแนนนำ" value={formatNumber(topScore)} tone="warning" />
        <StatCard
          icon={SignalCellularAltIcon}
          label="สถานะ"
          value={isFinal ? "จบเกม" : "กำลังเล่น"}
          tone={isFinal ? "neutral" : "success"}
        />
      </section>

      {players.length > 0 && (
        <section aria-label="สามอันดับแรก" className="grid grid-cols-3 items-end gap-4 md:gap-6">
          <PodiumBlock player={second} place={2} height="h-32 md:h-36" />
          <PodiumBlock player={first} place={1} height="h-40 md:h-44" />
          <PodiumBlock player={third} place={3} height="h-28 md:h-32" />
        </section>
      )}

      <section aria-labelledby="ranking" className={cardClass}>
        <div className="flex items-center justify-between border-b border-outline-variant/40 px-6 py-5">
          <div>
            <h2 id="ranking" className="font-display text-headline-md text-on-surface">
              {isFinal ? "อันดับทั้งหมด" : "10 อันดับแรก"}
            </h2>
            <p className="text-body-md text-on-surface-variant">อัปเดตอัตโนมัติระหว่างเกม</p>
          </div>
          {!isFinal && <StatusBadge tone="success">กำลังเล่น</StatusBadge>}
        </div>

        {players.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={GroupIcon}
              title="ยังไม่มีผู้เล่น"
              description="รอผู้เล่นเข้าร่วมเกมด้วยรหัสเกม"
            />
          </div>
        ) : (
          <ol aria-live="polite" className="divide-y divide-outline-variant/40">
            {visible.map((p, index) => {
              const place = index + 1;
              const prev = snapshot.prev[p.id] ?? place;
              return (
                <li key={p.id} className="flex items-center gap-4 px-6 py-4">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${rankStyle(place)}`}
                  >
                    <RankIcon place={place} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <PlayerIdentity
                        avatarIndex={p.avatarIndex}
                        nickname={p.nickname}
                        size="sm"
                        nameClassName="text-body-md font-medium text-on-surface"
                      />
                      <RankDelta delta={prev - place} />
                    </div>
                    {p.streak > 1 && (
                      <p className="mt-1 text-label-sm text-on-surface-variant tabular-nums">
                        ตอบถูกติดกัน {p.streak} ข้อ
                      </p>
                    )}
                  </div>
                  <p className="text-right">
                    <span className="block font-display text-headline-md text-on-surface tabular-nums">
                      {formatNumber(p.score)}
                    </span>
                    <span className="block text-label-sm text-on-surface-variant">คะแนน</span>
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {isFinal ? (
        <div className="flex justify-end">
          <Link href={`/game/${sessionId}/podium`} className={primaryButtonClass}>
            <EmojiEventsIcon className="h-4 w-4" />
            ดูผลการแข่งขัน
          </Link>
        </div>
      ) : (
        <div
          role="status"
          className="flex items-center gap-4 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-sm"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-container font-display text-headline-md text-on-primary tabular-nums">
            {countdown > 0 ? countdown : <CheckIcon className="h-5 w-5" />}
          </span>
          <div>
            <p className="text-label-md text-on-surface">
              {countdown > 0
                ? `เตรียมเข้าสู่ข้อถัดไปใน ${countdown} วินาที`
                : "รอผู้ดำเนินเกมไปยังข้อถัดไป"}
            </p>
            <p className="mt-1 text-body-md text-on-surface-variant">
              คะแนนและอันดับจะอัปเดตอัตโนมัติ
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
