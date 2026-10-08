"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormField, RequiredNote } from "@/components/shared/form-field";
import { charCountHint } from "@/lib/format";
import { PageHeader } from "@/components/shared/states";
import { ReloginNotice } from "@/components/shared/notice";
import {
  cardClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/shared/ui";
import { ApiError, errorMessage, setUnsavedWork } from "@/lib/api";
import { createDraftQuiz, saveQuiz } from "@/lib/quiz-store";

const TITLE_MAX = 150;
const DESCRIPTION_MAX = 500;

export default function CreateQuizPage() {
  const router = useRouter();
  const titleRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [titleError, setTitleError] = useState("");
  const [formError, setFormError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  // กรอกค้างอยู่ → 401 ไม่พาทั้งหน้าไป /auth/login ทับ (auth-contract ข้อ 7)
  const hasInput = title.trim() !== "" || description.trim() !== "";
  useEffect(() => {
    setUnsavedWork(hasInput);
    return () => setUnsavedWork(false);
  }, [hasInput]);

  const validateTitle = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "กรุณากรอกชื่อแบบทดสอบ";
    if (trimmed.length > TITLE_MAX) return `ชื่อแบบทดสอบต้องไม่เกิน ${TITLE_MAX} ตัวอักษร`;
    return "";
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isCreating) return;

    const error = validateTitle(title);
    setTitleError(error);
    if (error) {
      titleRef.current?.focus();
      return;
    }

    setIsCreating(true);
    setFormError("");
    setSessionExpired(false);
    try {
      const saved = await saveQuiz({
        ...createDraftQuiz(),
        title: title.trim(),
        description: description.trim(),
        status: "DRAFT",
        questions: [],
        updatedAt: new Date().toISOString(),
      });
      router.push(`/quiz/${saved.id}/edit`);
    } catch (err) {
      if (err instanceof ApiError && err.code === "UNAUTHORIZED") setSessionExpired(true);
      else setFormError(`บันทึกไม่สำเร็จ: ${errorMessage(err)}`);
      setIsCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader title="สร้างแบบทดสอบ" description="ตั้งชื่อแบบทดสอบ แล้วเพิ่มคำถามในขั้นถัดไป" />

      <form onSubmit={handleSubmit} noValidate className={`${cardClass} space-y-4 p-6`}>
        <RequiredNote />

        <FormField
          id="quiz-title"
          label="ชื่อแบบทดสอบ"
          required
          hint={charCountHint(title.length, TITLE_MAX)}
          error={titleError}
        >
          <input
            ref={titleRef}
            type="text"
            value={title}
            maxLength={TITLE_MAX}
            disabled={isCreating}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => setTitleError(validateTitle(title))}
            className={inputClass}
          />
        </FormField>

        <FormField
          id="quiz-description"
          label="คำอธิบาย (ไม่บังคับ)"
          hint={charCountHint(description.length, DESCRIPTION_MAX)}
        >
          <textarea
            value={description}
            maxLength={DESCRIPTION_MAX}
            rows={3}
            disabled={isCreating}
            onChange={(e) => setDescription(e.target.value)}
            className={`${inputClass} resize-none`}
          />
        </FormField>

        <p className="text-label-sm text-on-surface-variant">
          บันทึกเป็นแบบร่างก่อน เผยแพร่ได้เมื่อเพิ่มคำถามครบ
        </p>

        {sessionExpired && <ReloginNotice onClose={() => setSessionExpired(false)} />}
        {formError && (
          <p role="alert" className="text-label-sm text-error">
            {formError}
          </p>
        )}

        {/* ปุ่มส่งอยู่ล่างซ้าย [บันทึก] [ยกเลิก] (ui-design-system.md ข้อ 8.1) */}
        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
          <button
            type="submit"
            disabled={isCreating}
            aria-busy={isCreating}
            className={`${primaryButtonClass} ${isCreating ? "btn-loading" : ""}`}
          >
            <span className="btn-text">บันทึกและเพิ่มคำถาม</span>
            <span className="dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
          <Link href="/quiz" className={secondaryButtonClass} aria-disabled={isCreating}>
            ยกเลิก
          </Link>
        </div>
      </form>
    </div>
  );
}
