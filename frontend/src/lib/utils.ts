export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/** ชื่อประเภทคำถามภาษาไทย (ui-design-system.md ข้อ 11) */
export function getQuestionTypeLabel(type: string) {
  const labels: Record<string, string> = {
    MULTIPLE_CHOICE: "ปรนัย",
    TRUE_FALSE: "ถูก / ผิด",
    TYPE_ANSWER: "พิมพ์คำตอบ",
    PUZZLE: "เรียงลำดับ",
    POLL: "สำรวจความคิดเห็น",
    WORD_CLOUD: "กลุ่มคำ",
  };

  return labels[type] ?? type;
}

/** id ตามสัญญา API — UUID v4 (api-conventions.md ข้อ 6) */
export function newId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // fallback สำหรับเบราว์เซอร์เก่า (RFC 4122 v4)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
