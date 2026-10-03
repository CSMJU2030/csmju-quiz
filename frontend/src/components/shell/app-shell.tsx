// src/components/shell/app-shell.tsx
// AppShell ชั่วคราว ตามสเปค ui-design-system.md ข้อ 5.1–5.2, 6.2
// (local component ช่วงเปลี่ยนผ่าน ข้อ 17.0 — ประกาศไว้ใน subsystem.yaml → ui.local_components)
// เมื่อได้ template แล้วให้แทนด้วย `import { CsmjuAppShell } from "@/csmju"` ใน app/layout.tsx ที่เดียว
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowBackIcon,
  BarChartIcon,
  CloseIcon,
  DashboardIcon,
  DatabaseIcon,
  HistoryIcon,
  LogoutIcon,
  MenuIcon,
  QuizIcon,
  SportsEsportsIcon,
  AddIcon,
  type IconComponent,
} from "@/components/icons";
import { onDarkButtonClass, iconRoundButtonClass } from "@/components/shared/ui";
import { isGuestPath, useCurrentUser } from "@/hooks/use-current-user";
import { CORE_HUB_WEB_URL, SUBSYSTEM_DISPLAY_NAME } from "@/lib/env";
import { loginUrl } from "@/lib/api";
import { LogoutForm } from "@/components/shell/logout-form";
import {
  coreRoleLabel,
  hasPermission,
  Permission,
  ROLE_LABELS,
  type PermissionName,
} from "@/lib/permissions";

interface NavItem {
  label: string;
  href: string;
  icon: IconComponent;
  permission: PermissionName;
  /** teach = งานของผู้สอน (เรียงตามลำดับงาน สร้าง → คลัง → รายงาน) · play = การเล่นเกม */
  group: "teach" | "play";
  /** ซ่อนเมนูนี้เมื่อผู้ใช้มีสิทธิ์นี้ (เช่น "ภาพรวม" ของผู้เล่น ซ่อนสำหรับผู้สอนที่มีภาพรวมของตัวเองแล้ว) */
  hiddenWith?: PermissionName;
}

