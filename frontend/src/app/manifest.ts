import type { MetadataRoute } from "next";

// ชื่อและไอคอนเมื่อผู้ใช้เพิ่มเว็บไว้ที่หน้าจอหลัก / แอปของเบราว์เซอร์ (ไอคอนแท็บคือ src/app/icon.svg)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CSMJU Quiz เกมตอบคำถาม",
    short_name: "CSMJU Quiz",
    description:
      "ระบบสร้างแบบทดสอบและจัดกิจกรรมตอบคำถาม สาขาวิชาวิทยาการคอมพิวเตอร์ มหาวิทยาลัยแม่โจ้",
    start_url: "/",
    display: "standalone",
    lang: "th",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
