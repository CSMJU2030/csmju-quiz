// src/components/shared/overflow-menu.tsx
// เมนู "⋯" สำหรับคำสั่งที่ใช้ไม่บ่อย — รูปแบบ menu button ของ WAI-ARIA
// เปิดด้วยคลิก/Enter/ลูกศรลง · ลูกศรขึ้น/ลงเลื่อน · Esc ปิดแล้วกลับไปที่ปุ่ม · คลิกข้างนอกปิด
"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { MoreHorizIcon } from "@/components/icons";
import { iconButtonClass } from "@/components/shared/ui";

export interface OverflowMenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  /** เหตุผลที่กดไม่ได้ (แสดงใต้ชื่อคำสั่ง) */
  hint?: string;
}

export function OverflowMenu({ label, items }: { label: string; items: OverflowMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const focusItem = (index: number) => {
    const list = boxRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]");
    if (!list?.length) return;
    list[(index + list.length) % list.length].focus();
  };

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    const timer = window.setTimeout(() => focusItem(0), 0);
    return () => {
      document.removeEventListener("mousedown", close);
      window.clearTimeout(timer);
    };
  }, [open]);

  const closeMenu = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <div ref={boxRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        title="คำสั่งเพิ่มเติม"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={iconButtonClass}
      >
        <MoreHorizIcon className="h-5 w-5" />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={(e) => {
            const list = Array.from(
              boxRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? [],
            );
            const current = list.indexOf(document.activeElement as HTMLButtonElement);
            if (e.key === "ArrowDown") {
              e.preventDefault();
              focusItem(current + 1);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              focusItem(current - 1);
            } else if (e.key === "Escape" || e.key === "Tab") {
              closeMenu();
            }
          }}
          className="absolute right-0 top-full z-20 mt-1 min-w-56 rounded-lg border border-outline-variant/40 bg-surface-container-lowest py-1 shadow-md fade-slide-up"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                closeMenu();
                item.onSelect();
              }}
              className="flex min-h-11 w-full items-start gap-3 px-3 py-2 text-left text-body-md text-on-surface hover:bg-surface-variant/50 focus-visible:bg-surface-variant/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              {item.icon && (
                <span className="mt-0.5 shrink-0 text-on-surface-variant">{item.icon}</span>
              )}
              <span>
                <span className="block">{item.label}</span>
                {item.hint && (
                  <span className="block text-caption text-on-surface-variant">{item.hint}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
