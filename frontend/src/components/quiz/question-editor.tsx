// src/components/quiz/question-editor.tsx
// ตัวแก้ไขคำถามตัวเดียวของระบบ — ใช้ทั้งในหน้าแก้ไขแบบทดสอบและคลังคำถาม
// ตัวเลือกใช้สีและรูปทรงเดียวกับหน้าเกม (components/game/answer-colors.ts) เพื่อให้ผู้สร้างเห็นแบบที่ผู้เล่นเห็น
"use client";

import Image from "next/image";
import { useState } from "react";
import { AddIcon, CheckCircleIcon, CloseIcon, ErrorIcon } from "@/components/icons";
import { FormField } from "@/components/shared/form-field";
import {
  iconDangerButtonClass,
  inputClass,
  labelClass,
  secondaryButtonClass,
} from "@/components/shared/ui";
import { answerTheme } from "@/components/game/answer-theme";
import { AnswerBadge } from "@/components/game/question-view";
import {
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  MAX_OPTIONS,
  MAX_OPTION_TEXT,
  MAX_PROMPT,
  MIN_OPTIONS,
  QUESTION_TYPES,
  TIME_LIMIT_CHOICES,
  changeType,
  formatTimeLimit,
  isSupportedType,
  isValidImageUrl,
  validateQuestion,
  type QuestionContent,
} from "@/lib/question-model";
import { newId } from "@/lib/utils";
import type { Difficulty, QuestionOption } from "@/types/quiz";
import { PointsField } from "@/components/quiz/points-field";

interface QuestionEditorProps<T extends QuestionContent> {
  /** prefix ของ id ในฟอร์ม ต้องไม่ซ้ำในหน้าเดียวกัน */
  idPrefix: string;
  value: T;
  onChange: (next: T) => void;
  /** แสดงข้อผิดพลาดทันที (เช่น หลังกดบันทึก) — ถ้าไม่ตั้ง จะแสดงหลังออกจากช่อง */
  showErrors?: boolean;
  /** แสดงแท็กและระดับความยาก */
  showMeta?: boolean;
}

