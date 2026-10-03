// src/components/shared/states.tsx
// สถานะหน้าจอมาตรฐาน (ui-design-system.md ข้อ 9) — local component ชั่วคราว
// ประกอบจาก class ใน ui.ts + token เท่านั้น (ข้อ 17.0) จนกว่าจะมี Skeleton/EmptyState/ErrorState ใน "@/csmju"
import Link from "next/link";
import type { ReactNode } from "react";
import { Breadcrumb } from "@/components/shell/breadcrumb";
import { ErrorIcon, InboxIcon, LockIcon, type IconComponent } from "@/components/icons";
import { primaryButtonClass, secondaryButtonClass } from "@/components/shared/ui";
import { ApiError, errorMessage } from "@/lib/api";

/** Skeleton ที่มีรูปร่างใกล้เคียงเนื้อหาจริง (ข้อ 9.1) — ไม่ใช่ spinner กลางจอ */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-surface-variant ${className}`}
    />
  );
}

export function PageSkeleton({ label = "กำลังโหลดข้อมูล..." }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-8">
      <span className="sr-only">{label}</span>
      <div className="space-y-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

interface StateProps {
  title: string;
  description?: string;
  icon?: IconComponent;
  action?: ReactNode;
}

function StateCard({
  title,
  description,
  icon: StateIcon = InboxIcon,
  action,
  tone,
}: StateProps & { tone: "neutral" | "error" }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-6 text-center">
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-full ${
          tone === "error"
            ? "bg-error-container text-on-error-container"
            : "bg-surface-container text-primary-container"
        }`}
      >
        <StateIcon className="h-6 w-6" />
      </span>
      <h2 className="mt-4 font-display text-headline-md text-on-surface">{title}</h2>
      {description && <p className="mt-2 text-body-md text-on-surface-variant">{description}</p>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}

/** EmptyState — ไอคอน + เหตุผลที่ว่าง + ปุ่มทางออก (ข้อ 9.2) */
export function EmptyState(props: StateProps) {
  return <StateCard {...props} tone="neutral" />;
}

/** ErrorState — ห้ามแสดง error.message ดิบ (ข้อ 9.3, 16.1.1) */
export function ErrorState({
  title = "ระบบขัดข้องชั่วคราว",
  description = "ระบบขัดข้องชั่วคราว กรุณาลองอีกครั้ง",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert">
      <StateCard
        tone="error"
        icon={ErrorIcon}
        title={title}
        description={description}
        action={
          onRetry && (
            <button type="button" onClick={onRetry} className={primaryButtonClass}>
              ลองอีกครั้ง
            </button>
          )
        }
      />
    </div>
  );
}

/** FORBIDDEN (403) — ข้อ 9.3 */
export function ForbiddenState() {
  return (
    <StateCard
      tone="neutral"
      icon={LockIcon}
      title="ไม่มีสิทธิ์เข้าถึง"
      description="คุณไม่มีสิทธิ์เข้าถึงส่วนนี้ หากคิดว่าเป็นข้อผิดพลาด กรุณาติดต่อผู้ดูแลระบบย่อยนี้"
      action={
        <Link href="/" className={secondaryButtonClass}>
          กลับหน้าหลัก
        </Link>
      }
    />
  );
}

/**
 * หน้าที่โหลดข้อมูลไม่สำเร็จ — เลือกสถานะตาม error.code (ข้อ 9.3)
 *   FORBIDDEN → ไม่มีสิทธิ์ · NOT_FOUND → ไม่พบข้อมูล (EmptyState) · อื่น ๆ → ErrorState + ปุ่มลองอีกครั้ง
 */
export function LoadErrorState({
  error,
  onRetry,
  notFoundTitle = "ไม่พบข้อมูล",
  notFoundDescription = "ไม่พบข้อมูลที่คุณกำลังค้นหา อาจถูกลบไปแล้วหรือลิงก์ไม่ถูกต้อง",
  action,
}: {
  error: unknown;
  onRetry?: () => void;
  notFoundTitle?: string;
  notFoundDescription?: string;
  /** ปุ่มทางออกของหน้าไม่พบข้อมูล */
  action?: ReactNode;
}) {
  if (error instanceof ApiError && error.code === "FORBIDDEN") return <ForbiddenState />;
  if (error instanceof ApiError && error.code === "NOT_FOUND") {
    return <EmptyState title={notFoundTitle} description={notFoundDescription} action={action} />;
  }
  return <ErrorState description={errorMessage(error)} onRetry={onRetry} />;
}

/** หัวหน้า (ข้อ 5.2) — breadcrumb + h1 หนึ่งตัวต่อหน้า */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="space-y-4 fade-slide-up">
      <Breadcrumb />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-headline-md md:text-headline-lg text-on-surface">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-body-md text-on-surface-variant">{description}</p>
          )}
        </div>
        {action && <div className="flex shrink-0 flex-wrap gap-3">{action}</div>}
      </div>
    </header>
  );
}
