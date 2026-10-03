// src/components/home/home-page.tsx — เนื้อหาหน้าแรก "/" (client) · app/page.tsx ห่อไว้เพื่อตั้ง dynamic
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowForwardIcon,
  EmojiEventsIcon,
  GroupsIcon,
  SportsEsportsIcon,
  TimerIcon,
  type IconComponent,
} from "@/components/icons";
import { PlayerProgress } from "@/components/history/player-progress";
import { PageSkeleton } from "@/components/shared/states";
import { Can, useCurrentUser } from "@/hooks/use-current-user";
import { hasPermission, Permission } from "@/lib/permissions";

const FEATURES: { icon: IconComponent; title: string; desc: string }[] = [
  {
    icon: TimerIcon,
    title: "ตอบไว ได้คะแนนเพิ่ม",
    desc: "คะแนนคิดจากความเร็วและการตอบถูกต่อเนื่อง",
  },
  { icon: GroupsIcon, title: "เล่นพร้อมกัน", desc: "ทุกคนตอบก่อนเข้าสู่ข้อต่อไป" },
  { icon: EmojiEventsIcon, title: "อันดับแบบเรียลไทม์", desc: "ดูคะแนนหลังจบแต่ละข้อ" },
];

function QuickAccess({
  href,
  icon: TileIcon,
  title,
  desc,
}: {
  href: string;
  icon: IconComponent;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-xl border border-surface-variant bg-surface-container-lowest p-6 text-left transition hover:border-primary-container hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-container"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-container text-primary-container">
        <TileIcon className="h-6 w-6" />
      </span>
      <span className="flex-1">
        <span className="block font-display text-headline-md text-on-surface">{title}</span>
        <span className="mt-1 block text-body-md text-on-surface-variant">{desc}</span>
      </span>
      <ArrowForwardIcon className="h-5 w-5 text-outline transition-colors group-hover:text-primary-container" />
    </Link>
  );
}

export default function HomePage() {
  const current = useCurrentUser();
  const role = current.status === "ready" ? current.user.subsystemRole : null;
  const isHost = hasPermission(role, Permission.QUIZ_READ_OWN);
  const router = useRouter();

  // หน้าแรกของผู้สอนคือหน้าภาพรวม (ห้องที่เปิดอยู่ · ผลเกมล่าสุด · แบบทดสอบ)
  useEffect(() => {
    if (isHost) router.replace("/dashboard");
  }, [isHost, router]);

  if (current.status === "loading" || isHost) return <PageSkeleton />;

  return (
    <div className="space-y-8">
      <header className="fade-slide-up">
        <h1 className="font-display text-headline-md text-on-surface md:text-headline-lg">
          สนุกกับการเรียนรู้ด้วยเกมตอบคำถาม
        </h1>
        <p className="mt-1 max-w-prose text-body-md text-on-surface-variant">
          แพลตฟอร์มตอบคำถามแบบเรียลไทม์สำหรับการเรียนรู้และการแข่งขันในห้องเรียน
        </p>
      </header>

      {/* ทางลัดของผู้เล่น (ผู้สอนถูกพาไปหน้าภาพรวมแล้ว) — การ์ดแบบเดียวกับหน้าภาพรวม */}
      {current.status === "ready" && (
        <section aria-labelledby="quick-access" className="space-y-4">
          <h2
            id="quick-access"
            className="border-l-4 border-primary-container pl-3 font-display text-headline-md text-on-surface"
          >
            เริ่มต้นใช้งาน
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Can permission={Permission.GAME_JOIN}>
              <QuickAccess
                href="/game/join"
                icon={SportsEsportsIcon}
                title="เข้าร่วมเกม"
                desc="กรอกรหัสเกมเพื่อเริ่มเล่น"
              />
            </Can>
          </div>
        </section>
      )}

      {/* ผลงานของฉัน — เฉพาะเกมที่เข้าด้วยบัญชี MJU */}
      {hasPermission(role, Permission.GAME_HISTORY_READ_OWN) && (
        <PlayerProgress isPlayer={role === "PLAYER"} />
      )}

      {/* วิธีเล่น */}
      <section aria-labelledby="features" className="space-y-4">
        <h2
          id="features"
          className="border-l-4 border-primary-container pl-3 font-display text-headline-md text-on-surface"
        >
          วิธีเล่น
        </h2>
        <ul className="grid gap-6 md:grid-cols-3">
          {FEATURES.map(({ icon: FeatureIcon, title, desc }) => (
            <li
              key={title}
              className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-6"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-container/10 text-primary-container">
                <FeatureIcon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-label-md text-on-surface">{title}</h3>
              <p className="mt-1 text-body-md text-on-surface-variant">{desc}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
