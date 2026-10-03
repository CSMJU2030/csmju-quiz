// src/components/shell/logout-form.tsx
// ออกจากระบบจริง (เครื่องในห้องแล็บใช้ร่วมกัน) — POST /auth/logout (same-origin · proxy ไป backend)
// backend ล้างคุกกี้ session แล้วพาไปออกจากระบบที่ Core Hub ต่อ (303)
// ใช้ <form method="post"> ไม่ใช่ลิงก์ — กัน prefetch / ลิงก์จากเว็บอื่นทำให้หลุดออกจากระบบ
"use client";

import type { ReactNode } from "react";
import { logoutUrl } from "@/lib/api";

export function LogoutForm({
  children,
  className,
  buttonClassName,
}: {
  children: ReactNode;
  className?: string;
  buttonClassName?: string;
}) {
  return (
    <form method="post" action={logoutUrl()} className={className}>
      <button type="submit" className={buttonClassName}>
        {children}
      </button>
    </form>
  );
}