export function QuestionEditor<T extends QuestionContent>({
  idPrefix,
  value,
  onChange,
  showErrors = false,
  showMeta = true,
}: QuestionEditorProps<T>) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [tagText, setTagText] = useState((value.tags ?? []).join(", "));
  const issues = validateQuestion(value);
  const show = (key: string) => showErrors || touched[key];
  const touch = (key: string) => setTouched((t) => (t[key] ? t : { ...t, [key]: true }));

  const set = (patch: Partial<QuestionContent>) => onChange({ ...value, ...patch });
  const options = value.options ?? [];
  const setOptions = (next: QuestionOption[]) => set({ options: next });
  const isTrueFalse = value.type === "TRUE_FALSE";

  const optionsError = show("options") ? issues.options : undefined;
  const correctError = show("correct") || show("options") ? issues.correct : undefined;
  // ผูกข้อความ error กับช่องที่เกี่ยวข้องด้วย aria-describedby (ui-design-system.md ข้อ 8.1)
  const legendId = `${idPrefix}-options-legend`;
  const optionsErrorId = `${idPrefix}-options-error`;
  const correctErrorId = `${idPrefix}-correct-error`;
  const optionTexts = options.map((o) => o.text.trim().toLowerCase());
  const isOptionInvalid = (text: string) => {
    if (!optionsError) return false;
    const key = text.trim().toLowerCase();
    return !key || optionTexts.filter((t) => t === key).length > 1;
  };

  return (
    <div className="space-y-6">
      <fieldset className="space-y-2">
        <legend className={labelClass}>ประเภทคำถาม</legend>
        {!isSupportedType(value.type) && (
          <p className="flex items-center gap-1.5 text-label-sm text-error">
            <ErrorIcon className="h-4 w-4" />
            {issues.type}
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {QUESTION_TYPES.map((t) => {
            const checked = value.type === t.value;
            return (
              <label
                key={t.value}
                className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 transition focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary-container ${
                  checked
                    ? "border-primary-container bg-primary-container/5"
                    : "border-outline-variant hover:border-primary-container/50"
                }`}
              >
                <input
                  type="radio"
                  name={`${idPrefix}-type`}
                  value={t.value}
                  checked={checked}
                  onChange={() => {
                    onChange(changeType(value, t.value));
                    setTouched({});
                  }}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
                />
                <span>
                  <span className="block text-label-md text-on-surface">{t.label}</span>
                  <span className="block text-caption text-on-surface-variant">
                    {t.description}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <FormField
        id={`${idPrefix}-prompt`}
        label={isTrueFalse ? "ข้อความให้ตัดสินว่าถูกหรือผิด" : "โจทย์คำถาม"}
        required
        hint={`${value.prompt.length}/${MAX_PROMPT} ตัวอักษร`}
        error={show("prompt") ? issues.prompt : undefined}
      >
        <textarea
          value={value.prompt}
          onChange={(e) => set({ prompt: e.target.value })}
          onBlur={() => touch("prompt")}
          rows={2}
          maxLength={MAX_PROMPT}
          className={`${inputClass} resize-y`}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
        <FormField
          id={`${idPrefix}-image`}
          label="รูปประกอบ (ไม่บังคับ)"
          hint="วางลิงก์รูปภาพที่ขึ้นต้นด้วย https://"
          error={show("image") ? issues.image : undefined}
        >
          <input
            type="url"
            inputMode="url"
            value={value.image ?? ""}
            onChange={(e) => set({ image: e.target.value })}
            onBlur={() => touch("image")}
            placeholder="https://"
            className={inputClass}
          />
        </FormField>
        {value.image && isValidImageUrl(value.image.trim()) && (
          <Image
            src={value.image.trim()}
            alt="ตัวอย่างรูปประกอบ"
            width={160}
            height={90}
            unoptimized
            className="h-20 w-auto rounded-lg border border-outline-variant/40 object-contain sm:mt-7"
          />
        )}
      </div>

      {/* กลุ่มเลือกคำตอบที่ถูก (radio) — บังคับเลือก 1 ข้อ */}
      <fieldset
        className="space-y-3"
        role="radiogroup"
        aria-labelledby={legendId}
        aria-required="true"
        aria-invalid={correctError ? true : undefined}
        aria-describedby={correctError ? correctErrorId : undefined}
      >
        <legend id={legendId} className={labelClass}>
          {isTrueFalse ? "คำตอบที่ถูก" : "ตัวเลือกคำตอบ"}
          <span aria-hidden="true" className="ml-1 text-error">
            *
          </span>
        </legend>
        <p className="text-caption text-on-surface-variant">
          {isTrueFalse
            ? "เลือกว่าข้อความนี้ถูกหรือผิด"
            : `กรอก ${MIN_OPTIONS}–${MAX_OPTIONS} ตัวเลือก แล้วกด "คำตอบที่ถูก" ที่ตัวเลือกที่ถูก 1 ข้อ`}
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          {options.map((option, index) => {
            const theme = answerTheme(index);
            const optionId = `${idPrefix}-option-${option.id}`;
            return (
              <div
                key={option.id}
                className={`flex items-center gap-3 rounded-lg border border-l-4 bg-surface-container-lowest p-2 pl-3 ${theme.edge} ${
                  option.isCorrect ? "border-success bg-success/5" : "border-outline-variant/60"
                }`}
              >
                <AnswerBadge index={index} />

                {isTrueFalse ? (
                  <span className="flex-1 text-body-md font-medium text-on-surface">
                    {option.text}
                  </span>
                ) : (
                  <>
                    <label htmlFor={optionId} className="sr-only">
                      ตัวเลือกที่ {index + 1} ({theme.label})
                    </label>
                    <input
                      id={optionId}
                      type="text"
                      value={option.text}
                      maxLength={MAX_OPTION_TEXT}
                      onChange={(e) =>
                        setOptions(
                          options.map((o) =>
                            o.id === option.id ? { ...o, text: e.target.value } : o,
                          ),
                        )
                      }
                      onBlur={() => touch("options")}
                      placeholder={`ตัวเลือกที่ ${index + 1}`}
                      aria-invalid={isOptionInvalid(option.text) ? true : undefined}
                      aria-describedby={optionsError ? optionsErrorId : undefined}
                      className="min-h-11 w-full min-w-0 flex-1 rounded-md bg-transparent px-2 text-body-md text-on-surface placeholder:text-on-surface-variant focus:outline-2 focus:outline-primary-container"
                    />
                  </>
                )}

                <label
                  className={`inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2 text-label-sm focus-within:outline-2 focus-within:outline-primary-container ${
                    option.isCorrect
                      ? "font-semibold text-on-surface"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  <input
                    type="radio"
                    name={`${idPrefix}-correct`}
                    checked={option.isCorrect}
                    aria-describedby={correctError ? correctErrorId : undefined}
                    onChange={() => {
                      setOptions(options.map((o) => ({ ...o, isCorrect: o.id === option.id })));
                      touch("correct");
                    }}
                    className="sr-only"
                  />
                  <CheckCircleIcon
                    className={`h-5 w-5 ${option.isCorrect ? "text-success" : "opacity-40"}`}
                  />
                  <span className={isTrueFalse ? "" : "sr-only sm:not-sr-only"}>
                    {option.isCorrect ? "คำตอบที่ถูก" : "ตั้งเป็นคำตอบ"}
                  </span>
                  <span className="sr-only">ของตัวเลือกที่ {index + 1}</span>
                </label>

                {!isTrueFalse && options.length > MIN_OPTIONS && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = options.filter((o) => o.id !== option.id);
                      if (option.isCorrect && next[0]) next[0] = { ...next[0], isCorrect: true };
                      setOptions(next);
                    }}
                    className={iconDangerButtonClass}
                    aria-label={`ลบตัวเลือกที่ ${index + 1}`}
                  >
                    <CloseIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {!isTrueFalse && options.length < MAX_OPTIONS && (
          <button
            type="button"
            onClick={() => setOptions([...options, { id: newId(), text: "", isCorrect: false }])}
            className={secondaryButtonClass}
          >
            <AddIcon className="h-4 w-4" />
            เพิ่มตัวเลือก
          </button>
        )}

        {(optionsError || correctError) && (
          <div className="space-y-1" role="alert">
            {optionsError && (
              <p id={optionsErrorId} className="flex items-center gap-1.5 text-label-sm text-error">
                <ErrorIcon className="h-4 w-4" />
                {optionsError}
              </p>
            )}
            {correctError && (
              <p id={correctErrorId} className="flex items-center gap-1.5 text-label-sm text-error">
                <ErrorIcon className="h-4 w-4" />
                {correctError}
              </p>
            )}
          </div>
        )}
      </fieldset>

      <div
        className={`grid gap-4 ${showMeta ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2"}`}
      >
        <FormField id={`${idPrefix}-time`} label="เวลาตอบ">
          <select
            value={value.timeLimit}
            onChange={(e) => set({ timeLimit: Number(e.target.value) })}
            className={inputClass}
          >
            {Array.from(new Set([...TIME_LIMIT_CHOICES, value.timeLimit]))
              .sort((a, b) => a - b)
              .map((s) => (
                <option key={s} value={s}>
                  {formatTimeLimit(s)}
                </option>
              ))}
          </select>
        </FormField>
        <PointsField
          id={`${idPrefix}-points`}
          points={value.points}
          error={show("points") ? issues.points : undefined}
          onChange={(points) => set({ points })}
          onBlur={() => touch("points")}
        />

        {showMeta && (
          <>
            <FormField id={`${idPrefix}-difficulty`} label="ระดับความยาก">
              <select
                value={value.difficulty ?? "MEDIUM"}
                onChange={(e) => set({ difficulty: e.target.value as Difficulty })}
                className={inputClass}
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {DIFFICULTY_LABEL[d]}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              id={`${idPrefix}-tags`}
              label="แท็ก"
              hint="คั่นด้วยจุลภาค เช่น เครือข่าย, บทที่ 2"
            >
              <input
                type="text"
                value={tagText}
                onChange={(e) => {
                  setTagText(e.target.value);
                  set({
                    tags: e.target.value
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  });
                }}
                className={inputClass}
              />
            </FormField>
          </>
        )}
      </div>
    </div>
  );
}
