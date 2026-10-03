// src/lib/game-channel.tsx
// ช่องทางของผู้เล่นในห้องเกม
//   member — ล็อกอินผ่าน Core Hub (หน้า /game/...) · ใช้ /api/v1/game-sessions
//   guest  — สแกน QR แล้วเล่นด้วยบัตรเข้าห้อง (หน้า /play/...) · ใช้ /api/v1/guest-games
// หน้าเล่นเกมใช้ component ชุดเดียวกัน ต่างกันแค่ endpoint และลิงก์ (PM อนุมัติ 2 ต.ค. 2569)
"use client";

import { createContext, useContext, type ReactNode } from "react";

export type GameChannel = "member" | "guest";

const GameChannelContext = createContext<GameChannel>("member");

export function GameChannelProvider({
  channel,
  children,
}: {
  channel: GameChannel;
  children: ReactNode;
}) {
  return <GameChannelContext.Provider value={channel}>{children}</GameChannelContext.Provider>;
}

export function useGameChannel(): GameChannel {
  return useContext(GameChannelContext);
}

/** ลิงก์ของผู้เล่นตามช่องทาง */
export function playerLinks(channel: GameChannel, sessionId?: string) {
  const guest = channel === "guest";
  return {
    join: guest ? "/play" : "/game/join",
    home: guest ? "/play" : "/",
    play: sessionId ? (guest ? `/play/${sessionId}` : `/game/${sessionId}/play`) : "",
    podium: sessionId ? (guest ? `/play/${sessionId}/podium` : `/game/${sessionId}/podium`) : "",
  };
}
