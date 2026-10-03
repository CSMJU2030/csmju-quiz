import { describe, expect, it } from "vitest";
import { buildBreadcrumb } from "@/lib/breadcrumb";

const ID = "3f2b8c1e-8d2a-4b6f-9c1d-2e4f6a8b0c1d";
const P = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

describe("buildBreadcrumb", () => {
  it("หน้าแรก และหน้าภาพรวมผู้สอนไม่มี breadcrumb", () => {
    expect(buildBreadcrumb("/")).toEqual([]);
    expect(buildBreadcrumb("/dashboard")).toEqual([]);
  });

  it("หน้าชั้นเดียว", () => {
    expect(buildBreadcrumb("/reports")).toEqual([
      { label: "หน้าแรก", href: "/" },
      { label: "รายงาน" },
    ]);
  });

  it("id ใช้ชื่อตามหน้าแม่ และหน้าก่อนหน้าเป็นลิงก์", () => {
    expect(buildBreadcrumb(`/quiz/${ID}/edit`)).toEqual([
      { label: "หน้าแรก", href: "/" },
      { label: "แบบทดสอบของฉัน", href: "/quiz" },
      { label: "รายละเอียดแบบทดสอบ", href: `/quiz/${ID}` },
      { label: "แก้ไข" },
    ]);
  });

  it("ข้าม segment ที่ไม่มีหน้า (players) · /game ไม่มีลิงก์", () => {
    expect(buildBreadcrumb(`/reports/${ID}/players/${P}`)).toEqual([
      { label: "หน้าแรก", href: "/" },
      { label: "รายงาน", href: "/reports" },
      { label: "ผลเกม", href: `/reports/${ID}` },
      { label: "คำตอบของผู้เล่น" },
    ]);
    expect(buildBreadcrumb("/game/join")).toEqual([
      { label: "หน้าแรก", href: "/" },
      { label: "เกม" },
      { label: "เข้าร่วมเกม" },
    ]);
  });

  it("ห้องเกมเต็มจอไม่แสดง", () => {
    expect(buildBreadcrumb(`/game/${ID}/play`)).toEqual([]);
    expect(buildBreadcrumb(`/game/${ID}/host`)).toEqual([]);
  });

  it("เปลี่ยนชื่อ segment ด้วย overrides (เช่น ชื่อแบบทดสอบจริง)", () => {
    expect(buildBreadcrumb(`/quiz/${ID}/edit`, { "quiz/*": "ความรู้ทั่วไป" })[2]).toEqual({
      label: "ความรู้ทั่วไป",
      href: `/quiz/${ID}`,
    });
  });

  it("หน้าที่ไม่รู้จักไม่แสดง", () => {
    expect(buildBreadcrumb("/__nope__")).toEqual([]);
  });

  it("หน้าของผู้เล่นที่สแกน QR ไม่มี breadcrumb", () => {
    expect(buildBreadcrumb("/play")).toEqual([]);
    expect(buildBreadcrumb("/play/abc")).toEqual([]);
    expect(buildBreadcrumb("/play/abc/podium")).toEqual([]);
  });
});
