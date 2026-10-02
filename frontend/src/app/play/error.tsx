"use client";

import { ErrorState } from "@/components/shared/states";

// Next.js 16 ใช้ retry แทน reset · ห้ามแสดง error.message ดิบ (ui-design-system.md ข้อ 16.1.1)
export default function Error({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <ErrorState onRetry={() => retry()} />;
}
