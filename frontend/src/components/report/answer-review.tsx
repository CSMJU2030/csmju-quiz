// src/components/report/answer-review.tsx
// ทบทวนคำตอบรายข้อ — แสดงเฉลย คำตอบที่เลือก คะแนนที่ได้ และเวลาที่ใช้
// สถานะใช้ไอคอน + ข้อความคู่กับสีเสมอ (ui-design-system.md ข้อ 3.1)
"use client";

import { useState } from "react";
import { CheckIcon, CloseIcon } from "@/components/icons";
import { StatusBadge } from "@/components/game/ui";
import {
  cardClass,
  cardHeaderClass,
  secondaryButtonClass,
  tonalButtonClass,
} from "@/components/shared/ui";
import type { AnswerReviewView } from "@/lib/api-types";
import { formatNumber } from "@/lib/format";
import { RESULT_INFO, formatResponseTime, questionsToReview } from "@/lib/player-review";

type Filter = "all" | "review";

function OptionRow({
  text,
  isCorrect,
  isSelected,
  selectedLabel,
}: {
  text: string;
  isCorrect: boolean;
  isSelected: boolean;
  selectedLabel: string;
}) {
  const tone = isCorrect
    ? "border-success bg-success/10"
    : isSelected
      ? "border-error bg-error-container"
      : "border-outline-variant/40 bg-surface-container-lowest";
  return (
    <li className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${tone}`}>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center">
        {isCorrect ? (
          <CheckIcon className="h-5 w-5 text-success" aria-hidden="true" />
        ) : isSelected ? (
          <CloseIcon className="h-5 w-5 text-error" aria-hidden="true" />
        ) : null}
      </span>
      <span className="flex-1 text-body-md text-on-surface">{text}</span>
      <span className="flex flex-wrap justify-end gap-2 text-label-sm text-on-surface-variant">
        {isCorrect && <span>เฉลย</span>}
        {isSelected && <span className="font-semibold text-on-surface">{selectedLabel}</span>}
      </span>
    </li>
  );
}

export function AnswerReviewList({
  answers,
  selectedLabel = "คำตอบของคุณ",
}: {
  answers: AnswerReviewView[];
  /** ป้ายกำกับตัวเลือกที่ผู้เล่นเลือก — "คำตอบของคุณ" หรือ "คำตอบของผู้เล่น" */
  selectedLabel?: string;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const toReview = questionsToReview(answers);
  const shown = filter === "all" ? answers : toReview;

  return (
    <section aria-labelledby="answer-review" className={cardClass}>
      <div
        className={`${cardHeaderClass} flex flex-col gap-4 md:flex-row md:items-center md:justify-between`}
      >
        <div>
          <h2 id="answer-review" className="font-display text-headline-md text-on-surface">
            ทบทวนคำตอบรายข้อ
          </h2>
          <p className="text-body-md text-on-surface-variant">
            {toReview.length === 0
              ? "ตอบถูกทุกข้อ ยอดเยี่ยมมาก"
              : `มี ${formatNumber(toReview.length)} ข้อที่ควรทบทวน`}
          </p>
        </div>
        <div role="group" aria-label="กรองคำถาม" className="flex gap-2">
          {(
            [
              ["all", `ทั้งหมด (${formatNumber(answers.length)})`],
              ["review", `ควรทบทวน (${formatNumber(toReview.length)})`],
            ] as [Filter, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={filter === value ? tonalButtonClass : secondaryButtonClass}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="px-6 py-12 text-center text-body-md text-on-surface-variant">
          ไม่มีข้อที่ต้องทบทวน
        </p>
      ) : (
        <ol className="divide-y divide-outline-variant/40">
          {shown.map((a) => {
            const info = RESULT_INFO[a.result];
            return (
              <li key={a.questionId} className="space-y-4 px-6 py-5">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <p className="text-body-md text-on-surface">
                    <span className="text-label-md text-on-surface-variant tabular-nums">
                      ข้อ {a.questionNumber} ·{" "}
                    </span>
                    {a.prompt}
                  </p>
                  <StatusBadge tone={info.tone}>{info.label}</StatusBadge>
                </div>
                <ul className="space-y-2" aria-label={`ตัวเลือกของข้อ ${a.questionNumber}`}>
                  {a.options.map((o) => (
                    <OptionRow
                      key={o.optionId}
                      text={o.text}
                      isCorrect={o.isCorrect}
                      isSelected={o.optionId === a.selectedOptionId}
                      selectedLabel={selectedLabel}
                    />
                  ))}
                </ul>
                <p className="flex flex-wrap gap-4 text-label-sm text-on-surface-variant tabular-nums">
                  <span>
                    ได้ {formatNumber(a.earnedPoints)} / {formatNumber(a.points)} คะแนน
                  </span>
                  <span>เวลาที่ใช้ {formatResponseTime(a.responseMs)}</span>
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
