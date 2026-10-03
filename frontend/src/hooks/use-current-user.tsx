// src/hooks/use-current-user.tsx
// ผู้ใช้ปัจจุบันจาก GET /api/v1/me ของ backend ระบบย่อย (ai/CHECKLIST.md "สัญญา API")
// ตัวตนมาจาก token ที่ backend ตรวจแล้วเท่านั้น — หน้าเว็บไม่ถอด token เอง
// ไม่มี token → api.ts พาทั้งหน้าไป /auth/login (silent re-SSO) · role ที่ระบบไม่รับ → 403 (แสดงหน้าไม่มีสิทธิ์)
// หน้า /play (ผู้เล่นที่สแกน QR ใช้บัตรเข้าห้อง) ไม่เรียก /me และไม่พาไป SSO
"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ApiError, apiGet } from "@/lib/api";
import type { MeView } from "@/lib/api-types";
import { hasPermission, type PermissionName } from "@/lib/permissions";

export type CurrentUser = MeView;

export type UserState =
  | { status: "loading" }
  /** ผู้เล่นที่ใช้บัตรเข้าห้อง — ไม่มีตัวตนในระบบ */
  | { status: "guest" }
  | { status: "ready"; user: CurrentUser }
  | { status: "error"; reason: "forbidden" | "unauthorized" | "network" };

const CurrentUserContext = createContext<UserState>({ status: "loading" });

function reasonOf(err: unknown): "forbidden" | "unauthorized" | "network" {
  if (err instanceof ApiError && err.code === "FORBIDDEN") return "forbidden";
  if (err instanceof ApiError && err.code === "UNAUTHORIZED") return "unauthorized";
  return "network";
}

/** หน้าของผู้เล่นที่ใช้บัตรเข้าห้อง */
export function isGuestPath(pathname: string | null) {
  return pathname === "/play" || (pathname?.startsWith("/play/") ?? false);
}

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const guest = isGuestPath(usePathname());
  const [state, setState] = useState<UserState>({ status: "loading" });

  useEffect(() => {
    if (guest) return;
    let cancelled = false;
    apiGet<CurrentUser>("/api/v1/me")
      .then((user) => {
        if (!cancelled) setState({ status: "ready", user });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ status: "error", reason: reasonOf(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [guest]);

  const value: UserState = guest ? { status: "guest" } : state;
  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser() {
  return useContext(CurrentUserContext);
}

/** แสดง children เฉพาะผู้ที่มี permission (ซ่อน ไม่ใช่ disable — ข้อ 10.1) */
export function Can({ permission, children }: { permission: PermissionName; children: ReactNode }) {
  const state = useCurrentUser();
  if (state.status !== "ready") return null;
  return hasPermission(state.user.subsystemRole, permission) ? <>{children}</> : null;
}
