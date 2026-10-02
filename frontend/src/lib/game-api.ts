// src/lib/game-api.ts
// ห้องเกมสด — backend เป็นผู้ควบคุมเฟสและเวลาทั้งหมด (backend/src/game/game-engine.service.ts)
// หน้าเว็บแค่สั่งงาน (เปิดห้อง · เริ่ม · ข้าม · เข้าร่วม · ตอบ) และแสดงสถานะที่ได้จาก server
//   - สถานะสด: Server-Sent Events  GET /api/v1/game-sessions/:id/events  (same-origin ผ่าน proxy ของ next.config.ts
//     คุกกี้ session / บัตรเข้าห้องไปด้วยเอง)
//   - ผู้เล่นที่ไม่ล็อกอินใช้ /api/v1/guest-games/... ด้วยบัตรเข้าห้อง (คุกกี้ HttpOnly ที่ backend ตั้งให้)
//   - เวลา: ใช้ serverTime ชดเชยนาฬิกาเครื่องผู้ใช้ ทุกเครื่องจึงนับถอยหลังตรงกัน
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, apiDelete, apiGet, apiList, apiPost } from "@/lib/api";
import type {
  CreateGameSessionBody,
  GameJoinView,
  GameLobbyView,
  GameSessionSummaryView,
  GameOptionView,
  GameStateView,
} from "@/lib/api-types";
import { API_BASE_URL } from "@/lib/env";
import { useGameChannel, type GameChannel } from "@/lib/game-channel";
import type { QuestionOption } from "@/types/quiz";

export type GameState = GameStateView;
export type GamePhase = GameStateView["phase"];

/** จังหวะเกม (มิลลิวินาที) — ตรงกับ backend/src/game/game-timing.ts */
export const TIMING = {
  START_COUNTDOWN_MS: 3000,
  LOCK_WARNING_MS: 3000,
  RESULT_MS: 5000,
  LEADERBOARD_MS: 8000,
  /** ตัวเลขนับถอยหลังเต็มจอสูงสุด (วินาที) */
  COUNTDOWN_MAX_SEC: 3,
  /** ยอมรับคำตอบก่อนเวลาเริ่มจริงได้เล็กน้อย */
  START_TOLERANCE_MS: 250,
} as const;

/* ─────────── คำสั่ง ─────────── */

export const createGame = (body: CreateGameSessionBody) =>
  apiPost<GameStateView>("/api/v1/game-sessions", body);

export const startGame = (id: string) =>
  apiPost<GameStateView>(`/api/v1/game-sessions/${id}/start`, {});

/** host ข้าม: รับคำตอบ → เฉลยทันที · เฉลย → อันดับ · อันดับ → ข้อถัดไป/ประกาศผล */
export const advanceGame = (id: string) =>
  apiPost<GameStateView>(`/api/v1/game-sessions/${id}/advance`, {});

export const deleteGame = (id: string) => apiDelete(`/api/v1/game-sessions/${id}`);

export const joinGame = (id: string, nickname: string, avatarIndex: number) =>
  apiPost<GameJoinView>(`/api/v1/game-sessions/${id}/players`, { nickname, avatarIndex });

export const removePlayer = (id: string, playerId: string) =>
  apiDelete(`/api/v1/game-sessions/${id}/players/${playerId}`);

const GUEST = "/api/v1/guest-games";
const ROOM_PASS = { roomPass: true } as const;

/** path ของห้องตามช่องทาง */
function gameBase(channel: GameChannel) {
  return channel === "guest" ? GUEST : "/api/v1/game-sessions";
}

export const submitAnswer = (id: string, optionId: string, channel: GameChannel = "member") =>
  apiPost<{ questionIndex: number; optionId: string; accepted: boolean }>(
    `${gameBase(channel)}/${id}/answers`,
    { optionId },
    channel === "guest" ? ROOM_PASS : undefined,
  );

/* ─────────── ผู้เล่นที่ไม่ล็อกอิน (บัตรเข้าห้อง) ─────────── */

/** ห้องที่เปิดรอผู้เล่นด้วยรหัสนี้ (ไม่ต้องล็อกอิน) — ไม่พบ → null */
export async function guestFindLobby(pin: string): Promise<GameLobbyView | null> {
  const { data } = await apiList<GameLobbyView>(
    `${GUEST}?gamePin=${encodeURIComponent(pin)}`,
    ROOM_PASS,
  );
  return data[0] ?? null;
}

