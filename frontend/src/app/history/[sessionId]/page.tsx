// src/app/history/[sessionId]/page.tsx
// ผลของฉันในเกมหนึ่ง + ทบทวนคำตอบรายข้อ (เปิดได้เฉพาะเกมที่ตัวเองเล่น — backend ตรวจ ownership)
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
import { getMyGame } from "@/lib/player-review";

const backLink = (
  <Link href="/history" className={secondaryButtonClass}>
    <ArrowBackIcon className="h-4 w-4" />
    กลับไปประวัติการเล่น
  </Link>
);

export default function MyGamePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [result, setResult] = useState<PlayerGameReviewView | null | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getMyGame(sessionId)
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, attempt]);

  if (error) {
    return (
      <LoadErrorState
        error={error}
        notFoundTitle="ไม่พบผลการเล่น"
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
        title="ไม่พบผลการเล่น"
        description="ไม่พบเกมนี้ในประวัติของคุณ เกมอาจถูกลบโดยผู้ดำเนินเกม หรือคุณไม่ได้เข้าร่วมเกมนี้"
        action={backLink}
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader title={result.quizTitle} description="ผลการเล่นของคุณ" />
      <ResultSummary result={result} />
      <AnswerReviewList answers={result.answers} />
    </div>
  );
}
