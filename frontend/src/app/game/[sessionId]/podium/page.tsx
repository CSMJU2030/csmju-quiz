// src/app/game/[sessionId]/podium/page.tsx
// เปิดผลการแข่งขันจากลิงก์โดยตรง — ระหว่างเกม ผู้เล่นและ host เห็นผลต่อจากหน้าเกมทันที (PodiumView)
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { EmojiEventsIcon } from "@/components/icons";
import { PodiumView } from "@/components/game/podium-view";
import { PageLoader } from "@/components/game/ui";
import { EmptyState } from "@/components/shared/states";
import { secondaryButtonClass } from "@/components/shared/ui";
import { useGameState } from "@/lib/game-api";
import { playerLinks, useGameChannel } from "@/lib/game-channel";

export default function PodiumPage() {
  const params = useParams();
  const sessionId = typeof params.sessionId === "string" ? params.sessionId : "";

  const { state: game, error, loading } = useGameState(sessionId);
  const channel = useGameChannel();
  const links = playerLinks(channel, sessionId);

  if (loading) return <PageLoader />;

  if (!game || error) {
    return (
      <EmptyState
        icon={EmojiEventsIcon}
        title="ไม่พบผลการแข่งขัน"
        description={
          error?.message ?? "ไม่พบข้อมูลที่คุณกำลังค้นหา อาจถูกลบไปแล้วหรือลิงก์ไม่ถูกต้อง"
        }
        action={
          <Link href={links.home} className={secondaryButtonClass}>
            กลับหน้าหลัก
          </Link>
        }
      />
    );
  }

  if (game.phase !== "PODIUM") {
    return (
      <EmptyState
        icon={EmojiEventsIcon}
        title="เกมยังไม่จบ"
        description="ผลการแข่งขันจะแสดงเมื่อจบคำถามข้อสุดท้าย"
        action={
          <Link
            href={game.viewer === "HOST" ? `/game/${sessionId}/host` : links.play}
            className={secondaryButtonClass}
          >
            กลับไปหน้าเกม
          </Link>
        }
      />
    );
  }

  return (
    <PodiumView
      game={game}
      sessionId={sessionId}
      // ปุ่มของ host (CSV · รายงาน) เฉพาะ viewer HOST — ที่เหลือ (รวมผู้เล่นที่ไม่มี me) เป็นผู้ชม
      viewer={
        game.viewer === "HOST"
          ? { role: "host" }
          : { role: "player", playerId: game.me?.playerId ?? "" }
      }
    />
  );
}