/** เข้าร่วมห้อง — backend ตั้งคุกกี้บัตรเข้าห้อง (HttpOnly) ให้ หน้าเว็บไม่เห็นค่าบัตร */
export const guestJoin = (id: string, nickname: string, avatarIndex: number) =>
  apiPost<GameJoinView>(`${GUEST}/${id}/players`, { nickname, avatarIndex }, ROOM_PASS);

export const guestLeave = (id: string, playerId: string) =>
  apiDelete(`${GUEST}/${id}/players/${playerId}`, ROOM_PASS);

/** ห้องที่เปิดรอผู้เล่นด้วยรหัสนี้ — ไม่พบ → null */
export async function findLobbyByPin(pin: string): Promise<GameLobbyView | null> {
  const { data } = await apiList<GameLobbyView>(
    `/api/v1/game-sessions?gamePin=${encodeURIComponent(pin)}`,
  );
  return data[0] ?? null;
}

/** ห้องของฉัน (host) ที่ยังไม่จบ — ห้องที่กำลังเล่นก่อน แล้วตามด้วยห้องที่รอผู้เล่น · ใหม่สุดก่อน */
export async function listMyOpenRooms(limit = 10): Promise<GameSessionSummaryView[]> {
  const [lobby, active] = await Promise.all(
    (["LOBBY", "ACTIVE"] as const).map((status) =>
      apiList<GameSessionSummaryView>(`/api/v1/game-sessions?status=${status}&limit=${limit}`),
    ),
  );
  return [...active.data, ...lobby.data];
}

export const getGameState = (id: string, channel: GameChannel = "member") =>
  apiGet<GameStateView>(`${gameBase(channel)}/${id}`, channel === "guest" ? ROOM_PASS : undefined);

/* ─────────── ตัวช่วยแสดงผล ─────────── */

/** ตัวเลือกในรูปแบบที่ component คำถามใช้ (ยังไม่เฉลย = isCorrect false) */
export function toQuestionOptions(options: GameOptionView[] | undefined): QuestionOption[] {
  return (options ?? []).map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect === true }));
}

