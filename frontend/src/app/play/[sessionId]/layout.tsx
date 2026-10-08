import type { Metadata } from "next";
import { pageTitle } from "@/lib/page-title";

// ชื่อแท็บเดียวกับ /game/[sessionId]/play (ไม่สืบ "เข้าร่วมเกม" จาก app/play/layout.tsx)
export const metadata: Metadata = { title: pageTitle("เล่นเกม") };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
