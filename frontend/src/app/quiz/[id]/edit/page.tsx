"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  AddIcon,
  ArrowDownwardIcon,
  ArrowUpwardIcon,
  ContentCopyIcon,
  DatabaseIcon,
  DeleteIcon,
  ErrorIcon,
  HubIcon,
  QuizIcon,
} from "@/components/icons";
import { StatusBadge } from "@/components/game/ui";
import { BankPickerModal } from "@/components/quiz/bank-picker-modal";
import { QuestionEditor } from "@/components/quiz/question-editor";
import { FormField, RequiredNote } from "@/components/shared/form-field";
import { ConfirmDeleteModal, Modal } from "@/components/shared/modal";
import { OverflowMenu } from "@/components/shared/overflow-menu";
import { QuizWorkspaceHeader } from "@/components/quiz/quiz-workspace-header";
import { EmptyState, LoadErrorState, PageSkeleton } from "@/components/shared/states";
import {
  cardClass,
  iconButtonClass,
  iconDangerButtonClass,
  inputClass,
  primaryButtonClass,
  tonalButtonClass,
  secondaryButtonClass,
  dangerButtonClass,
} from "@/components/shared/ui";
import { charCountHint, formatTime } from "@/lib/format";
import { ApiError, errorMessage, setUnsavedWork } from "@/lib/api";
import { bankItemsToQuestions, saveQuestionToBank, type BankItem } from "@/lib/question-bank";
import { cloneContent, createQuestion, issueList, normalizeContent } from "@/lib/question-model";
import { createDraftQuiz, getQuizById, saveQuiz } from "@/lib/quiz-store";
import { newId } from "@/lib/utils";
import type { Question, Quiz } from "@/types/quiz";
import { ErrorAlert, ReloginNotice, SuccessToast } from "@/components/shared/notice";

type LoadState = "loading" | "ready" | "not-found" | "error";

const MAX_TITLE = 150;
const MAX_DESCRIPTION = 500;

const snapshot = (title: string, description: string, questions: Question[]) =>
  JSON.stringify({ title, description, questions });

const isUnauthorized = (err: unknown) => err instanceof ApiError && err.code === "UNAUTHORIZED";

const renumber = (items: Question[]) => items.map((q, i) => ({ ...q, order: i + 1 }));

