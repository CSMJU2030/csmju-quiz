// src/components/quiz/question-image-field.tsx
// รูปประกอบคำถาม — อัปโหลดไฟล์ (เก็บที่ Core Hub) หรือวางลิงก์ https:// อย่างใดอย่างหนึ่ง
"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";
import { CloseIcon, ErrorIcon, PhotoCameraIcon, ProgressActivityIcon } from "@/components/icons";
import {
  iconDangerButtonClass,
  inputClass,
  labelClass,
  secondaryButtonClass,
} from "@/components/shared/ui";
import { errorMessage } from "@/lib/api";
import {
  IMAGE_ACCEPT,
  MAX_IMAGE_MB,
  imageFileProblem,
  uploadQuestionImage,
} from "@/lib/image-upload";
import { isValidImageUrl } from "@/lib/question-model";

interface QuestionImageFieldProps {
  id: string;
  image?: string;
  imageId?: string;
  /** ข้อความผิดพลาดของลิงก์ (จาก validateQuestion) */
  linkError?: string;
  onChange: (next: { image?: string; imageId?: string }) => void;
  onBlur: () => void;
}

export function QuestionImageField({
  id,
  image,
  imageId,
  linkError,
  onChange,
  onBlur,
}: QuestionImageFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [broken, setBroken] = useState<string | null>(null);
  /** ไม่มีรูป = ซ่อนไว้หลังปุ่ม "เพิ่มรูปประกอบ" ให้ฟอร์มแต่ละข้อสั้น */
  const [open, setOpen] = useState(false);
  const hintId = useId();
  const errorId = useId();

  const url = image?.trim() ?? "";
  const uploaded = Boolean(imageId && url);
  const previewable = url && (uploaded || isValidImageUrl(url)) && broken !== url;
  const error = uploadError || (uploaded ? "" : linkError) || "";
  const expanded = open || Boolean(url) || Boolean(error);

  async function pick(file: File | undefined) {
    if (!file) return;
    const problem = imageFileProblem(file);
    if (problem) {
      setUploadError(problem);
      return;
    }
    setUploading(true);
    setUploadError("");
    try {
      const result = await uploadQuestionImage(file);
      setBroken(null);
      onChange({ image: result.url, imageId: result.id });
    } catch (err) {
      setUploadError(`อัปโหลดรูปไม่สำเร็จ: ${errorMessage(err)}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const uploadButton = (
    <button
      id={uploaded ? `${id}-upload` : undefined}
      type="button"
      onClick={() => fileRef.current?.click()}
      disabled={uploading}
      className={`${secondaryButtonClass} shrink-0`}
    >
      {uploading ? (
        <ProgressActivityIcon className="h-4 w-4 animate-spin" />
      ) : (
        <PhotoCameraIcon className="h-4 w-4" />
      )}
      {uploading ? "กำลังอัปโหลด…" : uploaded ? "เปลี่ยนรูป" : "อัปโหลดรูป"}
    </button>
  );

  if (!expanded) {
    return (
      <div>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            window.setTimeout(() => document.getElementById(id)?.focus(), 0);
          }}
          className={secondaryButtonClass}
        >
          <PhotoCameraIcon className="h-4 w-4" />
          เพิ่มรูปประกอบ
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label htmlFor={uploaded ? `${id}-upload` : id} className={labelClass}>
        รูปประกอบ (ไม่บังคับ)
      </label>
      <input
        ref={fileRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => void pick(e.target.files?.[0])}
      />

      {uploaded ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-body-md text-on-surface-variant">
            ใช้รูปที่อัปโหลดแล้ว
          </span>
          {uploadButton}
          <button
            type="button"
            onClick={() => {
              setUploadError("");
              setOpen(false);
              onChange({ image: undefined, imageId: undefined });
            }}
            className={iconDangerButtonClass}
            aria-label="นำรูปประกอบออก"
            title="นำรูปออก"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id={id}
            type="url"
            inputMode="url"
            value={image ?? ""}
            onChange={(e) => {
              setUploadError("");
              onChange({ image: e.target.value, imageId: undefined });
            }}
            onBlur={onBlur}
            placeholder="วางลิงก์รูป https://"
            aria-describedby={[hintId, error ? errorId : ""].filter(Boolean).join(" ")}
            aria-invalid={error ? true : undefined}
            className={`${inputClass} min-w-0 flex-1 ${error ? "input-error" : ""}`}
          />
          <div className="flex gap-2">
            {uploadButton}
            {!url && (
              <button
                type="button"
                onClick={() => {
                  setUploadError("");
                  setOpen(false);
                }}
                className={iconDangerButtonClass}
                aria-label="ไม่ใส่รูปประกอบ"
                title="ไม่ใส่รูป"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            )}
            {url && (
              <button
                type="button"
                onClick={() => {
                  setUploadError("");
                  setOpen(false);
                  onChange({ image: undefined, imageId: undefined });
                }}
                className={iconDangerButtonClass}
                aria-label="นำรูปประกอบออก"
                title="นำรูปออก"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      )}

      <p id={hintId} className="text-caption text-on-surface-variant">
        JPG, PNG หรือ WebP ไม่เกิน {MAX_IMAGE_MB} MB · รูปเปิดดูได้โดยไม่ต้องล็อกอิน
        อย่าใช้รูปที่มีข้อมูลส่วนตัว
      </p>
      {error && (
        <p id={errorId} role="alert" className="flex items-center gap-1.5 text-label-sm text-error">
          <ErrorIcon className="h-4 w-4" />
          {error}
        </p>
      )}

      {previewable && (
        <Image
          src={url}
          alt="ตัวอย่างรูปประกอบ"
          width={320}
          height={180}
          unoptimized
          onError={() => setBroken(url)}
          className="h-24 w-auto max-w-full rounded-lg border border-outline-variant/40 object-contain"
        />
      )}
      {url && broken === url && (
        <p className="flex items-center gap-1.5 text-label-sm text-error">
          <ErrorIcon className="h-4 w-4" />
          เปิดรูปนี้ไม่ได้ ตรวจลิงก์หรืออัปโหลดใหม่
        </p>
      )}
    </div>
  );
}
