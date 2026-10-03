// src/components/game/open-rooms.tsx
// ห้องเกมที่ยังเปิดอยู่ของผู้สอน — กลับเข้าห้องเดิมได้แม้ปิดแท็บไปแล้ว (server คุมเกมอยู่)
// ไม่มีห้องที่เปิดอยู่ = ไม่แสดงส่วนนี้
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowForwardIcon } from "@/components/icons";
import { StatusBadge } from "@/components/game/ui";
import { cardClass, cardHeaderClass, primaryButtonClass } from "@/components/shared/ui";
import type { GameSessionSummaryView } from "@/lib/api-types";
import { formatNumber, formatRelative } from "@/lib/format";
import { listMyOpenRooms } from "@/lib/game-api";

export function OpenRooms() {
  const [rooms, setRooms] = useState<GameSessionSummaryView[]>([]);

  useEffect(() => {
    let cancelled = false;
    listMyOpenRooms()
      .then((data) => {
        if (!cancelled) setRooms(data);
      })
      .catch(() => {
        // ส่วนเสริม — โหลดไม่ได้ก็ไม่ขวางหน้าภาพรวม
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (rooms.length === 0) return null;

  return (
    <section aria-labelledby="open-rooms" className={`${cardClass} border-primary-container/40`}>
      <div className={cardHeaderClass}>
        <h2 id="open-rooms" className="font-display text-headline-md text-on-surface">
          ห้องที่เปิดอยู่
        </h2>
        <p className="text-body-md text-on-surface-variant">
          เกมยังเดินต่อแม้ปิดแท็บไปแล้ว กดเพื่อกลับไปดำเนินเกมต่อ
        </p>
      </div>
      <ul className="divide-y divide-outline-variant/40">
        {rooms.map((room) => {
          const playing = room.status === "ACTIVE";
          return (
            <li
              key={room.id}
              className="flex flex-col gap-3 px-6 py-4 md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-body-md font-medium text-on-surface">
                  {room.quizTitle}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-label-sm text-on-surface-variant tabular-nums">
                  <StatusBadge tone={playing ? "info" : "warning"}>
                    {playing ? "กำลังเล่น" : "รอผู้เล่น"}
                  </StatusBadge>
                  <span>รหัสเกม {room.gamePin}</span>
                  <span>ผู้เล่น {formatNumber(room.playerCount)} คน</span>
                  <span>เปิดเมื่อ {formatRelative(room.createdAt)}</span>
                </div>
              </div>
              <Link href={`/game/${room.id}/host`} className={primaryButtonClass}>
                กลับเข้าห้อง
                <ArrowForwardIcon className="h-4 w-4" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