const NAV: NavItem[] = [
  {
    label: "ภาพรวม",
    href: "/dashboard",
    icon: DashboardIcon,
    permission: Permission.QUIZ_READ_OWN,
    group: "teach",
  },
  {
    label: "แบบทดสอบของฉัน",
    href: "/quiz",
    icon: QuizIcon,
    permission: Permission.QUIZ_READ_OWN,
    group: "teach",
  },
  {
    label: "คลังคำถาม",
    href: "/question-bank",
    icon: DatabaseIcon,
    permission: Permission.QUESTION_BANK_MANAGE_OWN,
    group: "teach",
  },
  {
    label: "รายงาน",
    href: "/reports",
    icon: BarChartIcon,
    permission: Permission.REPORT_READ_OWN,
    group: "teach",
  },
  {
    // หน้าแรกของผู้เล่น (ผู้สอนใช้ "ภาพรวม" ที่ /dashboard แทน)
    label: "ภาพรวม",
    href: "/",
    icon: DashboardIcon,
    permission: Permission.GAME_JOIN,
    group: "play",
    hiddenWith: Permission.QUIZ_READ_OWN,
  },
  {
    label: "เข้าร่วมเกม",
    href: "/game/join",
    icon: SportsEsportsIcon,
    permission: Permission.GAME_JOIN,
    group: "play",
  },
  {
    // เฉพาะเกมที่เข้าด้วยบัญชี MJU (สแกน QR แบบไม่ล็อกอินไม่มีประวัติ)
    label: "ประวัติการเล่น",
    href: "/history",
    icon: HistoryIcon,
    permission: Permission.GAME_HISTORY_READ_OWN,
    group: "play",
  },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function initials(email: string) {
  return email.slice(0, 2).toUpperCase();
}

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const NavIcon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-primary ${
        active
          ? "border-l-4 border-accent bg-surface-container-lowest/10 text-on-primary"
          : "border-l-4 border-transparent text-on-primary/70 hover:bg-surface-container-lowest/5 hover:text-on-primary"
      }`}
    >
      <NavIcon className="h-5 w-5" />
      <span className="text-label-md">{item.label}</span>
    </Link>
  );
}

/** ปุ่มกลับหน้าหลักของแพลตฟอร์ม (Dashboard ของ Core Hub) — ตำแหน่งเดียวกันทุกระบบย่อย (ข้อ 5.1) */
function BackToCore({ compact = false }: { compact?: boolean }) {
  if (!CORE_HUB_WEB_URL) return null;
  return compact ? (
    <a href={CORE_HUB_WEB_URL} aria-label="กลับหน้าหลัก" className={iconRoundButtonClass}>
      <ArrowBackIcon className="h-5 w-5" />
    </a>
  ) : (
    <a
      href={CORE_HUB_WEB_URL}
      className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-label-md text-on-surface-variant transition-colors hover:bg-surface-variant/50 hover:text-primary-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-container"
    >
      <ArrowBackIcon className="h-4 w-4" />
      กลับหน้าหลัก
    </a>
  );
}

function SidebarContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const state = useCurrentUser();
  const role = state.status === "ready" ? state.user.subsystemRole : null;
  const hidden = state.status !== "ready";

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <Link
        href="/"
        onClick={onNavigate}
        className="rounded-xl bg-surface-container-lowest p-4 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-primary"
      >
        <span className="block font-display text-headline-md text-primary-container">CSMJU</span>
        <span className="block text-caption text-on-surface-variant">{SUBSYSTEM_DISPLAY_NAME}</span>
      </Link>

      {!hidden && hasPermission(role, Permission.GAME_HOST) && (
        <Link
          href="/game/create"
          onClick={onNavigate}
          className="relative inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-surface-container-lowest px-4 py-3 text-label-md text-primary-container transition-colors hover:bg-primary-fixed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <AddIcon className="h-4 w-4" />
          เปิดห้องเล่นเกม
        </Link>
      )}

      <nav aria-label="เมนูหลัก" className="flex-1 space-y-1 overflow-y-auto">
        {!hidden &&
          (["teach", "play"] as const).map((group) => {
            const items = NAV.filter(
              (item) =>
                item.group === group &&
                hasPermission(role, item.permission) &&
                !(item.hiddenWith && hasPermission(role, item.hiddenWith)),
            );
            if (items.length === 0) return null;
            const showHeading = group === "play" && hasPermission(role, Permission.QUIZ_READ_OWN);
            return (
              <div key={group} className={showHeading ? "space-y-1 pt-4" : "space-y-1"}>
                {showHeading && (
                  <p className="border-t border-on-primary/15 px-3 pb-1 pt-4 text-caption text-on-primary/85">
                    เล่นเกม
                  </p>
                )}
                {items.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    active={isActive(pathname, item.href)}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            );
          })}
      </nav>

      {/* ออกจากระบบจริง: ล้าง session ของระบบนี้แล้วออกจาก Core Hub ต่อ (เครื่องใช้ร่วมกัน) */}
      <LogoutForm className="w-full" buttonClassName={`${onDarkButtonClass} w-full`}>
        <LogoutIcon className="h-4 w-4" />
        ออกจากระบบ
      </LogoutForm>
    </div>
  );
}

/** แจ้งเมื่อยังระบุตัวผู้ใช้ไม่ได้ — แทนการแสดงหน้าว่างเปล่า */
function SessionNotice() {
  const state = useCurrentUser();
  if (state.status !== "error") return null;
  const text: Record<typeof state.reason, string> = {
    unauthorized: "ยังเข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง",
    forbidden:
      "บัญชีของคุณยังไม่มีสิทธิ์ใช้ระบบนี้ หากคิดว่าเป็นข้อผิดพลาด กรุณาติดต่อผู้ดูแลระบบย่อยนี้",
    network: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง",
  };
  return (
    <div
      role="alert"
      className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-error-container px-4 py-3 text-body-md text-on-error-container"
    >
      <span>{text[state.reason]}</span>
      {state.reason === "unauthorized" && (
        <a
          href={loginUrl()}
          className="inline-flex min-h-11 items-center underline underline-offset-4"
        >
          เข้าสู่ระบบอีกครั้ง
        </a>
      )}
      {state.reason === "network" && (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex min-h-11 items-center underline underline-offset-4"
        >
          ลองอีกครั้ง
        </button>
      )}
    </div>
  );
}

function UserMenu() {
  const state = useCurrentUser();
  if (state.status !== "ready") return null;
  const { user } = state;
  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-right md:block">
        <span className="block text-label-md text-on-surface">{user.email}</span>
        {/* RoleBadge ชั่วคราว: core role · บทบาทในระบบนี้ (ข้อ 10.3) */}
        <span className="block text-caption text-on-surface-variant">
          {coreRoleLabel(user.coreRole)} · {ROLE_LABELS[user.subsystemRole]}
        </span>
      </span>
      <span
        aria-hidden="true"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant/50 bg-primary-container text-label-md text-on-primary"
      >
        {initials(user.email)}
      </span>
    </div>
  );
}

/** โครงหน้าของผู้เล่นที่ไม่ล็อกอิน: หัวหน้าที่มีแค่ชื่อระบบ + เนื้อหา + footer */
function GuestShell({ children, year }: { children: ReactNode; year: number }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-surface-container-lowest px-4 py-2 text-label-md text-primary-container shadow-md focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        ข้ามไปยังเนื้อหาหลัก
      </a>
      <header className="sticky top-0 z-10 flex h-16 items-center justify-center border-b border-surface-variant bg-surface-container-lowest px-4 shadow-sm">
        <span className="text-gradient font-display text-headline-md">
          {SUBSYSTEM_DISPLAY_NAME}
        </span>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {children}
      </main>
      <footer className="border-t border-outline-variant/30 bg-surface-container-low px-4 py-6">
        <p
          suppressHydrationWarning
          className="mx-auto max-w-5xl text-center text-caption text-on-surface-variant"
        >
          © {year} สาขาวิชาวิทยาการคอมพิวเตอร์ คณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้
        </p>
      </footer>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // drawer เป็น modal dialog: เปิดแล้วย้าย focus เข้าไป · Tab วนอยู่ข้างใน · Esc ปิด
  // ปิดแล้ว (ทุกทาง ยกเว้นกดลิงก์ไปหน้าอื่น) คืน focus ให้ปุ่มเมนู
  useEffect(() => {
    if (!drawerOpen) return;
    const drawer = drawerRef.current;
    const menuButton = menuButtonRef.current;
    const focusables = () =>
      Array.from(
        drawer?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    focusables()[0]?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setDrawerOpen(false);
        return;
      }
      if (event.key !== "Tab" || !drawer) return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !drawer.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !drawer.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      // คืน focus เฉพาะเมื่อ focus ยังค้างอยู่ใน drawer ที่ปิดไป (ไม่แย่ง focus จากหน้าใหม่)
      const active = document.activeElement;
      if (!active || active === document.body || drawer?.contains(active)) menuButton?.focus();
    };
  }, [drawerOpen]);

  // ปีพุทธศักราช — เวลาเครื่อง server กับเบราว์เซอร์อาจข้ามปีไม่ตรงกัน (suppressHydrationWarning ที่ footer)
  const year = new Date().getFullYear() + 543;

  // ผู้เล่นที่สแกน QR (บัตรเข้าห้อง) — ไม่มีเมนูและไม่มีบัญชีผู้ใช้ เหลือแค่ชื่อระบบ
  if (isGuestPath(pathname)) return <GuestShell year={year}>{children}</GuestShell>;

  return (
    <div className="min-h-dvh bg-background">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-surface-container-lowest px-4 py-2 text-label-md text-primary-container shadow-md focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        ข้ามไปยังเนื้อหาหลัก
      </a>

      {/* Sidebar (desktop) */}
      <aside className="brand-gradient fixed inset-y-0 left-0 z-30 hidden h-dvh w-64 shadow-xl md:block">
        <SidebarContent pathname={pathname} />
      </aside>

      {/* Drawer (mobile) */}
      {drawerOpen && (
        <div className="md:hidden">
          <div
            aria-hidden="true"
            className="fixed inset-0 z-20 bg-on-surface/40"
            onClick={() => setDrawerOpen(false)}
          />
          <div
            ref={drawerRef}
            id="mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="เมนูหลัก"
            className="brand-gradient fixed inset-y-0 left-0 z-30 h-dvh w-64 shadow-xl fade-slide-up"
          >
            <button
              type="button"
              aria-label="ปิดเมนู"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-2 top-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-on-primary hover:bg-surface-container-lowest/10 focus-visible:outline-2 focus-visible:outline-on-primary"
            >
              <CloseIcon className="h-6 w-6" />
            </button>
            <SidebarContent pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-h-dvh flex-col md:pl-64">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-surface-variant bg-surface-container-lowest px-4 shadow-sm md:px-12">
          <div className="flex items-center gap-1 md:hidden">
            <button
              ref={menuButtonRef}
              type="button"
              aria-label="เปิดเมนู"
              aria-expanded={drawerOpen}
              aria-controls="mobile-drawer"
              onClick={() => setDrawerOpen(true)}
              className={iconRoundButtonClass}
            >
              <MenuIcon className="h-6 w-6" />
            </button>
            <BackToCore compact />
            <span className="text-gradient font-display text-headline-md">
              {SUBSYSTEM_DISPLAY_NAME}
            </span>
          </div>
          <div className="hidden md:block">
            <BackToCore />
          </div>
          <UserMenu />
        </header>

        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 md:px-12"
        >
          <SessionNotice />
          {children}
        </main>

        <footer className="border-t border-outline-variant/30 bg-surface-container-low px-4 py-6 md:px-12">
          <p
            suppressHydrationWarning
            className="mx-auto max-w-7xl text-caption text-on-surface-variant"
          >
            © {year} สาขาวิชาวิทยาการคอมพิวเตอร์ คณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้
          </p>
        </footer>
      </div>
    </div>
  );
}
