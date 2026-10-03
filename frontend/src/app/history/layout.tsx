import type { Metadata } from "next";

export const metadata: Metadata = { title: "ประวัติการเล่น" };

// ข้อมูลขึ้นกับตัวผู้ใช้ — ห้าม cache (ui-design-system.md ข้อ 16.1.1)
export const dynamic = "force-dynamic";

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
