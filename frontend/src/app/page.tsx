// src/app/page.tsx — หน้าแรก "/"
// หน้าแรกแสดงสถิติส่วนตัวของผู้ใช้ — ห้าม cache (ui-design-system.md ข้อ 16.1.1)
import HomePage from "@/components/home/home-page";

export const dynamic = "force-dynamic";

export default function Page() {
  return <HomePage />;
}
