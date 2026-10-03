// src/app/reports/[sessionId]/players/[playerId]/page.tsx
// host ดูผลและคำตอบรายข้อของผู้เล่นหนึ่งคน (สิทธิ์เดียวกับรายงาน — backend ตรวจว่าเป็น host ของเกม)
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowBackIcon } from "@/components/icons";
import { AnswerReviewList } from "@/components/report/answer-review";
import { ResultSummary } from "@/components/report/result-summary";
import { EmptyState, LoadErrorState, PageHeader, PageSkeleton } from "@/components/shared/states";
import { secondaryButtonClass } from "@/components/shared/ui";
import type { PlayerGameReviewView } from "@/lib/api-types";
import { getPlayerReview } from "@/lib/player-review";

export default function ReportPlayerPage() {
  const { sessionId, playerId } = useParams<{ sessionId: string; playerId: string }>();
  const [result, setResult] = useState<PlayerGameReviewView | null | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getPlayerReview(sessionId, playerId)
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, playerId, attempt]);

  const backLink = (
    <Link href={`/reports/${sessionId}`} className={secondaryButtonClass}>
      <ArrowBackIcon className="h-4 w-4" />
      กลับไปรายงาน
    </Link>
  );

  if (error) {
    return (
      <LoadErrorState
        error={error}
        notFoundTitle="ไม่พบผู้เล่น"
        action={backLink}
        onRetry={() => {
          setError(null);
          setAttempt((n) => n + 1);
        }}
      />
    );
  }
  if (result === undefined) return <PageSkeleton />;
  if (result === null) {
    return (
      <EmptyState
        title="ไม่พบผู้เล่น"
        description="ไม่พบข้อมูลที่คุณกำลังค้นหา อาจถูกลบไปแล้วหรือลิงก์ไม่ถูกต้อง"
        action={backLink}
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader title={`ผลของ ${result.nickname}`} description={result.quizTitle} />
      <ResultSummary result={result} />
      <AnswerReviewList answers={result.answers} selectedLabel="คำตอบของผู้เล่น" />
    </div>
  );
}
