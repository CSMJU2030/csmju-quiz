// src/components/game/player-avatar.tsx
// โปรไฟล์ผู้เล่น = รูปที่เลือก + ชื่อที่ตั้งเอง (ไม่แสดงชื่อของรูป) — ใช้ token เท่านั้น
// รูปภาพ: 1:1 · next/image (เสิร์ฟ WebP ให้อัตโนมัติ, PNG สำรอง) · ระบุ width/height · รูปประกอบใช้ alt="" (ui-design-system.md ข้อ 12.1, 14, 16.1)
"use client";

import Image from "next/image";
import { AVATAR_IMAGE_SIZE, avatarSrc, isAvatarIndex } from "@/lib/avatars";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "fill";

const BOX: Record<AvatarSize, string> = {
  xs: "h-6 w-6 rounded-md",
  sm: "h-9 w-9 rounded-lg",
  md: "h-11 w-11 rounded-xl",
  lg: "h-14 w-14 rounded-xl",
  xl: "h-16 w-16 rounded-2xl",
  /** เต็มกล่องที่ครอบอยู่ (เช่น ช่องเลือกรูป) */
  fill: "h-full w-full rounded-lg",
};

// มุมด้านในเมื่อมีกรอบ (เล็กกว่ามุมด้านนอกเท่ากับความหนากรอบ) — ให้ขอบรูปชิดกรอบพอดี ไม่มีเส้นพื้นหลังลอด
const INNER: Record<AvatarSize, string> = {
  xs: "rounded",
  sm: "rounded-md",
  md: "rounded-lg",
  lg: "rounded-lg",
  xl: "rounded-xl",
  fill: "rounded-md",
};

const INITIAL_TEXT: Record<AvatarSize, string> = {
  xs: "text-caption",
  sm: "text-label-md",
  md: "text-label-md",
  lg: "text-body-lg",
  xl: "text-headline-md",
  fill: "text-headline-md",
};

function firstChar(nickname: string) {
  return Array.from(nickname.trim())[0]?.toUpperCase() ?? "?";
}

/** รูปโปรไฟล์ — ภาพประกอบล้วน (aria-hidden) ให้ชื่อผู้เล่นที่อยู่ข้าง ๆ เป็นตัวบอกความหมาย */
export function PlayerAvatar({
  avatarIndex,
  nickname = "",
  size = "md",
  highlight = false,
  inverse = false,
  className = "",
}: {
  avatarIndex: number | null | undefined;
  /** ใช้แสดงอักษรย่อเมื่อผู้เล่นยังไม่มีรูป */
  nickname?: string;
  size?: AvatarSize;
  /** เน้นด้วยกรอบ — ใช้กับผู้เล่นที่เป็น "คุณ" หรือรูปที่กำลังเลือก */
  highlight?: boolean;
  /** วางบนพื้นสีเข้ม (เช่น เวทีโพเดียม หรือแถวของตัวเองในตารางอันดับ) */
  inverse?: boolean;
  className?: string;
}) {
  // กรอบทำจากพื้นหลังของกล่องนอก + padding (ไม่ใช้ ring) เพื่อไม่ให้มีเส้นพื้นหลังลอดตรงมุมโค้ง
  const frame = inverse ? "bg-on-primary p-0.5" : highlight ? "bg-primary-container p-0.5" : "";
  const framed = Boolean(frame);

  // ไม่มีรูป → อักษรย่อสีขาวบนพื้น primary-container (ข้อ 14)
  if (!isAvatarIndex(avatarIndex)) {
    return (
      <span
        aria-hidden="true"
        className={`inline-flex shrink-0 ${BOX[size]} ${frame} ${className}`}
      >
        <span
          className={`flex h-full w-full items-center justify-center bg-primary-container font-display text-on-primary ${
            framed ? INNER[size] : ""
          } ${INITIAL_TEXT[size]}`}
        >
          {firstChar(nickname)}
        </span>
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 overflow-hidden ${BOX[size]} ${frame} ${className}`}
    >
      <Image
        src={avatarSrc(avatarIndex, "png")}
        alt=""
        width={AVATAR_IMAGE_SIZE}
        height={AVATAR_IMAGE_SIZE}
        draggable={false}
        className={`block h-full w-full object-cover ${framed ? INNER[size] : ""}`}
      />
    </span>
  );
}

/** รูป + ชื่อผู้เล่น ในบรรทัดเดียว */
export function PlayerIdentity({
  avatarIndex,
  nickname,
  size = "sm",
  isMe = false,
  highlight = false,
  inverse = false,
  nameClassName = "text-label-md text-on-surface",
  className = "",
}: {
  avatarIndex: number | null | undefined;
  nickname: string;
  size?: AvatarSize;
  isMe?: boolean;
  highlight?: boolean;
  inverse?: boolean;
  nameClassName?: string;
  className?: string;
}) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
      <PlayerAvatar
        avatarIndex={avatarIndex}
        nickname={nickname}
        size={size}
        highlight={highlight}
        inverse={inverse}
      />
      <span className={`min-w-0 truncate ${nameClassName}`}>
        {nickname}
        {isMe && <span className="ml-1 font-normal opacity-80">(คุณ)</span>}
      </span>
    </span>
  );
}
