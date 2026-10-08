// src/components/quiz/quiz-workspace-header.tsx
// หัวของพื้นที่ทำงานแบบทดสอบ — ใช้ร่วมกันในหน้า ภาพรวม / คำถาม / ทดลองเล่น
// มี h1 หนึ่งตัวต่อหน้า (ui-design-system.md ข้อ 5.2) และแท็บเป็นลิงก์ (aria-current)
"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { EditIcon, PlayArrowIcon, VisibilityIcon } from "@/components/icons";
import { StatusBadge } from "@/components/game/ui";
import { quizStatus } from "@/lib/quiz-status";
import type { Quiz } from "@/types/quiz";
import { Breadcrumb } from "@/components/shell/breadcrumb";

export type WorkspaceTab = "overview" | "questions" | "preview";

const TABS: {
  key: WorkspaceTab;
  label: string;
  href: (id: string) => string;
  icon: typeof EditIcon;
}[] = [
  { key: "overview", label: "ภาพรวม", href: (id) => `/quiz/${id}`, icon: VisibilityIcon },
  { key: "questions", label: "คำถาม", href: (id) => `/quiz/${id}/edit`, icon: EditIcon },
  { key: "preview", label: "ทดลองเล่น", href: (id) => `/quiz/${id}/preview`, icon: PlayArrowIcon },
];

export function QuizWorkspaceHeader({
  quiz,
  active,
  title,
  subtitle,
  actions,
  onNavigate,
}: {
  quiz: Quiz;
  active: WorkspaceTab;
  /** ชื่อที่แสดง (เช่น ชื่อที่กำลังแก้ยังไม่บันทึก) — ค่าเริ่มต้นคือ quiz.title */
  title?: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** เรียกก่อนเปลี่ยนแท็บ คืน false เพื่อยกเลิก (เช่น มีการแก้ที่ยังไม่บันทึก) */
  onNavigate?: (href: string) => boolean;
}) {
  const status = quizStatus(quiz);
  const shownTitle = (title ?? quiz.title)?.trim() || "แบบทดสอบไม่มีชื่อ";

  return (
    <header className="space-y-4 fade-slide-up">
      <Breadcrumb overrides={{ "quiz/*": shownTitle }} />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-headline-md text-on-surface md:text-headline-lg wrap-break-word">
              {shownTitle}
            </h1>
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          </div>
          {subtitle && <div className="mt-1 text-body-md text-on-surface-variant">{subtitle}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}
      </div>

      <nav aria-label="ส่วนของแบบทดสอบ" className="border-b border-outline-variant/60">
        <ul className="relative -mb-px flex gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const current = tab.key === active;
            const href = tab.href(quiz.id);
            const Icon = tab.icon;
            return (
              <li key={tab.key}>
                <Link
                  href={href}
                  aria-current={current ? "page" : undefined}
                  onClick={(e) => {
                    if (!current && onNavigate && !onNavigate(href)) e.preventDefault();
                  }}
                  className={`inline-flex min-h-11 items-center gap-2 whitespace-nowrap border-b-2 px-4 text-label-md transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-container ${
                    current
                      ? "border-primary-container text-primary-container"
                      : "border-transparent text-on-surface-variant hover:border-outline-variant hover:text-on-surface"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
