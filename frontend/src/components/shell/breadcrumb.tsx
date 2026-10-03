// src/components/shell/breadcrumb.tsx
// breadcrumb อัตโนมัติจาก route (ui-design-system.md ข้อ 5.1)
// วางไว้ในหัวของแต่ละหน้า (PageHeader / QuizWorkspaceHeader) เพื่อให้ชิดแนวเดียวกับเนื้อหาเสมอ
// ไม่ว่าหน้านั้นจะกว้างเต็มหรือแคบกึ่งกลาง
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRightIcon } from "@/components/icons";
import { buildBreadcrumb } from "@/lib/breadcrumb";

export function Breadcrumb({ overrides }: { overrides?: Record<string, string> }) {
  const pathname = usePathname();
  const crumbs = buildBreadcrumb(pathname, overrides);
  if (crumbs.length === 0) return null;
  return (
    <nav aria-label="เส้นทาง">
      <ol className="flex flex-wrap items-center gap-x-2 text-body-md text-on-surface-variant">
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-2">
              {i > 0 && <ChevronRightIcon className="h-5 w-5 shrink-0 text-outline" />}
              {c.href ? (
                <Link
                  href={c.href}
                  className="inline-flex min-h-11 items-center rounded-sm hover:text-primary-container hover:underline focus-visible:outline-2 focus-visible:outline-primary-container"
                >
                  {c.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={isLast ? "max-w-[40ch] truncate text-on-surface" : undefined}
                >
                  {c.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
