// src/components/game/podium-view.tsx
// หน้าประกาศผล — ใช้ร่วมกันระหว่างหน้าเล่น (ผู้เล่น) หน้า host และหน้า /podium
// แสดงต่อจากเกมได้ทันทีโดยไม่ต้องเปลี่ยนหน้า จึงไม่มีจังหวะหน้าจอโหลดคั่น
// ลำดับ: แท่น 3 อันดับ (เผยทีละแท่น 3 → 2 → 1) → ผลของคุณ → อันดับทั้งหมด → สถิติ → ปุ่มต่าง ๆ
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BarChartIcon,
  CheckIcon,
  ContentCopyIcon,
  DownloadIcon,
  LinkIcon,
  RefreshIcon,
  SearchIcon,
  SportsEsportsIcon,
} from "@/components/icons";
import { PlayerIdentity } from "@/components/game/player-avatar";
import { PodiumBlock } from "@/components/game/podium-block";
import { RankIcon, rankStyle } from "@/components/game/ui";
import {
  cardClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  tonalButtonClass,
} from "@/components/shared/ui";
import { formatNumber } from "@/lib/format";
import { AWARD_INFO, isAwardKind, type AwardKind } from "@/lib/awards";
import type { GameState } from "@/lib/game-api";
import { playerLinks, useGameChannel } from "@/lib/game-channel";

type Row = {
  id: string;
  nickname: string;
  avatarIndex: number | null;
  score: number;
  maxStreak: number;
  correct: number;
  answered: number;
  place: number;
};

/** แสดงช่องค้นหาเมื่อผู้เล่นเยอะจนต้องเลื่อนหา */
const SEARCH_THRESHOLD = 10;