export default function EditQuizPage() {
  const params = useParams();
  const router = useRouter();
  const quizId = Array.isArray(params?.id) ? params.id[0] : ((params?.id as string) ?? "");

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [baseline, setBaseline] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  /** โหมดที่ตรวจล่าสุด — ตั้งค่าแล้วรายการข้อผิดพลาดจะคำนวณใหม่ทุกครั้งที่แก้ (หายเองเมื่อแก้ครบ) */
  const [checkMode, setCheckMode] = useState<"draft" | "publish" | null>(null);
  const [saveError, setSaveError] = useState("");
  const showErrors = checkMode !== null;
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deleting, setDeleting] = useState<Question | null>(null);
  const [toast, setToast] = useState("");
  const [actionError, setActionError] = useState("");
  /** API ตอบ 401 ขณะมีงานค้าง — ไม่พาไป SSO ทับ แสดงปุ่ม "เข้าสู่ระบบอีกครั้ง" แทน */
  const [sessionExpired, setSessionExpired] = useState(false);
  const [titleTouched, setTitleTouched] = useState(false);
  const clearToast = useCallback(() => setToast(""), []);
  /** ลิงก์ที่ผู้ใช้กดไปขณะยังมีการแก้ที่ไม่ได้บันทึก */
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  /** id ของคำถามที่ติ๊กเลือกไว้ (ลบหลายข้อพร้อมกัน) */
  const [picked, setPicked] = useState<string[]>([]);
  const [confirmBulk, setConfirmBulk] = useState(false);
  /** เพิ่มเมื่อยกเลิกการแก้ไข — ให้ตัวแก้ไขแต่ละข้อเริ่มใหม่จากค่าที่บันทึกไว้ */
  const [revision, setRevision] = useState(0);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const applyQuiz = useCallback((data: Quiz) => {
    const safeQuestions = Array.isArray(data?.questions) ? data.questions : [];
    setQuiz({ ...data, questions: safeQuestions });
    setTitle(data.title ?? "");
    setDescription(data.description ?? "");
    setQuestions(safeQuestions);
    setBaseline(snapshot(data.title ?? "", data.description ?? "", safeQuestions));
    setLoadState("ready");
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (quizId === "new") {
        if (!cancelled) applyQuiz(createDraftQuiz());
        return;
      }
      try {
        const found = quizId ? await getQuizById(quizId) : null;
        if (cancelled) return;
        if (!found) setLoadState("not-found");
        else applyQuiz(found);
      } catch (err) {
        // 403 / 500 / เครือข่าย — ไม่ปล่อยให้ skeleton ค้าง (ui-design-system.md ข้อ 9.3)
        if (cancelled) return;
        setLoadError(err);
        setLoadState("error");
      }
    }
    const t = window.setTimeout(() => void load(), 0);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [quizId, applyQuiz, reloadKey]);

  const retryLoad = useCallback(() => {
    setLoadError(null);
    setLoadState("loading");
    setReloadKey((k) => k + 1);
  }, []);

  // เปิดจากลิงก์ "แก้ไขข้อที่ n" (#q-<id>) → เลื่อนไปที่ข้อนั้น
  useEffect(() => {
    if (loadState !== "ready" || !window.location.hash) return;
    const t = window.setTimeout(() => {
      document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: "start" });
    }, 100);
    return () => window.clearTimeout(t);
  }, [loadState]);

  const isDirty = useMemo(
    () => loadState === "ready" && snapshot(title, description, questions) !== baseline,
    [loadState, title, description, questions, baseline],
  );

  // เตือนเมื่อจะออกจากหน้าโดยยังไม่บันทึก (ui-design-system.md ข้อ 8.1)
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  // มีงานค้าง → 401 ไม่พาทั้งหน้าไป /auth/login (auth-contract ข้อ 7) · ออกจากหน้าแล้วกลับเป็นปกติ
  useEffect(() => {
    setUnsavedWork(isDirty);
    return () => setUnsavedWork(false);
  }, [isDirty]);

  // ลิงก์ภายในแอปทุกตัว (breadcrumb, เมนูข้าง ฯลฯ) — ดักก่อน Next.js เปลี่ยนหน้า แล้วถามยืนยัน
  // ใช้ capture phase เพื่อให้ทำงานก่อน onClick ของ <Link> · แท็บของพื้นที่ทำงานจัดการเองผ่าน onNavigate
  useEffect(() => {
    if (!isDirty) return;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // ลิงก์ในหน้าเดียวกัน (#q-…) ไม่ต้องถาม
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setPendingHref(url.pathname + url.search + url.hash);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [isDirty]);

  const incompleteCount = questions.filter((q) => issueList(q).length > 0).length;

  /* ─────────── จัดการคำถาม ─────────── */

  function addQuestion() {
    if (!quiz) return;
    const q = createQuestion(quiz.id, questions.length + 1);
    setQuestions((current) => [...current, q]);
    focusQuestion(q.id);
  }

  function addFromBank(items: BankItem[]) {
    if (!quiz || items.length === 0) return;
    const copies = bankItemsToQuestions(items, quiz.id, questions.length + 1);
    setQuestions((current) => renumber([...current, ...copies]));
    setPickerOpen(false);
    setToast(`เพิ่ม ${copies.length} คำถามจากคลังแล้ว อย่าลืมบันทึก`);
    if (copies[0]) focusQuestion(copies[0].id);
  }

  function duplicate(index: number) {
    setQuestions((current) => {
      const source = current[index];
      if (!source) return current;
      const copy: Question = {
        ...source,
        ...cloneContent(source),
        id: newId(),
        sourceBankItemId: undefined,
      };
      const next = [...current];
      next.splice(index + 1, 0, copy);
      return renumber(next);
    });
  }

  function update(updated: Question) {
    setQuestions((current) => current.map((q) => (q.id === updated.id ? updated : q)));
  }

  function remove(id: string) {
    setQuestions((current) => renumber(current.filter((q) => q.id !== id)));
    setPicked((cur) => cur.filter((x) => x !== id));
  }

  function move(index: number, direction: -1 | 1) {
    setQuestions((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return renumber(next);
    });
  }

  async function toBank(question: Question) {
    setActionError("");
    if (issueList(question).length > 0) {
      setActionError("คำถามข้อนี้ยังกรอกไม่ครบ กรุณากรอกให้ครบก่อนบันทึกเข้าคลัง");
      return;
    }
    try {
      const item = await saveQuestionToBank(normalizeContent(question));
      update({ ...question, sourceBankItemId: item.id });
      setToast("บันทึกคำถามเข้าคลังแล้ว อย่าลืมบันทึกแบบทดสอบ");
    } catch (err) {
      if (isUnauthorized(err)) setSessionExpired(true);
      else setActionError(`บันทึกเข้าคลังไม่สำเร็จ: ${errorMessage(err)}`);
    }
  }

  function focusQuestion(id: string) {
    window.setTimeout(() => {
      const el = document.getElementById(`q-${id}`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      el?.querySelector<HTMLTextAreaElement>("textarea")?.focus({ preventScroll: true });
    }, 50);
  }

  /* ─────────── ตรวจและบันทึก ─────────── */

  function focusField(id: string | undefined) {
    const target = id ? document.getElementById(id) : document.getElementById("edit-errors");
    if (!target) return;
    target.scrollIntoView({ block: "center" });
    const control =
      target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
        ? target
        : target.querySelector<HTMLElement>("input, textarea, select, button");
    (control ?? target).focus();
  }

  function collectErrors(forPublish: boolean) {
    const list: { id?: string; message: string }[] = [];
    if (!title.trim()) list.push({ id: "edit-title", message: "กรุณากรอกชื่อแบบทดสอบ" });
    if (!forPublish) return list;
    if (questions.length === 0) list.push({ message: "เพิ่มคำถามอย่างน้อย 1 ข้อก่อนเผยแพร่" });
    questions.forEach((q, i) => {
      const issues = issueList(q);
      if (issues.length)
        list.push({ id: `q-${q.id}`, message: `ข้อที่ ${i + 1}: ${issues.join(" · ")}` });
    });
    return list;
  }

  const errors = [
    ...(checkMode ? collectErrors(checkMode === "publish") : []),
    ...(saveError ? [{ message: saveError }] : []),
  ];

  async function handleSave(mode: "draft" | "publish" | "preview", thenGo?: string) {
    if (isSaving || !quiz) return;
    setSaveError("");
    // แบบทดสอบที่เผยแพร่แล้วต้องครบเสมอ (ห้องเกมเปิดได้ทันที)
    const strict = mode !== "draft" || quiz.status === "PUBLISHED";
    const found = collectErrors(strict);
    if (found.length) {
      setCheckMode(strict ? "publish" : "draft");
      setTitleTouched(true);
      // เลื่อนไปและ focus ช่องที่ผิดช่องแรก · สรุปจำนวนจุดที่ต้องแก้อ่านออกเสียงผ่าน role="alert" (ข้อ 8.1)
      window.setTimeout(() => focusField(found.find((f) => f.id)?.id), 0);
      return;
    }

    setIsSaving(true);
    setSessionExpired(false);
    try {
      const saved = await saveQuiz({
        ...quiz,
        title: title.trim(),
        description: description.trim(),
        status: mode === "publish" ? "PUBLISHED" : quiz.status,
        questions: renumber(questions.map((q) => normalizeContent(q))),
        updatedAt: new Date().toISOString(),
      });
      applyQuiz(saved);
      setSavedAt(formatTime(new Date()));
      // แบบทดสอบใหม่ (/quiz/new/edit) ได้ id จาก backend แล้ว → ให้ URL ชี้ชุดที่บันทึก
      if (!quiz.id && !thenGo && mode === "draft") router.replace(`/quiz/${saved.id}/edit`);
      setCheckMode(null);
      if (thenGo) router.push(thenGo);
      else if (mode === "publish") router.push(`/quiz/${saved.id}`);
      else if (mode === "preview") router.push(`/quiz/${saved.id}/preview`);
      else setToast(quiz.status === "PUBLISHED" ? "บันทึกการเปลี่ยนแปลงแล้ว" : "บันทึกแบบร่างแล้ว");
    } catch (err) {
      console.error("Failed to save quiz:", err);
      if (isUnauthorized(err)) setSessionExpired(true);
      else setSaveError(`บันทึกไม่สำเร็จ: ${errorMessage(err)}`);
    } finally {
      setIsSaving(false);
    }
  }

  if (loadState === "loading") return <PageSkeleton />;

  if (loadState === "error") {
    return (
      <LoadErrorState
        error={loadError}
        onRetry={retryLoad}
        notFoundTitle="ไม่พบแบบทดสอบ"
        action={
          <Link href="/quiz" className={secondaryButtonClass}>
            กลับไปแบบทดสอบของฉัน
          </Link>
        }
      />
    );
  }

  if (loadState === "not-found" || !quiz) {
    return (
      <EmptyState
        icon={QuizIcon}
        title="ไม่พบแบบทดสอบ"
        description="ไม่พบข้อมูลที่คุณกำลังค้นหา อาจถูกลบไปแล้วหรือลิงก์ไม่ถูกต้อง"
        action={
          <Link href="/quiz" className={secondaryButtonClass}>
            กลับไปแบบทดสอบของฉัน
          </Link>
        }
      />
    );
  }

  const saveStatus = isDirty
    ? "มีการแก้ไขที่ยังไม่ได้บันทึก"
    : savedAt
      ? `บันทึกล่าสุด ${savedAt}`
      : "ยังไม่มีการแก้ไข";

  const addButtons = (
    <div className="flex flex-wrap gap-3">
      <button type="button" onClick={() => setPickerOpen(true)} className={secondaryButtonClass}>
        <HubIcon className="h-4 w-4" />
        เพิ่มจากคลัง
      </button>
      <button type="button" onClick={addQuestion} className={tonalButtonClass}>
        <AddIcon className="h-4 w-4" />
        เพิ่มคำถาม
      </button>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <QuizWorkspaceHeader
        quiz={quiz}
        active="questions"
        title={title}
        subtitle={
          <span role="status" className={isDirty ? "font-semibold text-on-surface" : undefined}>
            {saveStatus}
          </span>
        }
        onNavigate={(href) => {
          if (!isDirty) return true;
          setPendingHref(href);
          return false;
        }}
        actions={
          <>
            <button
              type="button"
              onClick={() => handleSave("draft")}
              disabled={isSaving || !isDirty}
              aria-describedby={!isDirty ? "save-disabled-reason" : undefined}
              className={secondaryButtonClass}
            >
              {quiz.status === "PUBLISHED" ? "บันทึก" : "บันทึกแบบร่าง"}
            </button>
            {quiz.status !== "PUBLISHED" && (
              <button
                type="button"
                onClick={() => handleSave("publish")}
                disabled={isSaving}
                aria-busy={isSaving}
                className={`${primaryButtonClass} ${isSaving ? "btn-loading" : ""}`}
              >
                <span className="btn-text">บันทึกและเผยแพร่</span>
                <span className="dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              </button>
            )}
          </>
        }
      />
      {!isDirty && (
        <p id="save-disabled-reason" className="sr-only">
          ปุ่มบันทึกแบบร่างใช้ได้เมื่อมีการแก้ไข
        </p>
      )}
      {/* เหตุผลของปุ่มที่กดไม่ได้ (ui-design-system.md ข้อ 7 — disabled ต้องมีเหตุผลกำกับ) */}
      <p id="move-up-disabled-reason" className="sr-only">
        ข้อนี้อยู่บนสุดแล้ว
      </p>
      <p id="move-down-disabled-reason" className="sr-only">
        ข้อนี้อยู่ล่างสุดแล้ว
      </p>

      {sessionExpired && <ReloginNotice onClose={() => setSessionExpired(false)} />}
      <ErrorAlert message={actionError} onClose={() => setActionError("")} />

      {errors.length > 0 && (
        <div
          id="edit-errors"
          role="alert"
          tabIndex={-1}
          className="space-y-2 rounded-lg bg-error-container px-4 py-3 text-body-md text-on-error-container"
        >
          <p className="flex items-center gap-2 font-medium">
            <ErrorIcon className="h-5 w-5 shrink-0" />
            {errors.length === 1
              ? "ยังบันทึกไม่ได้"
              : `ยังบันทึกไม่ได้ ต้องแก้ ${errors.length} จุด`}
          </p>
          <ul className="list-disc space-y-1 pl-10">
            {errors.map((e) => (
              <li key={e.message}>
                {e.id ? (
                  <a href={`#${e.id}`} className="underline underline-offset-2">
                    {e.message}
                  </a>
                ) : (
                  e.message
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <section aria-labelledby="quiz-basic" className={`${cardClass} space-y-4 p-6`}>
        <h2 id="quiz-basic" className="font-display text-headline-md text-on-surface">
          ข้อมูลแบบทดสอบ
        </h2>
        <RequiredNote />
        <FormField
          id="edit-title"
          label="ชื่อแบบทดสอบ"
          required
          hint={charCountHint(title.length, MAX_TITLE)}
          error={
            (showErrors || titleTouched) && !title.trim() ? "กรุณากรอกชื่อแบบทดสอบ" : undefined
          }
        >
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => setTitleTouched(true)}
            maxLength={MAX_TITLE}
            className={inputClass}
          />
        </FormField>
        <FormField
          id="edit-description"
          label="คำอธิบาย (ไม่บังคับ)"
          hint={charCountHint(description.length, MAX_DESCRIPTION)}
        >
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={MAX_DESCRIPTION}
            className={`${inputClass} resize-none`}
          />
        </FormField>
      </section>

      <section aria-labelledby="quiz-question-list" className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 id="quiz-question-list" className="font-display text-headline-md text-on-surface">
              คำถาม <span className="tabular-nums">({questions.length})</span>
            </h2>
            <p className="text-body-md text-on-surface-variant">
              {incompleteCount > 0
                ? `มี ${incompleteCount} ข้อที่ยังไม่ครบ ต้องแก้ก่อนเผยแพร่ (บันทึกแบบร่างได้)`
                : "สร้างใหม่ หรือดึงคำถามที่เคยใช้จากคลัง"}
            </p>
          </div>
          {questions.length > 0 && addButtons}
        </div>

        {questions.length === 0 ? (
          <EmptyState
            icon={QuizIcon}
            title="ยังไม่มีคำถาม"
            description="เพิ่มคำถามข้อแรก หรือเลือกคำถามที่มีอยู่แล้วจากคลังคำถาม"
            action={addButtons}
          />
        ) : (
          <ol className="space-y-6">
            {questions.map((question, index) => {
              const issues = issueList(question);
              return (
                <li key={`${question.id}-${revision}`}>
                  <article
                    id={`q-${question.id}`}
                    aria-labelledby={`q-${question.id}-title`}
                    className={`${cardClass} scroll-mt-24 ${
                      showErrors && issues.length ? "border-error" : ""
                    }`}
                  >
                    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/40 px-6 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="-ml-2 flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg has-focus-visible:outline-2 has-focus-visible:outline-accent">
                          <input
                            type="checkbox"
                            checked={picked.includes(question.id)}
                            onChange={(e) =>
                              setPicked((cur) =>
                                e.target.checked
                                  ? [...cur, question.id]
                                  : cur.filter((id) => id !== question.id),
                              )
                            }
                            aria-label={`เลือกข้อที่ ${index + 1}`}
                            className="h-5 w-5 accent-primary"
                          />
                        </label>
                        <h3
                          id={`q-${question.id}-title`}
                          className="font-display text-body-lg font-semibold text-on-surface"
                        >
                          ข้อที่ {index + 1}
                        </h3>
                        {question.sourceBankItemId && (
                          <StatusBadge tone="neutral">มาจากคลัง</StatusBadge>
                        )}
                        {issues.length > 0 && <StatusBadge tone="warning">ยังไม่ครบ</StatusBadge>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => move(index, -1)}
                          disabled={index === 0}
                          aria-describedby={index === 0 ? "move-up-disabled-reason" : undefined}
                          aria-label={`เลื่อนข้อที่ ${index + 1} ขึ้น`}
                          className={iconButtonClass}
                        >
                          <ArrowUpwardIcon className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => move(index, 1)}
                          disabled={index === questions.length - 1}
                          aria-describedby={
                            index === questions.length - 1 ? "move-down-disabled-reason" : undefined
                          }
                          aria-label={`เลื่อนข้อที่ ${index + 1} ลง`}
                          className={iconButtonClass}
                        >
                          <ArrowDownwardIcon className="h-5 w-5" />
                        </button>
                        <OverflowMenu
                          label={`คำสั่งเพิ่มเติมของข้อที่ ${index + 1}`}
                          items={[
                            {
                              label: "ทำสำเนาข้อนี้",
                              icon: <ContentCopyIcon className="h-5 w-5" />,
                              onSelect: () => duplicate(index),
                            },
                            ...(question.sourceBankItemId
                              ? []
                              : [
                                  {
                                    label: "บันทึกเข้าคลังคำถาม",
                                    icon: <DatabaseIcon className="h-5 w-5" />,
                                    onSelect: () => void toBank(question),
                                    disabled: issues.length > 0,
                                    hint: issues.length > 0 ? "กรอกคำถามให้ครบก่อน" : undefined,
                                  },
                                ]),
                          ]}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            question.prompt.trim() ? setDeleting(question) : remove(question.id)
                          }
                          aria-label={`ลบข้อที่ ${index + 1}`}
                          className={iconDangerButtonClass}
                        >
                          <DeleteIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </header>
                    <div className="p-6">
                      <QuestionEditor
                        idPrefix={`q-${question.id}`}
                        value={question}
                        onChange={update}
                        showHints={index === 0}
                        showErrors={showErrors}
                      />
                    </div>
                  </article>
                </li>
              );
            })}
          </ol>
        )}

        {questions.length > 0 && <div className="flex justify-center">{addButtons}</div>}
      </section>

      {pickerOpen && (
        <BankPickerModal
          open
          alreadyUsedIds={questions.map((q) => q.sourceBankItemId).filter((x): x is string => !!x)}
          onClose={() => setPickerOpen(false)}
          onConfirm={addFromBank}
        />
      )}

      <ConfirmDeleteModal
        open={deleting !== null}
        title="ลบคำถาม"
        itemName={`“${deleting?.prompt ?? ""}”`}
        consequence="จะถูกลบออกจากแบบทดสอบนี้ (คำถามในคลังไม่ได้รับผลกระทบ) ยกเลิกได้โดยไม่บันทึกหน้านี้"
        confirmLabel="ลบคำถาม"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) remove(deleting.id);
          setDeleting(null);
        }}
      />

      {picked.length > 0 ? (
        <div
          role="region"
          aria-label="การกระทำกับคำถามที่เลือก"
          className="sticky bottom-4 z-20 mx-auto flex max-w-xl flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-3 shadow-md"
        >
          <p className="text-label-md text-on-surface tabular-nums">
            เลือก {picked.length} จาก {questions.length} ข้อ
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setConfirmBulk(true)}
              className={dangerButtonClass}
            >
              <DeleteIcon className="h-4 w-4" />
              ลบที่เลือก
            </button>
            {picked.length < questions.length && (
              <button
                type="button"
                onClick={() => setPicked(questions.map((q) => q.id))}
                className={secondaryButtonClass}
              >
                เลือกทั้งหมด
              </button>
            )}
            <button type="button" onClick={() => setPicked([])} className={secondaryButtonClass}>
              ยกเลิกการเลือก
            </button>
          </div>
        </div>
      ) : (
        isDirty && (
          <div
            role="region"
            aria-label="บันทึกการแก้ไข"
            className="sticky bottom-4 z-20 mx-auto flex max-w-xl flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-3 shadow-md"
          >
            <p className="text-label-md text-on-surface">มีการแก้ไขที่ยังไม่ได้บันทึก</p>
            {/* เรียง [ยืนยัน] [ยกเลิก] จากซ้าย ตาม ui-design-system.md ข้อ 8.1 */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleSave("draft")}
                disabled={isSaving}
                className={primaryButtonClass}
              >
                บันทึก
              </button>
              <button
                type="button"
                onClick={() => setConfirmDiscard(true)}
                disabled={isSaving}
                className={secondaryButtonClass}
              >
                ยกเลิก
              </button>
            </div>
          </div>
        )
      )}

      <Modal
        open={pendingHref !== null}
        title="ยังไม่ได้บันทึกการแก้ไข"
        onClose={() => setPendingHref(null)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setPendingHref(null)}
              className={secondaryButtonClass}
            >
              อยู่ต่อ
            </button>
            <button
              type="button"
              onClick={() => {
                const href = pendingHref;
                setPendingHref(null);
                setBaseline(snapshot(title, description, questions));
                if (href) router.push(href);
              }}
              className={secondaryButtonClass}
            >
              ไม่บันทึก
            </button>
            <button
              type="button"
              onClick={() => {
                const href = pendingHref ?? undefined;
                setPendingHref(null);
                void handleSave("draft", href);
              }}
              className={primaryButtonClass}
            >
              บันทึกแล้วไปต่อ
            </button>
          </>
        }
      >
        <p className="text-body-md text-on-surface-variant">
          ถ้าไปหน้าอื่นโดยไม่บันทึก การแก้ไขล่าสุดจะหายไป
        </p>
      </Modal>

      <ConfirmDeleteModal
        open={confirmBulk}
        title="ลบคำถามที่เลือก"
        itemName={`${picked.length} ข้อ`}
        consequence="จะถูกลบออกจากแบบทดสอบนี้ (คำถามในคลังไม่ได้รับผลกระทบ) ยกเลิกได้โดยไม่บันทึกหน้านี้"
        confirmLabel={`ลบ ${picked.length} ข้อ`}
        onCancel={() => setConfirmBulk(false)}
        onConfirm={() => {
          const gone = new Set(picked);
          setQuestions((current) => renumber(current.filter((q) => !gone.has(q.id))));
          setToast(`ลบ ${gone.size} ข้อแล้ว อย่าลืมบันทึก`);
          setPicked([]);
          setConfirmBulk(false);
        }}
      />

      <Modal
        open={confirmDiscard}
        title="ยกเลิกการแก้ไข"
        onClose={() => setConfirmDiscard(false)}
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setConfirmDiscard(false);
                setCheckMode(null);
                setPicked([]);
                setSaveError("");
                if (quiz) applyQuiz(quiz);
                setRevision((n) => n + 1);
                setToast("ยกเลิกการแก้ไขแล้ว กลับเป็นข้อมูลที่บันทึกล่าสุด");
              }}
              className={dangerButtonClass}
            >
              ยกเลิกการแก้ไข
            </button>
            <button
              type="button"
              onClick={() => setConfirmDiscard(false)}
              className={secondaryButtonClass}
            >
              แก้ไขต่อ
            </button>
          </>
        }
      >
        <p className="text-body-md text-on-surface-variant">
          การแก้ไขที่ยังไม่ได้บันทึกจะหายไป และกลับเป็นข้อมูลที่บันทึกล่าสุด
        </p>
      </Modal>

      <SuccessToast message={toast} onDone={clearToast} />
    </div>
  );
}
