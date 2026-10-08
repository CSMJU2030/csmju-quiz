import type { Metadata } from "next";
import { pageTitle } from "@/lib/page-title";

// ชื่อแท็บเดียวกับ /game/[sessionId]/podium
export const metadata: Metadata = { title: pageTitle("ผลการแข่งขัน") };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
