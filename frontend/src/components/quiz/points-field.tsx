// src/components/quiz/points-field.tsx
// คะแนนต่อข้อ — ช่องเดียว: พิมพ์ตัวเลข 0–5,000 เอง หรือกดลูกศรเลือกค่าที่ใช้บ่อย
// ทำตามรูปแบบ combobox ของ WAI-ARIA (input + listbox) · ลูกศรขึ้น/ลงเลือก · Enter ยืนยัน · Esc ปิด
"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, ExpandMoreIcon } from "@/components/icons";
import { FormField } from "@/components/shared/form-field";
import { inputClass } from "@/components/shared/ui";
import { formatNumber } from "@/lib/format";
import { MAX_POINTS, POINT_CHOICES } from "@/lib/question-model";

/** ความสูงของรายการ (แถวละ 44px + ขอบ) */
const LIST_HEIGHT = POINT_CHOICES.length * 44 + 16;

/** ที่ว่างใต้ช่อง ถึงขอบของกล่องที่ตัดส่วนล้น (หรือขอบจอ) ที่ใกล้ที่สุด */
function spaceBelow(el: HTMLElement | null) {
  if (!el) return Infinity;
  const bottom = el.getBoundingClientRect().bottom;
  let limit = window.innerHeight;
  for (let p = el.parentElement; p; p = p.parentElement) {
    const style = getComputedStyle(p);
    if (style.overflowY !== "visible") {
      limit = Math.min(limit, p.getBoundingClientRect().bottom);
      break;
    }
  }
  return limit - bottom;
}

export function PointsField({
  id,
  points,
  error,
  onChange,
  onBlur,
}: {
  id: string;
  points: number;
  error?: string;
  onChange: (points: number) => void;
  onBlur: () => void;
}) {
  // ข้อความในช่อง (ว่างได้ระหว่างพิมพ์) — ค่าที่ส่งออกเป็นตัวเลขเสมอ (ว่าง = NaN ให้ validateQuestion แจ้ง)
  const [text, setText] = useState(Number.isFinite(points) ? String(points) : "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  /** เปิดรายการขึ้นด้านบนเมื่อด้านล่างไม่พอ (การ์ดคำถามตัดส่วนที่ล้นทิ้ง) */
  const [upward, setUpward] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = `${id}-list`;

  // ค่าเปลี่ยนจากข้างนอก (เช่น เปลี่ยนประเภทคำถาม · ยกเลิกการแก้ไข) → ตามค่าใหม่
  const [lastPoints, setLastPoints] = useState(points);
  if (points !== lastPoints) {
    setLastPoints(points);
    if (Number(text) !== points && Number.isFinite(points)) setText(String(points));
  }

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const openList = () => {
    setUpward(spaceBelow(boxRef.current) < LIST_HEIGHT);
    setOpen(true);
    setActive(
      Math.max(
        0,
        POINT_CHOICES.findIndex((p) => p.value === points),
      ),
    );
  };

  const choose = (value: number) => {
    setText(String(value));
    onChange(value);
    setOpen(false);
    document.getElementById(id)?.focus();
  };

  return (
    <FormField
      id={id}
      label="คะแนน"
      hint={`พิมพ์เองได้ 0–${formatNumber(MAX_POINTS)} หรือกดลูกศรเลือก`}
      error={error}
    >
      <PointsCombo
        boxRef={boxRef}
        text={text}
        open={open}
        active={active}
        listId={listId}
        onText={(next) => {
          const clean = next.replace(/[^\d]/g, "").slice(0, 5);
          setText(clean);
          onChange(clean === "" ? Number.NaN : Number(clean));
        }}
        onToggle={() => (open ? setOpen(false) : openList())}
        onKey={(key) => {
          if (key === "ArrowDown" || key === "ArrowUp") {
            if (!open) {
              openList();
              return true;
            }
            const step = key === "ArrowDown" ? 1 : -1;
            setActive((i) => (i + step + POINT_CHOICES.length) % POINT_CHOICES.length);
            return true;
          }
          if (key === "Enter" && open && active >= 0) {
            choose(POINT_CHOICES[active].value);
            return true;
          }
          if (key === "Escape" && open) {
            setOpen(false);
            return true;
          }
          return false;
        }}
        onChoose={choose}
        onBlur={onBlur}
        points={points}
        upward={upward}
      />
    </FormField>
  );
}

/** ตัว combobox — แยกออกมาเพื่อให้ FormField ใส่ id / aria-* ให้ช่องพิมพ์ได้ */
function PointsCombo({
  id,
  className,
  boxRef,
  text,
  open,
  active,
  listId,
  points,
  upward,
  onText,
  onToggle,
  onKey,
  onChoose,
  onBlur,
  ...aria
}: {
  id?: string;
  className?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
  boxRef: React.RefObject<HTMLDivElement | null>;
  text: string;
  open: boolean;
  active: number;
  listId: string;
  points: number;
  upward: boolean;
  onText: (text: string) => void;
  onToggle: () => void;
  onKey: (key: string) => boolean;
  onChoose: (value: number) => void;
  onBlur: () => void;
}) {
  return (
    <div ref={boxRef} className="relative">
      <input
        id={id}
        {...aria}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="none"
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={text}
        onChange={(e) => onText(e.target.value)}
        onKeyDown={(e) => {
          if (onKey(e.key)) e.preventDefault();
        }}
        onBlur={onBlur}
        className={`${inputClass} ${className ?? ""} pr-12 tabular-nums`}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="เลือกคะแนนที่ใช้บ่อย"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onToggle}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-on-surface-variant hover:text-primary-container"
      >
        <ExpandMoreIcon className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="คะแนนที่ใช้บ่อย"
          className={`absolute left-0 right-0 z-20 overflow-hidden rounded-lg border border-outline-variant/40 bg-surface-container-lowest py-1 shadow-md fade-slide-up ${upward ? "bottom-full mb-1" : "top-full mt-1"}`}
        >
          {POINT_CHOICES.map((p, i) => {
            const selected = p.value === points;
            return (
              <li
                key={p.value}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={selected}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onChoose(p.value)}
                className={`flex min-h-11 cursor-pointer items-center justify-between gap-2 px-3 text-body-md ${
                  i === active ? "bg-primary-container/10 text-on-surface" : "text-on-surface"
                }`}
              >
                <span>{p.label}</span>
                {selected && <CheckIcon className="h-4 w-4 text-primary-container" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
