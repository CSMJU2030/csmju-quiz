"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AddIcon, MenuBookIcon, SearchIcon } from "@/components/icons";
import QuizCard from "@/components/quiz/quiz-card";
import { ConfirmDeleteModal } from "@/components/shared/modal";
import { ErrorAlert, SuccessToast } from "@/components/shared/notice";
import { PAGE_SIZE, Pagination } from "@/components/shared/pagination";
import { EmptyState, LoadErrorState, PageHeader, Skeleton } from "@/components/shared/states";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/shared/ui";
import { Can } from "@/hooks/use-current-user";
import { errorMessage, type PageMeta } from "@/lib/api";
import { Permission } from "@/lib/permissions";
import {
  countQuizzes,
  deleteQuiz,
  listQuizPage,
  type QuizListItem,
  type QuizListSort,
  type QuizListStatus,
} from "@/lib/quiz-store";
import { QUIZ_DELETE_CONSEQUENCE } from "@/lib/quiz-status";

type TabStatus = "ALL" | "PUBLISHED" | "DRAFT" | "ARCHIVED";

const TABS: { value: TabStatus; label: string }[] = [
  { value: "ALL", label: "ทั้งหมด" },
  { value: "PUBLISHED", label: "เผยแพร่แล้ว" },
  { value: "DRAFT", label: "แบบร่าง" },
  { value: "ARCHIVED", label: "เก็บถาวร" },
];

/** "ทั้งหมด" ไม่รวมที่เก็บถาวร */
const TAB_FILTER: Record<TabStatus, QuizListStatus> = {
  ALL: "ACTIVE",
  PUBLISHED: "PUBLISHED",
  DRAFT: "DRAFT",
  ARCHIVED: "ARCHIVED",
};

const SEARCH_DELAY_MS = 300;

