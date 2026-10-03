// src/lib/player-session.ts
// ค่าที่จำไว้ในเครื่องเพื่อความสะดวกของผู้เล่นเท่านั้น — รวมไว้ที่เดียว ห้ามหน้าเว็บอ่าน/เขียน storage เอง
// - ชื่อ/รูปโปรไฟล์ที่ใช้ครั้งก่อน (เติมให้ในหน้าเข้าร่วมเกม) ค่าปิดเสียง และเวลาที่พาไปล็อกอินล่าสุด (กันวน)
// - ไม่มี token ตัวตน หรือข้อมูลเกม — ข้อมูลเกมทั้งหมดอยู่ที่ backend (SEC-03)

import { isAvatarIndex } from "@/lib/avatars";

const LAST_NICKNAME = "csmju:last-nickname";
const LAST_AVATAR = "csmju:last-avatar";
const SFX_MUTED = "csmju:sfx-muted";

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return typeof window === "undefined" ? fallback : fn();
  } catch {
    return fallback;
  }
}

function parseAvatar(raw: string | null): number | null {
  if (raw === null || raw.trim() === "") return null;
  const n = Number(raw);
  return isAvatarIndex(n) ? n : null;
}

export function saveLastProfile(nickname: string, avatarIndex: number) {
  safe(() => {
    localStorage.setItem(LAST_NICKNAME, nickname);
    localStorage.setItem(LAST_AVATAR, String(avatarIndex));
  }, undefined);
}

export function readLastProfile(): { nickname: string; avatarIndex: number | null } {
  return safe(
    () => ({
      nickname: localStorage.getItem(LAST_NICKNAME) ?? "",
      avatarIndex: parseAvatar(localStorage.getItem(LAST_AVATAR)),
    }),
    { nickname: "", avatarIndex: null },
  );
}

/** ค่าปิดเสียงเอฟเฟกต์ (จำไว้ในเครื่องนี้) */
export function readSfxMuted(): boolean {
  return safe(() => localStorage.getItem(SFX_MUTED) === "1", false);
}

export function saveSfxMuted(muted: boolean) {
  safe(() => localStorage.setItem(SFX_MUTED, muted ? "1" : "0"), undefined);
}

// ─── กันวนตอนพาไปล็อกอิน (auth-contract ข้อ 7) ───
// เพิ่งพาไป /auth/login ไม่ถึง 30 วินาทีแล้วยังได้ 401 อีก → ไม่ redirect ซ้ำ ให้แสดงปุ่ม "เข้าสู่ระบบอีกครั้ง"

const SSO_REDIRECT_AT = "csmju:sso-redirect-at";
const SSO_LOOP_WINDOW_MS = 30_000;

export function markSsoRedirect(now = Date.now()) {
  safe(() => sessionStorage.setItem(SSO_REDIRECT_AT, String(now)), undefined);
}

export function isSsoRedirectRecent(now = Date.now()): boolean {
  return safe(() => {
    const at = Number(sessionStorage.getItem(SSO_REDIRECT_AT));
    return Number.isFinite(at) && at > 0 && now - at >= 0 && now - at < SSO_LOOP_WINDOW_MS;
  }, false);
}
