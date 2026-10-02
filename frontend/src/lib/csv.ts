// src/lib/csv.ts
// สร้างและดาวน์โหลดไฟล์ CSV (ใส่ BOM ให้ Excel อ่านภาษาไทยถูก)

type Cell = string | number | null | undefined;

function escapeCell(value: Cell) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: Cell[][]): string {
  return rows.map((row) => row.map(escapeCell).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, rows: Cell[][]) {
  const blob = new Blob(["﻿" + toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // ปล่อย URL หลังเบราว์เซอร์เริ่มดาวน์โหลดแล้ว (ถ้าปล่อยทันที ชื่อไฟล์อาจหาย)
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
