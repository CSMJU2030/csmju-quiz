// src/components/quiz/bank-picker-modal.tsx
// เลือกคำถามจากคลังเข้าแบบทดสอบ (คัดลอก) — เปิดจากหน้าแก้ไขแบบทดสอบ
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { HubIcon, SearchIcon, SellIcon } from "@/components/icons";
import { StatusBadge } from "@/components/game/ui";
import { Modal } from "@/components/shared/modal";
import { EmptyState } from "@/components/shared/states";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  type Tone,
} from "@/components/shared/ui";
import { getBankItems, type BankItem } from "@/lib/question-bank";
import { errorMessage } from "@/lib/api";
import { DIFFICULTIES, DIFFICULTY_LABEL, isComplete } from "@/lib/question-model";
import { getQuestionTypeLabel } from "@/lib/utils";
import type { Difficulty } from "@/types/quiz";

export const DIFFICULTY_TONE: Record<Difficulty, Tone> = {
  EASY: "success",
  MEDIUM: "warning",
  HARD: "error",
};

export function BankPickerModal({
  open,
  alreadyUsedIds,
  onClose,
  onConfirm,
}: {
  open: boolean;
  /** sourceBankItemId ที่อยู่ในแบบทดสอบนี้แล้ว */
  alreadyUsedIds: string[];
  onClose: () => void;
  onConfirm: (items: BankItem[]) => void;
}) {
  // อ่านคลังจาก backend ตอนเปิด modal (component ถูก mount ใหม่ทุกครั้งที่เปิด)
  const [loaded, setLoaded] = useState<BankItem[] | null>(null);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    let cancelled = false;
    getBankItems()
      .then((data) => {
        if (!cancelled) setLoaded(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const items = useMemo(() => loaded ?? [], [loaded]);
  const [keyword, setKeyword] = useState("");
  const [tag, setTag] = useState("");
  const [level, setLevel] = useState<Difficulty | "">("");
  const [picked, setPicked] = useState<string[]>([]);

  const allTags = useMemo(
    () => Array.from(new Set(items.flatMap((i) => i.tags))).filter(Boolean),
    [items],
  );
  const filtered = useMemo(
    () =>
      items.filter(
        (i) =>
          i.prompt.toLowerCase().includes(keyword.trim().toLowerCase()) &&
          (!tag || i.tags.includes(tag)) &&
          (!level || i.difficulty === level),
      ),
    [items, keyword, tag, level],
  );

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <Modal
      open={open}
      size="lg"
      title="เพิ่มคำถามจากคลัง"
      onClose={onClose}
      footerAlign="start"
      footer={
        <>
          <button
            type="button"
            onClick={() => onConfirm(items.filter((i) => picked.includes(i.id)))}
            disabled={picked.length === 0}
            aria-describedby={picked.length === 0 ? "bank-pick-hint" : undefined}
            className={primaryButtonClass}
          >
            เพิ่ม {picked.length > 0 ? `${picked.length} ข้อ` : "คำถาม"}
          </button>
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            ยกเลิก
          </button>
          {picked.length === 0 && (
            <p id="bank-pick-hint" className="self-center text-body-md text-on-surface-variant">
              เลือกคำถามอย่างน้อย 1 ข้อ
            </p>
          )}
        </>
      }
    >
      {loadError ? (
        <p role="alert" className="text-body-md text-error">
          {loadError}
        </p>
      ) : loaded === null ? (
        <p role="status" className="py-8 text-center text-body-md text-on-surface-variant">
          กำลังโหลดคลังคำถาม
        </p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={HubIcon}
          title="ยังไม่มีคำถามในคลัง"
          description="บันทึกคำถามเข้าคลังจากหน้านี้ได้ด้วยปุ่ม “บันทึกเข้าคลัง” ของแต่ละข้อ หรือไปเพิ่มที่หน้าคลังคำถาม"
          action={
            <Link href="/question-bank" className={secondaryButtonClass}>
              ไปที่คลังคำถาม
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          <p className="text-body-md text-on-surface-variant">
            คำถามจะถูกคัดลอกเข้าแบบทดสอบนี้ แก้ไขภายหลังได้โดยไม่กระทบคลัง
          </p>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <div className="space-y-2">
              <label htmlFor="picker-search" className={labelClass}>
                ค้นหา
              </label>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-outline" />
                <input
                  id="picker-search"
                  type="search"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className={`${inputClass} pl-10`}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="picker-tag" className={labelClass}>
                แท็ก
              </label>
              <select
                id="picker-tag"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                className={inputClass}
              >
                <option value="">ทุกแท็ก</option>
                {allTags.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="picker-level" className={labelClass}>
                ความยาก
              </label>
              <select
                id="picker-level"
                value={level}
                onChange={(e) => setLevel(e.target.value as Difficulty | "")}
                className={inputClass}
              >
                <option value="">ทุกระดับ</option>
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {DIFFICULTY_LABEL[d]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="rounded-lg bg-surface-container-low px-4 py-6 text-center text-body-md text-on-surface-variant">
              ค้นหาแล้วไม่พบคำถาม ลองเปลี่ยนคำค้นหาหรือตัวกรอง
            </p>
          ) : (
            <ul className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
              {filtered.map((item) => {
                const id = `picker-${item.id}`;
                const active = picked.includes(item.id);
                const used = alreadyUsedIds.includes(item.id);
                const complete = isComplete(item);
                return (
                  <li
                    key={item.id}
                    className={`flex items-start gap-3 rounded-lg border p-3 ${
                      active
                        ? "border-primary-container bg-primary-container/5"
                        : "border-outline-variant/40"
                    }`}
                  >
                    <input
                      id={id}
                      type="checkbox"
                      checked={active}
                      disabled={!complete}
                      aria-describedby={!complete ? `${id}-reason` : undefined}
                      onChange={() => toggle(item.id)}
                      className="mt-1 h-5 w-5 shrink-0 accent-primary"
                    />
                    <div className="min-w-0 flex-1">
                      <label
                        htmlFor={id}
                        className="block cursor-pointer text-body-md text-on-surface"
                      >
                        {item.prompt || "ยังไม่มีโจทย์"}
                      </label>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <StatusBadge tone="info">{getQuestionTypeLabel(item.type)}</StatusBadge>
                        <StatusBadge tone={DIFFICULTY_TONE[item.difficulty]}>
                          {DIFFICULTY_LABEL[item.difficulty]}
                        </StatusBadge>
                        {item.tags.map((t) => (
                          <span
                            key={t}
                            className="inline-flex items-center gap-1 rounded-full bg-surface-variant px-2 py-0.5 text-label-sm text-on-surface-variant"
                          >
                            <SellIcon className="h-4 w-4" />
                            {t}
                          </span>
                        ))}
                        {used && <StatusBadge tone="neutral">มีในแบบทดสอบนี้แล้ว</StatusBadge>}
                        {!complete && (
                          <span id={`${id}-reason`}>
                            <StatusBadge tone="error">ยังไม่ครบ แก้ในคลังก่อน</StatusBadge>
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}
