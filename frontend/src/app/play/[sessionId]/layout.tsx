import type { Metadata } from "next";

// ชื่อแท็บเดียวกับ /game/[sessionId]/play (ไม่สืบ "เข้าร่วมเกม" จาก app/play/layout.tsx)
export const metadata: Metadata = { title: "เล่นเกม" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