export function ms(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

/** เวลาที่เหลือของข้อปัจจุบัน (ms) อิงเวลาของ server */
export function remainingMs(state: GameState | null, now: number): number {
  const q = state?.question;
  const start = ms(state?.questionStartedAt);
  if (!q || state?.phase !== "QUESTION" || start === null) return 0;
  const total = q.timeLimit * 1000;
  let end = start + total;
  const lock = ms(state.countdownEndsAt);
  if (lock !== null) end = Math.min(end, lock);
  return Math.min(total, Math.max(0, end - now));
}

/** ก่อนเริ่มข้อ (นับ 3-2-1 ก่อนข้อแรก) — มากกว่า 0 ระหว่างรอ */
export function startDelayMs(state: GameState | null, now: number): number {
  const start = ms(state?.questionStartedAt);
  if (state?.phase !== "QUESTION" || start === null) return 0;
  return Math.max(0, start - now);
}

/** ตัวเลขนับถอยหลังเต็มจอ (ปิดรับคำตอบ / ข้อถัดไป / ประกาศผล) — ไม่มี = null */
export function countdownValue(state: GameState | null, now: number): number | null {
  const at = ms(state?.countdownEndsAt);
  if (at === null) return null;
  const left = at - now;
  if (left <= 0 || left > TIMING.COUNTDOWN_MAX_SEC * 1000) return null;
  return Math.min(TIMING.COUNTDOWN_MAX_SEC, Math.ceil(left / 1000));
}

export function isLastQuestion(state: GameState | null) {
  return (
    !!state && state.totalQuestions > 0 && state.currentQuestionIndex >= state.totalQuestions - 1
  );
}

/** ข้อความภาษาไทยของข้อผิดพลาดจากห้องเกม (backend ตอบ message ภาษาอังกฤษ) */
export function gameErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return "ระบบขัดข้องชั่วคราว กรุณาลองอีกครั้ง";
  const m = err.message.toLowerCase();
  if (err.code === "UNAUTHORIZED")
    return "บัตรเข้าห้องหมดอายุ ห้องถูกปิด หรือคุณถูกนำออกจากห้อง กรุณาสแกน QR เพื่อเข้าห้องใหม่";
  if (err.code === "TOO_MANY_REQUESTS")
    return err.retryAfterSec
      ? `มีการขอเข้าห้องถี่เกินไป กรุณารอ ${err.retryAfterSec} วินาทีแล้วลองใหม่`
      : "มีการขอเข้าห้องถี่เกินไป กรุณารอสักครู่แล้วลองใหม่";
  if (err.code === "NOT_FOUND") return "ไม่พบห้องเกมนี้ อาจถูกปิดไปแล้ว";
  if (err.code === "FORBIDDEN") {
    if (m.includes("join")) return "คุณยังไม่ได้เข้าร่วมห้องนี้ กรุณาเข้าร่วมด้วยรหัสเกม";
    if (m.includes("host")) return "เฉพาะผู้ดำเนินเกมเท่านั้นที่ทำรายการนี้ได้";
    return "คุณไม่มีสิทธิ์เข้าถึงส่วนนี้";
  }
  if (err.code === "CONFLICT") {
    if (m.includes("nickname")) return "ชื่อนี้มีผู้เล่นใช้แล้ว กรุณาเปลี่ยนชื่อ";
    if (m.includes("room is full")) return "ห้องนี้มีผู้เล่นครบ 100 คนแล้ว";
    if (m.includes("cannot be removed")) return "นำผู้เล่นออกไม่ได้เพราะเกมจบแล้ว";
    if (m.includes("already started")) return "เกมนี้เริ่มไปแล้วหรือจบการแข่งขันแล้ว";
    if (m.includes("host cannot join"))
      return "ผู้ดำเนินเกมเข้าร่วมเป็นผู้เล่นในห้องของตัวเองไม่ได้";
    if (m.includes("at least one player")) return "ต้องมีผู้เล่นอย่างน้อย 1 คนจึงเริ่มเกมได้";
    if (m.includes("already answered")) return "คุณตอบข้อนี้ไปแล้ว";
    if (m.includes("closed") || m.includes("not started")) return "ไม่อยู่ในช่วงรับคำตอบ";
    if (m.includes("published")) return "เปิดห้องได้เฉพาะแบบทดสอบที่เผยแพร่แล้ว";
    if (m.includes("incomplete") || m.includes("no questions"))
      return "แบบทดสอบนี้มีคำถามที่ยังไม่ครบ กรุณาแก้ไขก่อนเปิดห้อง";
    if (m.includes("pin")) return "สร้างรหัสเกมไม่สำเร็จ กรุณาลองอีกครั้ง";
    if (m.includes("not active")) return "เกมนี้จบแล้ว";
  }
  if (err.code === "VALIDATION_ERROR") return "ข้อมูลบางช่องไม่ถูกต้อง กรุณาตรวจสอบแล้วลองอีกครั้ง";
  if (err.code === "NETWORK_ERROR")
    return "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง";
  return "ระบบขัดข้องชั่วคราว กรุณาลองอีกครั้ง";
}

/* ─────────── สถานะสด ─────────── */

export type GameLoadError = {
  kind: "not-found" | "forbidden" | "closed" | "other";
  message: string;
};

/**
 * ข้อผิดพลาดที่ลองใหม่ไม่ช่วย (ไม่พบห้อง · ไม่มีสิทธิ์ · ห้องปิด/บัตรหมดอายุ) → แสดงเต็มหน้า
 * ที่เหลือ (เน็ตหลุด · 5xx · 429 ระหว่างดึงซ้ำ) hook ลองใหม่เอง — หน้าจอควรแสดงเกมต่อพร้อมแถบแจ้งเล็ก ๆ
 */
export function isFatalLoadError(error: GameLoadError | null): boolean {
  return !!error && error.kind !== "other";
}

/** ช่วงเวลาดึงสถานะซ้ำเมื่อเบราว์เซอร์ไม่มี EventSource หรือ stream หลุด */
const FALLBACK_POLL_MS = 3000;

function toLoadError(err: unknown): GameLoadError {
  if (err instanceof ApiError && err.code === "UNAUTHORIZED")
    return { kind: "closed", message: gameErrorMessage(err) };
  if (err instanceof ApiError && err.code === "NOT_FOUND")
    return { kind: "not-found", message: gameErrorMessage(err) };
  if (err instanceof ApiError && err.code === "FORBIDDEN")
    return { kind: "forbidden", message: gameErrorMessage(err) };
  return { kind: "other", message: gameErrorMessage(err) };
}

