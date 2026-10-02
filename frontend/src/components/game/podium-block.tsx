// src/components/game/podium-block.tsx
"use client";

import { PlayerAvatar } from "@/components/game/player-avatar";
import { RankMedal } from "@/components/game/ui";
import { formatNumber } from "@/lib/format";

export interface PodiumPlayer {
  id: string;
  nickname: string;
  score: number;
  avatarIndex?: number | null;
}

/** จังหวะเผยแท่นอันดับ: อันดับ 3 → 2 → 1 (ใช้ stagger-1/2/3 ของมาตรฐาน ข้อ 3.6) */
const REVEAL_CLASS: Record<1 | 2 | 3, string> = { 3: "stagger-1", 2: "stagger-2", 1: "stagger-3" };

/**
 * แท่นอันดับ 1–3 — entrance ใช้ fade-slide-up + animation-delay เท่านั้น (ข้อ 2.1, 3.6)
 * variant "stage" วางบนพื้น brand-gradient (ตัวอักษร on-primary) · "plain" วางบนพื้นสว่าง
 */
export function PodiumBlock({
  player,
  place,
  height,
  isMe = false,
  variant = "plain",
}: {
  player?: PodiumPlayer;
  place: 1 | 2 | 3;
  height: string;
  isMe?: boolean;
  variant?: "plain" | "stage";
}) {
  const reveal = REVEAL_CLASS[place];
  const onStage = variant === "stage";
  const winner = place === 1;

  if (!player) {
    return (
      <div className={`flex flex-col items-center justify-end fade-slide-up ${reveal}`}>
        <p
          className={`mb-2 text-label-sm ${onStage ? "text-on-primary/70" : "text-on-surface-variant"}`}
        >
          อันดับ {place}
        </p>
        <div
          className={`w-full ${height} rounded-t-xl border border-dashed ${
            onStage
              ? "border-on-primary/30 bg-on-primary/5"
              : "border-outline-variant bg-surface-container"
          }`}
        />
      </div>
    );
  }

  // หน้าแท่น: อันดับ 1 สว่างที่สุด อันดับ 2–3 ถอยลงมา
  const face = onStage
    ? winner
      ? "bg-surface-container-lowest"
      : "bg-surface-container-high"
    : winner
      ? "border border-primary-container bg-primary-container/10"
      : "border border-outline-variant/40 bg-surface-container-lowest";

  return (
    <div className={`flex min-w-0 flex-col items-center justify-end fade-slide-up ${reveal}`}>
      {winner && (
        <span className="mb-2 rounded-full bg-brand-amber px-3 py-1 text-label-sm text-on-primary shadow-md">
          ผู้ชนะ
        </span>
      )}
      <span className="inline-flex">
        <PlayerAvatar
          avatarIndex={player.avatarIndex}
          nickname={player.nickname}
          size={winner ? "xl" : "lg"}
          highlight={!winner && !onStage && isMe}
          inverse={!winner && onStage}
          className={`shadow-md ${
            winner
              ? `ring-4 ring-brand-amber ring-offset-2 ${
                  onStage ? "ring-offset-brand-navy" : "ring-offset-surface"
                }`
              : ""
          }`}
        />
      </span>
      <p
        className={`mt-3 mb-2 max-w-full truncate px-1 text-center ${
          onStage ? "text-on-primary" : "text-on-surface"
        } ${winner ? "font-display text-body-lg md:text-headline-md" : "text-label-md"}`}
      >
        {player.nickname}
        {isMe && (
          <span className={`ml-1 ${onStage ? "text-on-primary/70" : "text-on-surface-variant"}`}>
            (คุณ)
          </span>
        )}
      </p>
      <div
        className={`flex w-full flex-col items-center justify-start gap-1 rounded-t-xl pt-3 shadow-md ${height} ${face}`}
      >
        <span
          className={`inline-flex ${winner ? "h-14 w-14 md:h-16 md:w-16" : "h-10 w-10 md:h-12 md:w-12"}`}
        >
          <RankMedal place={place} />
        </span>
        <span className="font-display text-body-lg text-primary-container tabular-nums md:text-headline-md">
          {formatNumber(player.score)}
        </span>
        <span className="text-label-sm text-on-surface-variant">คะแนน</span>
      </div>
    </div>
  );
}
