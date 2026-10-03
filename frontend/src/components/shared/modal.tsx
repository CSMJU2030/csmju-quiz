// src/components/shared/modal.tsx
// Modal / ConfirmDeleteModal ตามสเปค ui-design-system.md ข้อ 7.2.1, 8.3
// focus trap · ปิดด้วย Esc / คลิก scrim · คืน focus กลับจุดเดิม · role="dialog" + aria-modal + aria-labelledby
// (local component ชั่วคราว — เมื่อได้ template ให้ใช้ Modal/ConfirmDeleteModal จาก "@/csmju")
"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { CloseIcon } from "@/components/icons";
import { dangerButtonClass, secondaryButtonClass } from "@/components/shared/ui";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  footerAlign = "end",
  size = "md",
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /**
   * end = กล่องยืนยัน [ยกเลิก] [ยืนยัน] ชิดขวา (ข้อ 8.3)
   * start = ฟอร์มในกล่อง [บันทึก] [ยกเลิก] ชิดซ้าย เหมือนฟอร์มทั้งระบบ (ข้อ 8.1)
   */
  footerAlign?: "start" | "end";
  size?: "md" | "lg";
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        className="absolute inset-0 cursor-default bg-on-surface/40"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative max-h-[90vh] w-full overflow-y-auto rounded-xl bg-surface-container-lowest p-6 shadow-xl fade-slide-up ${
          size === "lg" ? "max-w-2xl" : "max-w-md"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="font-display text-headline-md text-on-surface">
            {title}
          </h2>
          <button
            type="button"
            aria-label="ปิด"
            onClick={onClose}
            className="-mr-2 -mt-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-variant/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-container"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 text-body-md text-on-surface-variant">{children}</div>
        {footer && (
          <div
            className={`mt-6 flex flex-wrap gap-3 ${footerAlign === "start" ? "justify-start" : "justify-end"}`}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/** ยืนยันการลบ — ระบุชื่อสิ่งที่จะลบและผลที่ตามมาเสมอ (ข้อ 8.3) */
export function ConfirmDeleteModal({
  open,
  title,
  itemName,
  consequence,
  confirmLabel = "ลบ",
  busy = false,
  onCancel,
  onConfirm,
  children,
}: {
  open: boolean;
  title: string;
  itemName: string;
  consequence: string;
  /** รายละเอียดเพิ่มเติมใต้ข้อความยืนยัน เช่น รายการที่จะถูกลบ */
  children?: ReactNode;
  confirmLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={() => {
        if (!busy) onCancel();
      }}
      footer={
        <>
          <button type="button" className={secondaryButtonClass} disabled={busy} onClick={onCancel}>
            ยกเลิก
          </button>
          <button
            type="button"
            className={`${dangerButtonClass} ${busy ? "btn-loading" : ""}`}
            aria-busy={busy}
            // .btn-loading กันแค่เมาส์ — disabled กัน Enter/Space ซ้ำด้วย
            disabled={busy}
            onClick={() => {
              if (!busy) onConfirm();
            }}
          >
            <span className="btn-text">{confirmLabel}</span>
            <span className="dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
        </>
      }
    >
      <p>
        <strong className="text-on-surface">{itemName}</strong> {consequence}
      </p>
      {children}
    </Modal>
  );
}