/**
 * สถานะห้องเกมแบบสด + ส่วนต่างนาฬิกากับ server
 * - โหลดครั้งแรกด้วย GET แล้วฟัง SSE event "state"
 * - stream หลุด → ดึงด้วย GET ทุก 3 วินาทีจนกว่าจะต่อได้ใหม่ (EventSource ต่อใหม่ให้เอง)
 */
export function useGameState(sessionId: string) {
  const channel = useGameChannel();
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState<GameLoadError | null>(null);
  const [loading, setLoading] = useState(true);
  const offsetRef = useRef(0);
  const lastJson = useRef("");
  /** ไม่พบห้อง / ไม่มีสิทธิ์ — หยุดดึงซ้ำ */
  const fatalRef = useRef(false);

  const accept = useCallback((next: GameState) => {
    const server = Date.parse(next.serverTime);
    if (Number.isFinite(server)) offsetRef.current = server - Date.now();
    // serverTime เปลี่ยนทุกครั้ง — เทียบส่วนอื่นเพื่อไม่ให้หน้าจอวาดใหม่เปล่า ๆ
    const json = JSON.stringify({ ...next, serverTime: "" });
    if (json === lastJson.current) return;
    lastJson.current = json;
    setState(next);
  }, []);

  const refresh = useCallback(async () => {
    try {
      accept(await getGameState(sessionId, channel));
      setError(null);
    } catch (err) {
      // ผู้เล่นที่ล็อกอิน: กำลังพาไป SSO · ผู้เล่นที่ใช้บัตร: บัตรใช้ไม่ได้แล้ว แจ้งให้สแกนใหม่
      if (err instanceof ApiError && err.code === "UNAUTHORIZED" && channel === "member") return;
      const loadError = toLoadError(err);
      if (loadError.kind !== "other") fatalRef.current = true;
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }, [sessionId, accept, channel]);

  useEffect(() => {
    if (!sessionId) return;
    let disposed = false;
    fatalRef.current = false;
    let poll: number | undefined;
    const startPolling = () => {
      if (poll !== undefined) return;
      poll = window.setInterval(() => {
        if (fatalRef.current) stopPolling();
        else void refresh();
      }, FALLBACK_POLL_MS);
    };
    const stopPolling = () => {
      if (poll !== undefined) window.clearInterval(poll);
      poll = undefined;
    };

    const first = window.setTimeout(() => void refresh(), 0);

    let source: EventSource | null = null;
    if (typeof EventSource !== "undefined") {
      source = new EventSource(`${API_BASE_URL}${gameBase(channel)}/${sessionId}/events`);
      source.addEventListener("state", (event) => {
        if (disposed) return;
        stopPolling();
        try {
          accept(JSON.parse((event as MessageEvent<string>).data) as GameState);
          setError(null);
          setLoading(false);
        } catch {
          /* ข้อมูลเสีย — รอ event ถัดไป */
        }
      });
      source.addEventListener("closed", () => {
        if (disposed) return;
        source?.close();
        stopPolling();
        fatalRef.current = true;
        setError({
          kind: "closed",
          message:
            channel === "guest"
              ? "ห้องถูกปิด บัตรเข้าห้องหมดอายุ หรือคุณถูกนำออกจากห้อง"
              : "ห้องเกมนี้ถูกปิดแล้ว",
        });
      });
      source.onerror = () => {
        if (disposed || fatalRef.current) return;
        // ตรวจสาเหตุด้วย GET (401 → SSO · 403/404 → แสดงข้อผิดพลาด) และดึงสถานะแทนระหว่างรอต่อใหม่
        void refresh();
        startPolling();
      };
    } else {
      startPolling();
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      disposed = true;
      window.clearTimeout(first);
      stopPolling();
      source?.close();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [sessionId, refresh, accept, channel]);

  /** เวลาปัจจุบันตามนาฬิกาของ server */
  const serverNow = useCallback(() => Date.now() + offsetRef.current, []);

  return { state, error, loading, refresh, accept, serverNow };
}

/** นาฬิกาตามเวลา server ที่เดินทุก `intervalMs` เฉพาะตอน `active` */
export function useServerClock(serverNow: () => number, intervalMs: number, active: boolean) {
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(serverNow());
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, intervalMs);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [serverNow, intervalMs, active]);
  return now;
}
