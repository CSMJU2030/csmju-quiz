// src/lib/breadcrumb.ts
// breadcrumb อัตโนมัติจาก route (ui-design-system.md ข้อ 5.1) — ชั่วคราวจนกว่าจะใช้ CsmjuAppShell
// segment ที่เป็น id ใช้ชื่อตามหน้าแม่ · segment ที่ไม่มีหน้าจริง (เช่น /game) แสดงเป็นข้อความไม่มีลิงก์

export interface Crumb {
  label: string;
  /** undefined = หน้าปัจจุบัน หรือ segment ที่ไม่มีหน้าจริง */
  href?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** ชื่อของ segment ตาม path ของหน้าแม่ ("*" = id) */
const LABELS: Record<string, string> = {
  dashboard: "ภาพรวม",
  quiz: "แบบทดสอบของฉัน",
  "quiz/create": "สร้างแบบทดสอบ",
  "quiz/*": "รายละเอียดแบบทดสอบ",
  "quiz/*/edit": "แก้ไข",
  "quiz/*/preview": "ทดลองเล่น",
  "question-bank": "คลังคำถาม",
  reports: "รายงาน",
  "reports/*": "ผลเกม",
  "reports/*/players/*": "คำตอบของผู้เล่น",
  game: "เกม",
  "game/create": "เปิดห้องเล่นเกม",
  "game/join": "เข้าร่วมเกม",
  history: "ประวัติการเล่น",
  "history/*": "ผลการเล่น",
};

/** segment ที่ไม่มีหน้าจริงของตัวเอง — ไม่ทำลิงก์ */
const NO_PAGE = new Set(["game", "reports/*/players"]);

/** ห้องเกม (host/play/leaderboard/podium) เต็มจอ — ไม่แสดง breadcrumb */
/** ห้องเกม และหน้าของผู้เล่นที่ใช้บัตรเข้าห้อง (/play) ไม่มี breadcrumb */
const HIDDEN = /^\/game\/[^/]+\/(host|play|leaderboard|podium)$|^\/play(\/|$)/;

/**
 * @param overrides เปลี่ยนชื่อตาม pattern ของ segment เช่น `{ "quiz/*": "ชื่อแบบทดสอบจริง" }`
 */
export function buildBreadcrumb(pathname: string, overrides: Record<string, string> = {}): Crumb[] {
  const path = pathname.replace(/\/+$/, "") || "/";
  // หน้าแรก และหน้าภาพรวมผู้สอน (หน้าแรกของผู้สอน) ไม่ต้องมี breadcrumb
  if (path === "/" || path === "/dashboard" || HIDDEN.test(path)) return [];

  const segments = path.split("/").filter(Boolean);
  const crumbs: Crumb[] = [{ label: "หน้าแรก", href: "/" }];
  let href = "";
  const pattern: string[] = [];

  segments.forEach((segment, index) => {
    href += `/${segment}`;
    pattern.push(UUID.test(segment) ? "*" : segment);
    const key = pattern.join("/");
    if (NO_PAGE.has(key) && index < segments.length - 1) {
      if (key === "game") crumbs.push({ label: LABELS[key] });
      return; // "players" ไม่ต้องแสดง
    }
    const label = overrides[key] ?? LABELS[key];
    if (!label) return;
    const isLast = index === segments.length - 1;
    crumbs.push(isLast ? { label } : { label, href });
  });

  return crumbs.length > 1 ? crumbs : [];
}
