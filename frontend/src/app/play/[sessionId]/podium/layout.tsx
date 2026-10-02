import type { Metadata } from "next";

// ชื่อแท็บเดียวกับ /game/[sessionId]/podium
export const metadata: Metadata = { title: "ผลการแข่งขัน" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
