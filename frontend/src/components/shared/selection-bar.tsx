// src/components/shared/selection-bar.tsx
// แถบด้านล่างเมื่อติ๊กเลือกรายการ — แบบเดียวกับคลังคำถาม: จำนวนที่เลือก · ลบที่เลือก · เลือกทั้งหมด · ยกเลิกการเลือก
"use client";

import { DeleteIcon } from "@/components/icons";
import { dangerButtonClass, secondaryButtonClass } from "@/components/shared/ui";
import { formatNumber } from "@/lib/format";

export function SelectionBar({
  label,
  count,
  unit,
  total,
  busy = false,
  onDelete,
  onSelectAll,
  onClear,
}: {
  /** ชื่อของ region สำหรับโปรแกรมอ่านหน้าจอ */
  label: string;
  count: number;
  /** หน่วย เช่น "ชุด" "รายงาน" */
  unit: string;
  /** จำนวนที่เลือกได้ในหน้านี้ — ยังเลือกไม่ครบจึงแสดง "เลือกทั้งหมด" */
  total: number;
  busy?: boolean;
  onDelete: () => void;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  if (count === 0) return null;
  return (
    <>
      {/* เว้นที่ท้ายหน้าไม่ให้แถบบังรายการสุดท้าย */}
      <div aria-hidden="true" className="h-24" />
      <div
        role="region"
        aria-label={label}
        className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-xl flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-md fade-slide-up md:left-64"
      >
        <p className="text-label-md text-on-surface tabular-nums" aria-live="polite">
          เลือก {formatNumber(count)} {unit}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            aria-busy={busy}
            className={dangerButtonClass}
          >
            <DeleteIcon className="h-4 w-4" />
            ลบที่เลือก
          </button>
          {count < total && (
            <button type="button" onClick={onSelectAll} className={secondaryButtonClass}>
              เลือกทั้งหมด
            </button>
          )}
          <button type="button" onClick={onClear} className={secondaryButtonClass}>
            ยกเลิกการเลือก
          </button>
        </div>
      </div>
    </>
  );
}
