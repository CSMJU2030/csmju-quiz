// src/components/report/result-summary.tsx
// สรุปผลของผู้เล่นหนึ่งคนในเกมหนึ่ง — ใช้ในประวัติการเล่น (ของฉัน) และรายงานรายคน (host)

import { PlayerIdentity } from "@/components/game/player-avatar";
import { RankIcon, rankStyle } from "@/components/game/ui";
import { cardClass } from "@/components/shared/ui";
import type { PlayerGameReviewView } from "@/lib/api-types";
import { AWARD_INFO, isAwardKind } from "@/lib/awards";
import { formatDateTime, formatNumber, formatPercent } from "@/lib/format";
import { formatRank, formatResponseTime } from "@/lib/player-review";

export function ResultSummary({ result }: { result: PlayerGameReviewView }) {
  const stats: [string, string][] = [
    ["คะแนน", formatNumber(result.score)],
    ["ตอบถูก", `${formatNumber(result.correct)} / ${formatNumber(result.questionCount)} ข้อ`],
    ["ความแม่นยำ", formatPercent(result.accuracy)],
    ["ตอบถูกติดกันสูงสุด", `${formatNumber(result.maxStreak)} ข้อ`],
    ["เวลาตอบเฉลี่ย", formatResponseTime(result.averageResponseMs || null)],
  ];

  return (
    <section aria-labelledby="result-summary" className={`${cardClass} p-6`}>
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <span
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${rankStyle(result.rank)}`}
          >
            <RankIcon place={result.rank} />
          </span>
          <div className="min-w-0">
            <h2 id="result-summary" className="font-display text-headline-md text-on-surface">
              {formatRank(result.rank, result.playerCount)}
            </h2>
            <PlayerIdentity
              avatarIndex={result.avatarIndex}
              nickname={result.nickname}
              size="xs"
              nameClassName="text-body-md text-on-surface-variant"
              className="mt-1 max-w-64"
            />
            <p className="mt-1 text-label-sm text-on-surface-variant">
              เล่นเมื่อ {formatDateTime(result.finishedAt)}
            </p>
          </div>
        </div>
        {result.awards.length > 0 && (
          <ul aria-label="รางวัลพิเศษ" className="flex flex-wrap gap-2">
            {result.awards.filter(isAwardKind).map((kind) => {
              const info = AWARD_INFO[kind];
              const AwardIcon = info.icon;
              return (
                <li
                  key={kind}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand-amber/15 px-3 py-1.5 text-label-sm text-on-surface"
                >
                  <AwardIcon className="h-4 w-4" />
                  {info.title}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-5">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-lg bg-surface-container p-4">
            <dt className="text-label-sm text-on-surface-variant">{label}</dt>
            <dd className="mt-1 font-display text-headline-md text-primary-container tabular-nums">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
