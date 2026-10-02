// src/components/shared/notice.tsx
// การแจ้งผลลัพธ์ตาม ui-design-system.md ข้อ 8.4
// - สำเร็จ → Toast มุมขวาบน role="status" หายเองใน 4 วินาที
// - ผิดพลาด → Alert inline role="alert" ค้างไว้จนผู้ใช้ปิด (ห้ามใช้ toast แจ้ง error)
"use client";

import { useEffect } from "react";
import { CheckCircleIcon, CloseIcon, ErrorIcon } from "@/components/icons";
import { loginUrl } from "@/lib/api";

const TOAST_MS = 4000;

export function SuccessToast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onDone, TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [message, onDone]);

  if (!message) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-4 top-20 z-50 flex items-center gap-2 rounded-lg border border-success/40 bg-surface-container-lowest px-4 py-3 text-body-md text-on-surface shadow-md fade-slide-up sm:inset-x-auto sm:right-4"
    >
      <CheckCircleIcon className="h-5 w-5 shrink-0 text-success" />
      {message}
    </div>
  );
}

export function ErrorAlert({ message, onClose }: { message: string; onClose?: () => void }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg bg-error-container px-4 py-3 text-body-md text-on-error-container"
    >
      <ErrorIcon className="mt-1 h-5 w-5 shrink-0" />
      <p className="flex-1">{message}</p>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิดข้อความแจ้งเตือน"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-on-error-container/10 focus-visible:outline-2 focus-visible:outline-on-error-container"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

/**
 * session หมดอายุบนหน้าที่มีงานกรอกค้าง (auth-contract ข้อ 7 — ห้าม redirect ทับ)
 * เปิด /auth/login ในแท็บใหม่ → SSO ตั้งคุกกี้ให้ origin นี้ → กลับมากดบันทึกในแท็บเดิมได้โดยงานไม่หาย
 */
export function ReloginNotice({ onClose }: { onClose?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-start gap-3 rounded-lg bg-error-container px-4 py-3 text-body-md text-on-error-container"
    >
      <ErrorIcon className="mt-1 h-5 w-5 shrink-0" />
      <p className="flex-1">
        หมดเวลาการเข้าสู่ระบบ งานที่แก้ไขยังอยู่ในหน้านี้ — เข้าสู่ระบบอีกครั้งในแท็บใหม่
        แล้วกลับมากดบันทึกอีกครั้ง
      </p>
      <a
        href={loginUrl()}
        target="_blank"
        rel="noopener"
        className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
      >
        เข้าสู่ระบบอีกครั้ง
      </a>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิดข้อความแจ้งเตือน"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-on-error-container/10 focus-visible:outline-2 focus-visible:outline-on-error-container"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
