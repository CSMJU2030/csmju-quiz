import Link from "next/link";
import { EmptyState } from "@/components/shared/states";
import { secondaryButtonClass } from "@/components/shared/ui";

export default function NotFound() {
  return (
    <EmptyState
      title="ไม่พบห้องเกม"
      description="ห้องอาจถูกปิดไปแล้วหรือลิงก์ไม่ถูกต้อง กรุณาสแกน QR จากจอของผู้สอนอีกครั้ง"
      action={
        <Link href="/play" className={secondaryButtonClass}>
          กรอกรหัสเกม
        </Link>
      }
    />
  );
}
