// src/components/game/answer-theme.ts
// ชุดประจำปุ่มตัวเลือกคำตอบ: class สี (จาก answer-colors.module.css) + ไอคอนรูปทรง (จาก icons.tsx)
// ไฟล์นี้ไม่มีค่าสี — สีทั้งหมดอยู่ใน CSS Module ไฟล์เดียว (ui-design-system.md ข้อ 16.2 ห้าม style={{}})
import {
  AnswerCircleIcon,
  AnswerDiamondIcon,
  AnswerSquareIcon,
  AnswerTriangleIcon,
  type IconComponent,
} from "@/components/icons";
import styles from "./answer-colors.module.css";

export interface AnswerTheme {
  /** พื้นสีเต็ม + ตัวอักษรขาว (ปุ่ม · กล่องไอคอน · แท่งกราฟ) */
  fill: string;
  /** แถบสีด้านซ้ายของการ์ด */
  edge: string;
  /** ไอคอนรูปทรง — แสดงทุกครั้งที่มีสี ขนาดอย่างน้อย 24px */
  Icon: IconComponent;
  /** ชื่อสี + รูปทรง สำหรับโปรแกรมอ่านหน้าจอ */
  label: string;
}

const CHOICES = [
  { color: styles.choice0, Icon: AnswerDiamondIcon, label: "สีแดง รูปข้าวหลามตัด" },
  { color: styles.choice1, Icon: AnswerTriangleIcon, label: "สีน้ำเงิน รูปสามเหลี่ยม" },
  { color: styles.choice2, Icon: AnswerSquareIcon, label: "สีเหลืองทอง รูปสี่เหลี่ยม" },
  { color: styles.choice3, Icon: AnswerCircleIcon, label: "สีเขียว รูปวงกลม" },
];

export const ANSWER_THEMES: readonly AnswerTheme[] = CHOICES.map(({ color, Icon, label }) => ({
  fill: `${color} ${styles.fill}`,
  edge: `${color} ${styles.edge}`,
  Icon,
  label,
}));

export function answerTheme(index: number): AnswerTheme {
  const n = ANSWER_THEMES.length;
  return ANSWER_THEMES[((index % n) + n) % n];
}
