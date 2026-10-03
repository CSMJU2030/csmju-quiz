// src/lib/avatars.ts
// รูปโปรไฟล์ผู้เล่น (รูปสัตว์) — แหล่งเดียวที่ทุกหน้าใช้ร่วมกัน
// ไฟล์รูปอยู่ที่ public/avatars/<id>.png (แสดงผ่าน next/image ซึ่งแปลงเป็น WebP ให้เบราว์เซอร์ที่รองรับ · มี .webp ต้นฉบับเก็บไว้ด้วย) · อัตราส่วน 1:1 ตาม ui-design-system.md ข้อ 14
// รูปทั้งหมดวาดขึ้นใหม่สำหรับโครงการนี้ (งานต้นฉบับ ไม่ได้ใช้ภาพจากแหล่งอื่น)
// `label` ใช้กับโปรแกรมอ่านหน้าจอในหน้าเลือกรูปเท่านั้น — ที่อื่นแสดงแค่รูป + ชื่อที่ผู้เล่นตั้งเอง
// ห้ามสลับลำดับ: ลำดับคือค่า avatarIndex ที่บันทึกกับผู้เล่น (เพิ่มรายการใหม่ต่อท้ายเท่านั้น)

export interface AvatarOption {
  id: string;
  /** คำอธิบายสำหรับโปรแกรมอ่านหน้าจอ */
  label: string;
}

export const AVATARS: readonly AvatarOption[] = [
  { id: "cat", label: "แมว" },
  { id: "bear", label: "หมี" },
  { id: "rabbit", label: "กระต่าย" },
  { id: "fox", label: "จิ้งจอก" },
  { id: "panda", label: "แพนด้า" },
  { id: "owl", label: "นกฮูก" },
  { id: "dog", label: "สุนัข" },
  { id: "pig", label: "หมู" },
  { id: "frog", label: "กบ" },
  { id: "koala", label: "โคอาลา" },
  { id: "tiger", label: "เสือ" },
  { id: "lion", label: "สิงโต" },
  { id: "monkey", label: "ลิง" },
  { id: "penguin", label: "เพนกวิน" },
  { id: "chick", label: "ลูกเจี๊ยบ" },
  { id: "mouse", label: "หนู" },
  { id: "elephant", label: "ช้าง" },
  { id: "cow", label: "วัว" },
  { id: "sheep", label: "แกะ" },
  { id: "raccoon", label: "แรคคูน" },
  { id: "hamster", label: "แฮมสเตอร์" },
  { id: "duck", label: "เป็ด" },
  { id: "dino", label: "ไดโนเสาร์" },
  { id: "whale", label: "วาฬ" },
  { id: "octopus", label: "ปลาหมึก" },
  { id: "turtle", label: "เต่า" },
  { id: "hedgehog", label: "เม่น" },
];

export const AVATAR_COUNT = AVATARS.length;

/** ขนาดไฟล์รูปต้นฉบับ (px) — ใช้เป็น width/height ของ <img> กัน layout shift */
export const AVATAR_IMAGE_SIZE = 128;

export function avatarSrc(index: number, format: "webp" | "png" = "webp"): string {
  return `/avatars/${AVATARS[index].id}.${format}`;
}

export function isAvatarIndex(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < AVATAR_COUNT;
}

/** อ่าน avatarIndex จากข้อมูลผู้เล่น (รองรับชื่อ field เดิม) — ไม่มีหรือผิดรูปแบบ → null */
export function getAvatarIndex(
  player: { avatarIndex?: unknown; avatarId?: unknown; avatar?: unknown } | null | undefined,
): number | null {
  if (!player) return null;
  for (const raw of [player.avatarIndex, player.avatarId, player.avatar]) {
    const n = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
    if (isAvatarIndex(n)) return n;
  }
  return null;
}

export function randomAvatarIndex(): number {
  return Math.floor(Math.random() * AVATAR_COUNT);
}
