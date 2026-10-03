// src/components/shared/pagination.tsx
// แบ่งหน้าฝั่ง server (ui-design-system.md ข้อ 8.2 · api-conventions.md ข้อ 5 — ค่าเริ่มต้น 20 รายการต่อหน้า)
// local component ชั่วคราว จนกว่าจะมี Pagination ใน "@/csmju"
"use client";

import { ChevronRightIcon } from "@/components/icons";
import { secondaryButtonClass } from "@/components/shared/ui";
import type { PageMeta } from "@/lib/api";
import { formatNumber } from "@/lib/format";

export const PAGE_SIZE = 20;

export function Pagination({
  meta,
  onPage,
  label = "รายการ",
}: {
  meta: PageMeta;
  onPage: (page: number) => void;
  /** หน่วยที่แสดง เช่น "แบบทดสอบ" */
  label?: string;
}) {
  if (meta.total === 0) return null;
  const from = (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.total, meta.page * meta.limit);

  return (
    <nav
      aria-label="แบ่งหน้า"
      className="flex flex-col items-center justify-between gap-3 sm:flex-row"
    >
      <p className="text-label-md text-on-surface-variant tabular-nums" aria-live="polite">
        แสดง {formatNumber(from)}–{formatNumber(to)} จาก {formatNumber(meta.total)} {label}
      </p>
      {meta.totalPages > 1 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPage(meta.page - 1)}
            disabled={meta.page <= 1}
            className={secondaryButtonClass}
          >
            <ChevronRightIcon className="h-4 w-4 rotate-180" />
            ก่อนหน้า
          </button>
          <span className="px-2 text-label-md text-on-surface tabular-nums">
            หน้า {formatNumber(meta.page)} / {formatNumber(meta.totalPages)}
          </span>
          <button
            type="button"
            onClick={() => onPage(meta.page + 1)}
            disabled={meta.page >= meta.totalPages}
            className={secondaryButtonClass}
          >
            ถัดไป
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      )}
    </nav>
  );
}
