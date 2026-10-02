// src/components/game/question-view.tsx
// ชิ้นส่วนหน้าคำถามที่ใช้ร่วมกันระหว่างหน้าเล่นเกม (play) และหน้าทดลองเล่น (preview)
// ทำให้สิ่งที่ผู้สร้างเห็นตอนทดลอง เหมือนกับที่ผู้เล่นเห็นในเกมจริง
"use client";

import Image from "next/image";
import { CheckIcon, CloseIcon } from "@/components/icons";
import { answerTheme } from "@/components/game/answer-theme";
import type { QuestionOption } from "@/types/quiz";

export function QuestionPrompt({
  prompt,
  image,
  as: Heading = "h2",
}: {
  prompt: string;
  image?: string;
  as?: "h1" | "h2";
}) {
  return (
    <>
      <Heading className="mx-auto max-w-3xl text-center font-display text-headline-md text-on-surface wrap-break-word lg:text-headline-lg">
        {prompt}
      </Heading>
      {image && (
        <Image
          src={image}
          alt="ภาพประกอบคำถาม"
          width={640}
          height={360}
          unoptimized
          className="mx-auto mt-4 h-auto max-h-44 w-auto rounded-xl object-contain lg:max-h-64"
        />
      )}
    </>
  );
}

export function TimerRing({
  ratio,
  seconds,
  urgent,
}: {
  ratio: number;
  seconds: number;
  urgent: boolean;
}) {
  const R = 42;
  const C = 2 * Math.PI * R;
  return (
    <div role="timer" aria-label={`เหลือเวลา ${seconds} วินาที`} className="relative h-24 w-24">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={R}
          strokeWidth="9"
          fill="none"
          className="stroke-surface-variant"
        />
        <circle
          cx="50"
          cy="50"
          r={R}
          strokeWidth="9"
          fill="none"
          strokeLinecap="round"
          className={`transition-[stroke-dashoffset] duration-200 ease-linear ${
            urgent
              ? "stroke-error"
              : ratio < 0.5
                ? "stroke-brand-amber"
                : "stroke-primary-container"
          }`}
          strokeDasharray={C}
          strokeDashoffset={C * (1 - ratio)}
        />
      </svg>
      <span
        aria-hidden="true"
        className="absolute inset-0 grid place-items-center font-display text-headline-lg text-on-surface tabular-nums"
      >
        {seconds}
      </span>
    </div>
  );
}

/**
 * กล่องสี + ไอคอนรูปทรงของตัวเลือก (ตัวแก้ไข · หน้ารายละเอียด · จอเฉลย · กราฟจำนวนคนตอบ)
 * ไอคอน 24px เสมอ — รูปทรงคือตัวแยกปุ่มจริงสำหรับคนตาบอดสี
 */
export function AnswerBadge({ index }: { index: number }) {
  const { fill, Icon } = answerTheme(index);
  return (
    <span
      aria-hidden="true"
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${fill}`}
    >
      <Icon className="h-6 w-6" />
    </span>
  );
}

/**
 * ปุ่มตัวเลือกบนหน้าเล่น — พื้นสีเต็ม ตัวอักษรและไอคอนสีขาว
 * เฉลย: ข้อที่ถูกมีไอคอนเครื่องหมายถูก + "ถูก" · ข้อที่เลือกผิดมีไอคอนกากบาท + "ผิด" · ข้ออื่นจางลง
 */
export function AnswerOptionButton({
  option,
  index,
  mine,
  showResult,
  locked,
  onSelect,
  showKeyHint = false,
}: {
  option: QuestionOption;
  index: number;
  /** ผู้เล่นเลือกข้อนี้ */
  mine: boolean;
  /** เฉลยแล้ว */
  showResult: boolean;
  /** ตอบแล้วหรือหมดเวลา — กดไม่ได้ */
  locked: boolean;
  onSelect: () => void;
  showKeyHint?: boolean;
}) {
  const theme = answerTheme(index);
  const correct = Boolean(option.isCorrect);
  const dim = (locked && !showResult && !mine) || (showResult && !correct && !mine);

  return (
    <button
      type="button"
      disabled={locked}
      onClick={onSelect}
      aria-label={`ตัวเลือกที่ ${index + 1} (${theme.label}) ${option.text}${
        showResult && correct ? " คำตอบที่ถูก" : ""
      }${showResult && mine && !correct ? " ตอบผิด" : ""}${mine ? " คำตอบของคุณ" : ""}`}
      aria-pressed={mine}
      className={[
        "relative flex min-h-16 items-center gap-3 rounded-xl px-4 py-4 text-left text-body-md font-semibold transition lg:min-h-20 lg:px-5 lg:text-body-lg",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default",
        theme.fill,
        mine ? "ring-4 ring-on-surface ring-offset-2 ring-offset-surface-container-lowest" : "",
        dim ? "opacity-50" : "opacity-100",
        !locked ? "hover:brightness-110 active:brightness-95" : "",
      ].join(" ")}
    >
      <theme.Icon className="h-7 w-7 shrink-0 lg:h-8 lg:w-8" />
      <span className="flex-1 wrap-break-word">{option.text}</span>
      {showResult && correct && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-container-lowest px-2.5 py-1 text-label-sm text-success">
          <CheckIcon className="h-4 w-4" />
          ถูก
        </span>
      )}
      {showResult && mine && !correct && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-container-lowest px-2.5 py-1 text-label-sm text-error">
          <CloseIcon className="h-4 w-4" />
          ผิด
        </span>
      )}
      {!showResult && mine && (
        <span className="shrink-0 rounded-full bg-surface-container-lowest px-2.5 py-1 text-label-sm text-on-surface">
          เลือกแล้ว
        </span>
      )}
      {showKeyHint && !locked && (
        <kbd className="hidden rounded bg-on-primary/20 px-2 py-0.5 text-caption text-on-primary md:block">
          {index + 1}
        </kbd>
      )}
    </button>
  );
}
