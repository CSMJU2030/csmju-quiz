import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { AVATARS, AVATAR_COUNT, avatarSrc, getAvatarIndex, isAvatarIndex } from "@/lib/avatars";

describe("avatars", () => {
  it("id ไม่ซ้ำกัน และมีไฟล์รูปครบทั้ง webp และ png", () => {
    expect(new Set(AVATARS.map((a) => a.id)).size).toBe(AVATAR_COUNT);
    for (let i = 0; i < AVATAR_COUNT; i++) {
      for (const format of ["webp", "png"] as const) {
        expect(existsSync(join(process.cwd(), "public", avatarSrc(i, format)))).toBe(true);
      }
    }
  });

  it("มีรูปเหรียญอันดับ 1-3 ครบทั้ง webp และ png", () => {
    for (const place of [1, 2, 3]) {
      for (const format of ["webp", "png"]) {
        expect(
          existsSync(join(process.cwd(), "public", "medals", `medal-${place}.${format}`)),
        ).toBe(true);
      }
    }
  });

  it("อ่าน avatarIndex จาก field ใหม่และ field เดิม", () => {
    expect(getAvatarIndex({ avatarIndex: 3 })).toBe(3);
    expect(getAvatarIndex({ avatarId: 5 })).toBe(5);
    expect(getAvatarIndex({ avatar: "7" })).toBe(7);
  });

  it("ค่าที่ไม่ถูกต้องคืน null", () => {
    expect(getAvatarIndex(null)).toBeNull();
    expect(getAvatarIndex({})).toBeNull();
    expect(getAvatarIndex({ avatarIndex: -1 })).toBeNull();
    expect(getAvatarIndex({ avatarIndex: AVATAR_COUNT })).toBeNull();
    expect(getAvatarIndex({ avatarIndex: 1.5 })).toBeNull();
    expect(isAvatarIndex(0)).toBe(true);
  });
});
