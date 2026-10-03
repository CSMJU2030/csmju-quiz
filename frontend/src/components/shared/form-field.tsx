// src/components/shared/form-field.tsx
// FormField (label + hint + error) ตาม ui-design-system.md ข้อ 8.1 — local component ชั่วคราว
// label มองเห็นได้เสมอ · ฟิลด์บังคับมี * + aria-required · error อยู่ใต้ฟิลด์ผูกด้วย aria-describedby
"use client";

import { cloneElement, isValidElement, type ReactElement } from "react";
import { ErrorIcon } from "@/components/icons";
import { labelClass } from "@/components/shared/ui";

type ControlProps = {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
  required?: boolean;
  className?: string;
};

export function FormField({
  id,
  label,
  hint,
  error,
  required = false,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactElement<ControlProps>;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        "aria-required": required || undefined,
        className: `${children.props.className ?? ""} ${error ? "input-error" : ""}`.trim(),
      })
    : children;

  return (
    <div className="space-y-2">
      <label htmlFor={id} className={labelClass}>
        {label}
        {required && (
          <span aria-hidden="true" className="ml-1 text-error">
            *
          </span>
        )}
      </label>
      {control}
      {hint && (
        <p id={hintId} className="text-caption text-on-surface-variant">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="flex items-center gap-1.5 text-label-sm text-error">
          <ErrorIcon className="h-4 w-4" />
          {error}
        </p>
      )}
    </div>
  );
}

export function RequiredNote() {
  return <p className="text-caption text-on-surface-variant">ช่องที่มี * จำเป็นต้องกรอก</p>;
}
