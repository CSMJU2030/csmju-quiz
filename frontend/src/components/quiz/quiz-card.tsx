"use client";

import Link from "next/link";
import {
  DeleteIcon,
  EditIcon,
  ScheduleIcon,
  SportsEsportsIcon,
  WarningIcon,
} from "@/components/icons";
import { StatusBadge } from "@/components/game/ui";
import {
  iconButtonClass,
  iconDangerButtonClass,
  secondaryButtonClass,
  tonalButtonClass,
} from "@/components/shared/ui";
import { formatNumber, formatRelative } from "@/lib/format";
import type { QuizListItem } from "@/lib/quiz-store";
import { estimateMinutes, quizStatus } from "@/lib/quiz-status";

interface QuizCardProps {
  quiz: Pick<
    QuizListItem,
    | "id"
    | "title"
    | "description"
    | "status"
    | "updatedAt"
    | "questionCount"
    | "incompleteCount"
    | "totalTimeLimit"
  >;
  onDelete?: (id: string) => void;
}

export default function QuizCard({ quiz, onDelete }: QuizCardProps) {
  const title = quiz.title || "ไม่มีชื่อแบบทดสอบ";
  const status = quizStatus(quiz);
  const summary = {
    count: quiz.questionCount,
    incomplete: quiz.incompleteCount,
    estimatedMinutes: estimateMinutes(quiz.questionCount, quiz.totalTimeLimit),
  };

  return (
    <article className="flex flex-col justify-between rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-6 transition hover:shadow-sm">
      <div>
        <div className="flex items-center justify-between gap-2">
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          <span className="text-label-sm text-secondary tabular-nums">
            {formatNumber(summary.count)} คำถาม
          </span>
        </div>

        <h3 className="mt-4 line-clamp-1 text-body-lg font-semibold text-on-surface">
          <Link
            href={`/quiz/${quiz.id}`}
            className="rounded-sm hover:text-primary-container focus-visible:outline-2 focus-visible:outline-primary-container"
          >
            {title}
          </Link>
        </h3>
        <p className="mt-1 line-clamp-2 text-body-md text-on-surface-variant">
          {quiz.description || "ไม่มีรายละเอียด"}
        </p>
        <p className="mt-3 flex flex-wrap items-center gap-3 text-label-sm text-on-surface-variant tabular-nums">
          <span className="inline-flex items-center gap-1">
            <ScheduleIcon className="h-4 w-4" />~{formatNumber(summary.estimatedMinutes)} นาที
          </span>
          <span>แก้ไข {formatRelative(quiz.updatedAt)}</span>
          {summary.incomplete > 0 && (
            <span className="inline-flex items-center gap-1 text-on-surface">
              <WarningIcon className="h-4 w-4 text-brand-amber" />
              ไม่ครบ {formatNumber(summary.incomplete)} ข้อ
            </span>
          )}
        </p>
      </div>

      <div className="mt-6 flex items-center justify-between gap-2 border-t border-outline-variant/40 pt-4">
        <div className="flex items-center gap-1">
          <Link
            href={`/quiz/${quiz.id}/edit`}
            className={iconButtonClass}
            aria-label={`แก้ไขคำถาม ${title}`}
          >
            <EditIcon className="h-5 w-5" />
          </Link>
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(quiz.id)}
              className={iconDangerButtonClass}
              aria-label={`ลบ ${title}`}
            >
              <DeleteIcon className="h-5 w-5" />
            </button>
          )}
        </div>

        {quiz.status === "PUBLISHED" ? (
          <Link
            href={`/game/create?quiz=${quiz.id}`}
            className={tonalButtonClass}
            aria-label={`เปิดห้องเล่นเกม ${title}`}
          >
            <SportsEsportsIcon className="h-4 w-4" />
            เล่น
          </Link>
        ) : (
          <Link href={`/quiz/${quiz.id}`} className={secondaryButtonClass}>
            ดูรายละเอียด
          </Link>
        )}
      </div>
    </article>
  );
}