export function PodiumView({
  game,
  sessionId,
  viewer,
}: {
  /** สถานะห้องที่ phase = PODIUM (backend ส่งสถิติและรางวัลมาใน results) */
  game: GameState;
  sessionId: string;
  /** host เห็นปุ่มจัดการผล · player เห็นการ์ดผลของตัวเอง */
  viewer: { role: "host" } | { role: "player"; playerId: string };
}) {
  const channel = useGameChannel();
  const [keyword, setKeyword] = useState("");
  const [copied, setCopied] = useState("");
  /** คัดลอกไม่สำเร็จ (ไม่ได้รับอนุญาตเข้าถึงคลิปบอร์ด / หน้าเว็บไม่ใช่ https) */
  const [copyFailed, setCopyFailed] = useState(false);

  // มาจากหน้าเกมที่เลื่อนลงไว้ → เริ่มดูผลจากด้านบน
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  const quizTitle = game.quizTitle || "CSMJU Quiz";
  const totalQuestions = game.totalQuestions;
  const meId = viewer.role === "player" ? viewer.playerId : "";

  const rows: Row[] = useMemo(() => {
    const stats = new Map((game.results?.players ?? []).map((s) => [s.playerId, s]));
    // players เรียงตามอันดับจาก backend แล้ว (คะแนนเท่ากันได้อันดับเดียวกัน)
    return game.players.map((p) => {
      const st = stats.get(p.id);
      return {
        id: p.id,
        nickname: p.nickname || "ผู้เล่น",
        avatarIndex: p.avatarIndex,
        score: p.score,
        maxStreak: st?.maxStreak ?? 0,
        correct: st?.correct ?? 0,
        answered: st?.answered ?? 0,
        place: p.rank,
      };
    });
  }, [game]);

  const awards = useMemo(
    () =>
      // ข้ามรางวัลชนิดที่หน้าเว็บยังไม่รู้จัก
      (game.results?.awards ?? []).flatMap((a) =>
        isAwardKind(a.kind)
          ? [{ kind: a.kind as AwardKind, playerId: a.playerId, value: a.value }]
          : [],
      ),
    [game],
  );
  const rowById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);

  const totalPlayers = rows.length;
  const avgAccuracy =
    totalPlayers && totalQuestions
      ? Math.round(
          (rows.reduce((s, r) => s + r.correct, 0) / (totalPlayers * totalQuestions)) * 100,
        )
      : 0;
  const [first, second, third] = rows;
  const me = meId ? rowById.get(meId) : undefined;
  const myAwards = me ? awards.filter((a) => a.playerId === me.id) : [];
  // คนที่อยู่เหนือเราหนึ่งอันดับ — ใช้บอกระยะห่าง
  const ahead = me ? [...rows].reverse().find((r) => r.score > me.score) : undefined;
  const q = keyword.trim().toLowerCase();
  const filtered = q ? rows.filter((r) => r.nickname.toLowerCase().includes(q)) : rows;

  /* ─────── actions (host) ─────── */
  const flash = (key: string) => {
    setCopyFailed(false);
    setCopied(key);
    window.setTimeout(() => setCopied(""), 4000);
  };

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      flash(key);
    } catch {
      setCopied("");
      setCopyFailed(true);
      window.setTimeout(() => setCopyFailed(false), 4000);
    }
  };

  const exportCsv = () => {
    const header = [
      "อันดับ",
      "ชื่อผู้เล่น",
      "คะแนน",
      "ตอบถูก",
      "ตอบทั้งหมด",
      "ความแม่นยำ (%)",
      "ตอบถูกติดกันสูงสุด (ข้อ)",
    ];
    const body = rows.map((r) => [
      r.place,
      `"${r.nickname.replace(/"/g, '""')}"`,
      r.score,
      r.correct,
      r.answered,
      r.answered ? Math.round((r.correct / r.answered) * 100) : 0,
      r.maxStreak,
    ]);
    const csv = "﻿" + [header, ...body].map((l) => l.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `csmju-quiz-${sessionId}.csv`;
    a.click();
    // บางเบราว์เซอร์เริ่มดาวน์โหลดหลัง click คืนค่าแล้ว — ยกเลิก URL ทันทีจะได้ไฟล์ว่าง/ดาวน์โหลดล้มเหลว
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const copySummary = async () => {
    const text = [
      `ผลการแข่งขัน: ${quizTitle}`,
      ...rows.slice(0, 10).map((r) => `${r.place}. ${r.nickname} — ${formatNumber(r.score)} คะแนน`),
    ].join("\n");
    await copyText("summary", text);
  };

  const copyLink = () => copyText("link", `${window.location.origin}/game/${sessionId}/podium`);

  return (
    <div className="space-y-8">
      {/* ─────── เวทีประกาศผล ─────── */}
      <section
        aria-labelledby="podium-title"
        className="brand-gradient relative overflow-hidden rounded-2xl px-3 pt-8 shadow-xl md:px-10 md:pt-10"
      >
        <header className="relative text-center fade-slide-up">
          <p className="text-label-md text-on-primary/70">{quizTitle}</p>
          <h1
            id="podium-title"
            className="mt-1 font-display text-headline-md text-on-primary md:text-headline-lg"
          >
            ผลการแข่งขัน
          </h1>
        </header>

        <div className="relative mx-auto mt-6 grid max-w-3xl grid-cols-3 items-end gap-2 md:mt-8 md:gap-6">
          <PodiumBlock
            variant="stage"
            player={second}
            place={2}
            height="h-32 md:h-40"
            isMe={second?.id === meId}
          />
          <PodiumBlock
            variant="stage"
            player={first}
            place={1}
            height="h-40 md:h-52"
            isMe={first?.id === meId}
          />
          <PodiumBlock
            variant="stage"
            player={third}
            place={3}
            height="h-28 md:h-32"
            isMe={third?.id === meId}
          />
        </div>
      </section>
      {first && (
        <p role="status" className="sr-only">
          ผู้ชนะคือ {first.nickname} ได้ {formatNumber(first.score)} คะแนน
        </p>
      )}

      {/* ─────── ผลของคุณ (ผู้เล่น) ─────── */}
      {me && (
        <section
          aria-labelledby="my-result"
          className="rounded-xl border border-primary-container/20 bg-primary-container/10 p-5 fade-slide-up stagger-3"
        >
          <div className="flex flex-wrap items-center gap-4">
            <PlayerIdentity
              avatarIndex={me.avatarIndex}
              nickname={me.nickname}
              size="lg"
              highlight
              nameClassName="font-display text-headline-md text-on-surface"
              className="min-w-0 flex-1"
            />
            <p className="font-display text-headline-lg text-primary-container tabular-nums">
              {formatNumber(me.score)}
              <span className="ml-1 text-label-md text-on-surface-variant">คะแนน</span>
            </p>
          </div>
          <h2 id="my-result" className="mt-4 text-body-lg font-semibold text-on-surface">
            {me.place === 1
              ? "คุณคือผู้ชนะ!"
              : me.place <= 3
                ? `ยอดเยี่ยม! คุณติด 3 อันดับแรก (อันดับ ${me.place})`
                : `คุณได้อันดับ ${me.place} จาก ${totalPlayers} คน`}
          </h2>
          <p className="mt-1 text-body-md text-on-surface-variant tabular-nums">
            ตอบถูก {me.correct}/{totalQuestions} ข้อ · ความแม่นยำ{" "}
            {me.answered ? Math.round((me.correct / me.answered) * 100) : 0}%
          </p>

          {first && me.place > 1 && (
            <div className="mt-4">
              <div className="flex justify-between text-label-sm text-on-surface-variant tabular-nums">
                <span>คะแนนของคุณเทียบกับผู้ชนะ</span>
                <span>{first.score > 0 ? Math.round((me.score / first.score) * 100) : 0}%</span>
              </div>
              <div
                role="progressbar"
                aria-label="คะแนนของคุณเทียบกับผู้ชนะ"
                aria-valuemin={0}
                aria-valuemax={first.score}
                aria-valuenow={me.score}
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-container-lowest"
              >
                <div
                  className="h-full rounded-full bg-primary-container transition-[width] duration-300"
                  style={{
                    width: `${first.score > 0 ? Math.min(100, (me.score / first.score) * 100) : 0}%`,
                  }}
                />
              </div>
              {ahead && (
                <p className="mt-2 text-label-sm text-on-surface-variant tabular-nums">
                  {ahead.score === me.score
                    ? `คะแนนเท่ากับอันดับ ${ahead.place}`
                    : `ห่างอันดับ ${ahead.place} อีก ${formatNumber(ahead.score - me.score)} คะแนน`}
                </p>
              )}
            </div>
          )}

          {myAwards.length > 0 && (
            <ul aria-label="รางวัลพิเศษของคุณ" className="mt-4 flex flex-wrap gap-2">
              {myAwards.map((a) => {
                const info = AWARD_INFO[a.kind];
                const AwardIcon = info.icon;
                return (
                  <li
                    key={a.kind}
                    className="inline-flex items-center gap-1.5 rounded-full bg-brand-amber px-3 py-1 text-label-sm text-on-surface"
                  >
                    <AwardIcon className="h-4 w-4" />
                    {info.title}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {awards.length > 0 && (
        <section aria-labelledby="awards" className="fade-slide-up stagger-3">
          <h2 id="awards" className="font-display text-headline-md text-on-surface">
            รางวัลพิเศษ
          </h2>
          <ul className="mt-4 grid gap-4 md:grid-cols-3">
            {awards.map((a) => {
              const info = AWARD_INFO[a.kind];
              const AwardIcon = info.icon;
              const winnerRow = rowById.get(a.playerId);
              if (!winnerRow) return null;
              const isMe = winnerRow.id === meId;
              return (
                <li
                  key={a.kind}
                  className={`${cardClass} flex items-center gap-4 p-5 fade-slide-up stagger-3 ${
                    isMe ? "ring-2 ring-brand-amber" : ""
                  }`}
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-amber text-on-surface">
                    <AwardIcon className="h-6 w-6" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-label-md text-on-surface-variant">{info.title}</p>
                    <PlayerIdentity
                      avatarIndex={winnerRow.avatarIndex}
                      nickname={winnerRow.nickname}
                      size="xs"
                      isMe={isMe}
                      nameClassName="text-body-md font-semibold text-on-surface"
                      className="mt-1 max-w-full"
                    />
                    <p className="mt-0.5 text-label-sm text-on-surface-variant tabular-nums">
                      {info.detail(a.value)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ─────── อันดับทั้งหมด ─────── */}
      <section aria-labelledby="full-ranking" className={`${cardClass} fade-slide-up stagger-3`}>
        <div className="flex flex-col gap-4 border-b border-outline-variant/40 px-6 py-5 md:flex-row md:items-end md:justify-between">
          <h2 id="full-ranking" className="font-display text-headline-md text-on-surface">
            อันดับทั้งหมด <span className="tabular-nums">({totalPlayers})</span>
          </h2>
          {totalPlayers > SEARCH_THRESHOLD && (
            <div className="space-y-2 md:w-72">
              <label htmlFor="podium-search" className={labelClass}>
                ค้นหาผู้เล่น
              </label>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-outline" />
                <input
                  id="podium-search"
                  type="search"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className={`${inputClass} pl-10`}
                />
              </div>
            </div>
          )}
        </div>

        {filtered.length === 0 ? (
          <p className="px-6 py-12 text-center text-body-md text-on-surface-variant">
            {totalPlayers === 0 ? "ไม่มีผู้เล่นในเกมนี้" : "ค้นหาแล้วไม่พบผู้เล่น"}
          </p>
        ) : (
          <ol className="divide-y divide-outline-variant/40">
            {filtered.map((p) => {
              const acc = p.answered ? Math.round((p.correct / p.answered) * 100) : 0;
              const isMe = p.id === meId;
              return (
                <li
                  key={p.id}
                  aria-current={isMe ? "true" : undefined}
                  className={`flex items-center gap-4 px-6 py-4 ${isMe ? "bg-primary-container/10" : ""}`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${rankStyle(p.place)}`}
                  >
                    <RankIcon place={p.place} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <PlayerIdentity
                      avatarIndex={p.avatarIndex}
                      nickname={p.nickname}
                      size="sm"
                      isMe={isMe}
                      highlight={isMe}
                      nameClassName="text-body-md font-medium text-on-surface"
                      className="max-w-full"
                    />
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-label-sm text-on-surface-variant tabular-nums">
                      <span>
                        ตอบถูก {p.correct}/{totalQuestions} ข้อ
                      </span>
                      <span>ความแม่นยำ {acc}%</span>
                    </div>
                  </div>
                  <p className="font-display text-headline-md text-primary-container tabular-nums">
                    {formatNumber(p.score)}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* ─────── สถิติ (ข้อมูลเสริม) ─────── */}
      <section aria-labelledby="game-stats" className={`${cardClass} p-6 fade-slide-up stagger-3`}>
        <h2 id="game-stats" className="text-label-md text-on-surface-variant">
          สรุปเกม
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            ["ผู้เล่น", `${formatNumber(totalPlayers)} คน`],
            ["คำถาม", `${formatNumber(totalQuestions)} ข้อ`],
            ["ความแม่นยำเฉลี่ย", `${avgAccuracy}%`],
            ["คะแนนสูงสุด", formatNumber(first?.score ?? 0)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-surface-container-low p-4">
              <dt className="text-label-sm text-on-surface-variant">{label}</dt>
              <dd className="mt-1 font-display text-headline-md text-on-surface tabular-nums">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ─────── ปุ่มต่าง ๆ ─────── */}
      {viewer.role === "host" ? (
        <section aria-label="การจัดการผล" className="flex flex-wrap justify-end gap-3">
          <button type="button" onClick={exportCsv} className={secondaryButtonClass}>
            <DownloadIcon className="h-4 w-4" />
            ดาวน์โหลดไฟล์ CSV
          </button>
          <button type="button" onClick={copySummary} className={secondaryButtonClass}>
            {copied === "summary" ? (
              <CheckIcon className="h-4 w-4" />
            ) : (
              <ContentCopyIcon className="h-4 w-4" />
            )}
            {copied === "summary" ? "คัดลอกแล้ว" : "คัดลอกสรุปผล"}
          </button>
          <button type="button" onClick={copyLink} className={secondaryButtonClass}>
            {copied === "link" ? (
              <CheckIcon className="h-4 w-4" />
            ) : (
              <LinkIcon className="h-4 w-4" />
            )}
            {copied === "link" ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}
          </button>
          <Link href="/game/create" className={tonalButtonClass}>
            <RefreshIcon className="h-4 w-4" />
            เปิดห้องเล่นเกมใหม่
          </Link>
          <Link href={`/reports/${sessionId}`} className={primaryButtonClass}>
            <BarChartIcon className="h-4 w-4" />
            ดูรายงานฉบับเต็ม
          </Link>
        </section>
      ) : (
        <section aria-label="เล่นต่อ" className="flex flex-wrap justify-center gap-3">
          {channel === "member" && (
            <Link href="/" className={secondaryButtonClass}>
              กลับหน้าหลัก
            </Link>
          )}
          <Link href={playerLinks(channel).join} className={primaryButtonClass}>
            <SportsEsportsIcon className="h-4 w-4" />
            เข้าร่วมเกมใหม่
          </Link>
        </section>
      )}
      {/* ผลการคัดลอก: สำเร็จ = ประกาศให้โปรแกรมอ่านหน้าจอ (ปุ่มเปลี่ยนเป็น "คัดลอกแล้ว") · ไม่สำเร็จ = แสดงบนจอ */}
      <p
        role="status"
        aria-live="polite"
        className={copyFailed ? "text-right text-label-md text-error" : "sr-only"}
      >
        {copyFailed ? "คัดลอกไม่สำเร็จ กรุณาลองอีกครั้ง" : copied ? "คัดลอกแล้ว" : ""}
      </p>
    </div>
  );
}