export default function QuizListPage() {
  const [quizzes, setQuizzes] = useState<QuizListItem[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<unknown>(null);
  const [counts, setCounts] = useState<Record<TabStatus, number> | null>(null);
  const [deletingQuiz, setDeletingQuiz] = useState<QuizListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const clearNotice = useCallback(() => setNotice(""), []);

  const [selectedTab, setSelectedTab] = useState<TabStatus>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<QuizListSort>("updatedAt");
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);

  // หน่วงการค้นหาเล็กน้อย ไม่ยิงคำขอทุกตัวอักษร
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchQuery.trim());
      setPage(1);
    }, SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  // กรอง ค้นหา เรียง และแบ่งหน้าที่ backend (ui-design-system.md ข้อ 8.2)
  useEffect(() => {
    let cancelled = false;
    listQuizPage({
      page,
      limit: PAGE_SIZE,
      status: TAB_FILTER[selectedTab],
      search,
      sort: sortBy,
    })
      .then(({ data, meta: next }) => {
        if (cancelled) return;
        // หน้าที่เลือกเกินจำนวนหน้าจริง (เช่น ลบรายการสุดท้ายของหน้า) → ถอยกลับหน้าสุดท้าย
        if (data.length === 0 && next.page > 1 && next.totalPages > 0) {
          setPage(next.totalPages);
          return;
        }
        setQuizzes(data);
        setMeta(next);
        setState("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err);
        setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [page, selectedTab, search, sortBy, reload]);

  // ตัวเลขบนแท็บ
  useEffect(() => {
    let cancelled = false;
    Promise.all(TABS.map((tab) => countQuizzes(TAB_FILTER[tab.value])))
      .then(([all, published, draft, archived]) => {
        if (!cancelled)
          setCounts({ ALL: all, PUBLISHED: published, DRAFT: draft, ARCHIVED: archived });
      })
      .catch(() => {
        if (!cancelled) setCounts(null);
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const handleDeleteConfirm = async () => {
    // กันกด Enter/คลิกซ้ำระหว่างลบ
    if (!deletingQuiz || isDeleting) return;
    setIsDeleting(true);
    setActionError("");
    try {
      await deleteQuiz(deletingQuiz.id);
      setNotice(`ลบแบบทดสอบ “${deletingQuiz.title || "ไม่มีชื่อ"}” แล้ว`);
      setDeletingQuiz(null);
      setReload((n) => n + 1);
    } catch (err) {
      setDeletingQuiz(null);
      setActionError(`ลบแบบทดสอบไม่สำเร็จ: ${errorMessage(err)}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const hasFilters = search.length > 0 || selectedTab !== "ALL";

  const clearFilters = () => {
    setSearchQuery("");
    setSearch("");
    setSelectedTab("ALL");
    setPage(1);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="แบบทดสอบของฉัน"
        description="จัดการ สร้าง และเผยแพร่ชุดคำถามสำหรับกิจกรรมของคุณ"
        action={
          <Can permission={Permission.QUIZ_MANAGE_OWN}>
            <Link href="/quiz/create" className={primaryButtonClass}>
              <AddIcon className="h-4 w-4" />
              สร้างแบบทดสอบ
            </Link>
          </Can>
        }
      />

      <SuccessToast message={notice} onDone={clearNotice} />
      <ErrorAlert message={actionError} onClose={() => setActionError("")} />

      <section
        aria-label="ตัวกรอง"
        className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest shadow-sm"
      >
        <div
          role="tablist"
          aria-label="สถานะแบบทดสอบ"
          className="relative flex overflow-x-auto border-b border-outline-variant/40 px-2"
        >
          {TABS.map((tab) => {
            const selected = selectedTab === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => {
                  setSelectedTab(tab.value);
                  setPage(1);
                }}
                className={`flex min-h-11 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-label-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-container ${
                  selected
                    ? "border-primary-container text-primary-container"
                    : "border-transparent text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {tab.label}
                <span
                  className={`rounded-full px-2 py-0.5 text-label-sm tabular-nums ${
                    selected
                      ? "bg-primary-container/10 text-primary-container"
                      : "bg-surface-variant text-on-surface-variant"
                  }`}
                >
                  {counts ? counts[tab.value] : "–"}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-end">
          <div className="flex-1 space-y-2">
            <label htmlFor="quiz-search" className={labelClass}>
              ค้นหา
            </label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-outline" />
              <input
                id="quiz-search"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="ชื่อหรือรายละเอียดแบบทดสอบ"
                className={`${inputClass} pl-10`}
              />
            </div>
          </div>
          <div className="space-y-2 lg:w-48">
            <label htmlFor="quiz-sort" className={labelClass}>
              เรียงตาม
            </label>
            <select
              id="quiz-sort"
              value={sortBy}
              onChange={(event) => {
                setSortBy(event.target.value as QuizListSort);
                setPage(1);
              }}
              className={inputClass}
            >
              <option value="updatedAt">แก้ไขล่าสุด</option>
              <option value="createdAt">สร้างล่าสุด</option>
              <option value="title">ชื่อ ก-ฮ</option>
              <option value="questionCount">จำนวนคำถาม</option>
            </select>
          </div>
        </div>
      </section>

      <h2 className="sr-only">รายการแบบทดสอบ</h2>
      {state === "error" ? (
        <LoadErrorState
          error={loadError}
          onRetry={() => {
            setState("loading");
            setLoadError(null);
            setReload((n) => n + 1);
          }}
        />
      ) : state === "loading" ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))] gap-6">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <Skeleton key={item} className="h-52" />
          ))}
        </div>
      ) : quizzes.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={SearchIcon}
            title="ค้นหาแล้วไม่พบแบบทดสอบ"
            description="ลองเปลี่ยนคำค้นหาหรือเลือกสถานะอื่น"
            action={
              <button type="button" onClick={clearFilters} className={secondaryButtonClass}>
                ล้างตัวกรอง
              </button>
            }
          />
        ) : (
          <EmptyState
            icon={MenuBookIcon}
            title="ยังไม่มีแบบทดสอบ"
            description="เริ่มต้นด้วยการสร้างแบบทดสอบชุดแรกของคุณเพื่อใช้ในกิจกรรม"
            action={
              <Can permission={Permission.QUIZ_MANAGE_OWN}>
                <Link href="/quiz/create" className={primaryButtonClass}>
                  <AddIcon className="h-4 w-4" />
                  สร้างแบบทดสอบ
                </Link>
              </Can>
            }
          />
        )
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))] gap-6">
            {quizzes.map((quiz) => (
              <QuizCard key={quiz.id} quiz={quiz} onDelete={() => setDeletingQuiz(quiz)} />
            ))}
          </div>
          {meta && <Pagination meta={meta} onPage={setPage} label="แบบทดสอบ" />}
        </div>
      )}

      <ConfirmDeleteModal
        open={deletingQuiz !== null}
        title="ลบแบบทดสอบ"
        itemName={`“${deletingQuiz?.title || "ไม่มีชื่อ"}”`}
        consequence={QUIZ_DELETE_CONSEQUENCE}
        confirmLabel="ลบแบบทดสอบ"
        busy={isDeleting}
        onCancel={() => setDeletingQuiz(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
