// ผู้เล่นที่สแกน QR — เล่นด้วยบัตรเข้าห้อง ไม่ต้องล็อกอิน (PM อนุมัติ 2 ต.ค. 2569)
// หน้าในโฟลเดอร์นี้ใช้ component ชุดเดียวกับ /game/... แต่เรียก /api/v1/guest-games
import type { Metadata } from "next";
import { GameChannelProvider } from "@/lib/game-channel";

export const metadata: Metadata = { title: "เข้าร่วมเกม" };

// ข้อมูลขึ้นกับผู้เล่น — ห้าม cache (ui-design-system.md ข้อ 16.1.1)
export const dynamic = "force-dynamic";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <GameChannelProvider channel="guest">{children}</GameChannelProvider>;
}
