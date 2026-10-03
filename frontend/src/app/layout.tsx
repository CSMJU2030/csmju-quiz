import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AppShell } from "@/components/shell/app-shell";
import { CurrentUserProvider } from "@/hooks/use-current-user";
import { SUBSYSTEM_DISPLAY_NAME } from "@/lib/env";

// ui-design-system.md ข้อ 4.1 — self-host ด้วย next/font/local (ห้าม next/font/google)
// ไฟล์ฟอนต์อยู่ใน src/fonts (OFL-1.1 · มาจาก @fontsource 5.3.0) รวม 4 ไฟล์ตามเพดาน
// ฟอนต์ละตินมาก่อน แล้วให้ IBM Plex Sans Thai รับช่วงอักขระไทย · preload เฉพาะไทย 400/600
const plexThai = localFont({
  src: [
    { path: "../fonts/ibm-plex-sans-thai-thai-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/ibm-plex-sans-thai-thai-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-plex-thai",
  display: "swap",
  preload: true,
  declarations: [
    { prop: "unicode-range", value: "U+02D7, U+0303, U+0331, U+0E01-0E5B, U+200C-200D, U+25CC" },
  ],
});

const inter = localFont({
  src: "../fonts/inter-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-inter",
  display: "swap",
  preload: false,
});

const jakarta = localFont({
  src: "../fonts/plus-jakarta-sans-latin-wght-normal.woff2",
  weight: "200 800",
  variable: "--font-jakarta",
  display: "swap",
  preload: false,
});

// ข้อ 11.4 — "<ชื่อหน้า> · <ชื่อระบบย่อย> · CSMJU"
export const metadata: Metadata = {
  title: {
    default: `หน้าแรก · ${SUBSYSTEM_DISPLAY_NAME} · CSMJU`,
    template: `%s · ${SUBSYSTEM_DISPLAY_NAME} · CSMJU`,
  },
  description:
    "ระบบสร้างแบบทดสอบและจัดกิจกรรมตอบคำถาม สาขาวิชาวิทยาการคอมพิวเตอร์ มหาวิทยาลัยแม่โจ้",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="th"
      className={`${inter.variable} ${jakarta.variable} ${plexThai.variable} h-full antialiased`}
    >
      <body className="font-body">
        <CurrentUserProvider>
          <AppShell>{children}</AppShell>
        </CurrentUserProvider>
      </body>
    </html>
  );
}
