import Link from "next/link";
import { EmptyState } from "@/components/shared/states";
import { secondaryButtonClass } from "@/components/shared/ui";

export default function NotFound() {
  return (
    <EmptyState
      title="ไม่พบข้อมูล"
      description="ไม่พบข้อมูลที่คุณกำลังค้นหา อาจถูกลบไปแล้วหรือลิงก์ไม่ถูกต้อง"
      action={
        <Link href="/" className={secondaryButtonClass}>
          กลับหน้าหลัก
        </Link>
      }
    />
  );
}
