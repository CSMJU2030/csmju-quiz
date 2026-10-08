// src/app/game/join/page.tsx
// เข้าร่วมเกม: กรอกรหัส → ตั้งชื่อ → เลือกรูปโปรไฟล์
// ใช้ 2 ช่องทาง: /game/join (ล็อกอินผ่าน Core Hub) · /play (สแกน QR แล้วเล่นด้วยบัตรเข้าห้อง ไม่ต้องล็อกอิน)
// มาจากลิงก์/QR (?pin=) → เติมรหัสให้และแสดงเป็นห้องที่พบ ผู้เล่นแค่ตั้งชื่อกับเลือกรูป
// ทั้ง 2 หน้ามีปุ่มสลับช่องทางโดยถือรหัสเดิมไปด้วย
//   ยังไม่ล็อกอิน → /auth/login?next=/game/join?pin=… → ล็อกอินที่ Core Hub → กลับมาหน้านี้พร้อมรหัสทันที
// โปรไฟล์ที่คนอื่นเห็น = รูปโปรไฟล์ + ชื่อที่ตั้งเอง (ไม่แสดงชื่อของรูป)
"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CasinoIcon,
  CheckIcon,
  EditIcon,
  ErrorIcon,
  ExpandMoreIcon,
  PersonIcon,
  SchoolIcon,
  SportsEsportsIcon,
} from "@/components/icons";
import { FormField, RequiredNote } from "@/components/shared/form-field";
import {
  cardClass,
  inputClass,
  labelClass,
  linkClass,
  primaryButtonClass,
  secondaryButtonClass,
  tonalButtonClass,
} from "@/components/shared/ui";
import { PlayerAvatar } from "@/components/game/player-avatar";
import { AVATARS, randomAvatarIndex } from "@/lib/avatars";
import {
  findLobbyByPin,
  gameErrorMessage,
  guestFindLobby,
  guestJoin,
  joinGame,
} from "@/lib/game-api";
import { playerLinks, useGameChannel } from "@/lib/game-channel";
import { ApiError, logoutUrl } from "@/lib/api";
import { useCurrentUser } from "@/hooks/use-current-user";
import { readLastProfile, saveLastProfile } from "@/lib/player-session";
import { Breadcrumb } from "@/components/shell/breadcrumb";

const NAMES = [
  "นนท์",
  "ต้น",
  "บอส",
  "เจมส์",
  "พีท",
  "ภูมิ",
  "ฟลุ๊ค",
  "กาย",
  "มินท์",
  "พลอย",
  "แพรว",
  "น้ำ",
  "ฟ้า",
  "ใบเตย",
  "มายด์",
  "ออม",
  "เมย์",
  "บีม",
  "ปัน",
  "เนม",
  "แทน",
  "เจน",
  "ไอซ์",
  "ข้าว",
  "เฟิร์น",
  "แบงค์",
  "เต้",
  "ปาล์ม",
  "โอม",
  "ฟิล์ม",
  "บูม",
  "ไนท์",
  "วิน",
  "หมิว",
  "ฟาง",
  "อิง",
  "เจ",
  "ตูน",
  "อาร์ต",
  "มอส",
  "มาร์ค",
  "แพท",
  "ก้อง",
  "นัท",
  "แจน",
  "ลูกน้ำ",
  "เนย",
  "แป้ง",
];

const MAX_NICKNAME = 20;
const NOT_FOUND = "ไม่พบห้องที่เปิดรอผู้เล่นด้วยรหัสนี้ เกมอาจเริ่มไปแล้ว กรุณาตรวจสอบรหัสอีกครั้ง";
/** จำนวนรูปที่แสดงก่อนกด "ดูรูปทั้งหมด" (มือถือ 2 แถว · คอม 1 แถว) */
const INITIAL_AVATAR_COUNT = 8;

/** ตรวจรหัสเกม — คืนข้อความ error หรือ null (ใช้ทั้งตอนออกจากช่องและตอนกดส่ง · ข้อ 8.1) */
function pinProblem(pin: string): string | null {
  return pin.trim().length === 6 ? null : "กรุณากรอกรหัสเกมให้ครบ 6 หลัก";
}

function nameProblem(name: string): string | null {
  const clean = name.trim();
  if (!clean) return "กรุณากรอกชื่อผู้เล่น";
  if (clean.length > MAX_NICKNAME) return `ชื่อผู้เล่นต้องไม่เกิน ${MAX_NICKNAME} ตัวอักษร`;
  return null;
}

export default function JoinPage() {
  return (
    <Suspense fallback={null}>
      <JoinInner />
    </Suspense>
  );
}

function JoinInner() {
  const router = useRouter();
  const search = useSearchParams();
  const channel = useGameChannel();
  const guest = channel === "guest";
  const findLobby = guest ? guestFindLobby : findLobbyByPin;
  // ช่องทาง member: แสดงบัญชีที่กำลังใช้ (เครื่องใช้ร่วมกัน) · /play (guest) ไม่เรียก /me — context คืน "guest"
  const userState = useCurrentUser();
  const signedInAs = !guest && userState.status === "ready" ? userState.user.email : null;

  const [pin, setPin] = useState("");
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState(0);
  const [pinError, setPinError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAllAvatars, setShowAllAvatars] = useState(false);
  /** รหัสมาจากลิงก์/QR และยังไม่ได้กดเปลี่ยน → แสดงเป็นห้องที่พบแทนช่องกรอก */
  const [pinFromLink, setPinFromLink] = useState(false);

  // เติมรหัสจากลิงก์ และชื่อ/รูปที่ใช้ครั้งก่อน (อ่านหลัง mount เพื่อไม่ให้ hydration ไม่ตรง)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const fromUrl = (search.get("pin") ?? "").replace(/\D/g, "").slice(0, 6);
      if (fromUrl) setPin(fromUrl);
      setPinFromLink(fromUrl.length === 6);

      const last = readLastProfile();
      setNickname(last.nickname.slice(0, MAX_NICKNAME));
      if (last.avatarIndex !== null) {
        setAvatar(last.avatarIndex);
      }
      // มาจาก QR และยังไม่เคยตั้งชื่อ → ไปที่ช่องชื่อทันที
      if (fromUrl.length === 6 && !last.nickname) {
        document.getElementById("join-nickname")?.focus();
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [search]);

  // ค้นห้องจากรหัสเมื่อกรอกครบ 6 หลัก (แสดงชื่อแบบทดสอบให้มั่นใจว่าเข้าถูกห้อง)
  const [room, setRoom] = useState<{ pin: string; title: string } | null>(null);
  useEffect(() => {
    if (pin.length !== 6) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      findLobby(pin)
        .then((found) => {
          if (cancelled) return;
          setRoom({ pin, title: found ? found.quizTitle || "ห้องพร้อมเล่น" : "" });
          // ไม่พบห้อง (เช่น QR ของห้องที่เริ่มหรือปิดไปแล้ว) → เปิดช่องให้แก้รหัสพร้อมบอกเหตุผล
          if (!found) {
            setPinFromLink(false);
            setPinError(NOT_FOUND);
          }
        })
        .catch(() => {
          if (!cancelled) setRoom(null);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [pin, findLobby]);
  const roomTitle = room && room.pin === pin ? room.title : "";
  const pinLocked = pinFromLink && pin.length === 6;

  const editPin = () => {
    setPinFromLink(false);
    window.setTimeout(() => document.getElementById("join-pin")?.focus(), 0);
  };

  // สองช่องทางวางคู่กันบนสุดของฟอร์ม ขนาดเท่ากัน — สลับแล้วถือรหัสเดิมไปด้วย
  // (เดิมปุ่มบัญชีอยู่ท้ายหน้า ผู้เล่นที่มีบัญชีมักกด "เข้าร่วมเกม" ไปก่อนจึงถูกนับเป็นไม่ล็อกอิน)
  const pinQuery = pin.length === 6 ? `?pin=${pin}` : "";
  const channels = [
    {
      key: "member",
      href: `/game/join${pinQuery}`,
      title: "เล่นด้วยบัญชี MJU",
      desc: "เก็บประวัติและทบทวนคำตอบได้",
      Icon: SchoolIcon,
      active: !guest,
    },
    {
      key: "guest",
      href: `/play${pinQuery}`,
      title: "เล่นแบบไม่ล็อกอิน",
      desc: "ใช้ชื่อเล่น ไม่เก็บประวัติ",
      Icon: PersonIcon,
      active: guest,
    },
  ] as const;

  const randomize = () => {
    const next = randomAvatarIndex();
    setNickname(NAMES[Math.floor(Math.random() * NAMES.length)]);
    setAvatar(next);
    setNameError(null);
    setFormError(null);
  };

  const handleJoin = () => {
    if (loading) return;
    setFormError(null);
    const cleanPin = pin.trim();
    const cleanNickname = nickname.trim();

    // ตรวจทุกช่องพร้อมกัน แล้วพา focus ไปช่องแรกที่ผิด (ข้อ 8.1)
    const pinMsg = pinProblem(cleanPin);
    const nameMsg = nameProblem(cleanNickname);
    setPinError(pinMsg);
    setNameError(nameMsg);
    if (pinMsg || nameMsg) {
      document.getElementById(pinMsg ? "join-pin" : "join-nickname")?.focus();
      return;
    }

    setLoading(true);
    void (async () => {
      try {
        const lobby = await findLobby(cleanPin);
        if (!lobby) {
          setPinFromLink(false);
          setPinError(NOT_FOUND);
          window.setTimeout(() => document.getElementById("join-pin")?.focus(), 0);
          setLoading(false);
          return;
        }
        // เข้าซ้ำ (เช่น รีเฟรช/เปิดแท็บใหม่) backend คืนผู้เล่นเดิม
        if (guest) await guestJoin(lobby.id, cleanNickname, avatar);
        else await joinGame(lobby.id, cleanNickname, avatar);
        saveLastProfile(cleanNickname, avatar);
        router.push(playerLinks(channel, lobby.id).play);
      } catch (err) {
        const message = gameErrorMessage(err);
        const isName =
          err instanceof ApiError && err.code === "CONFLICT" && message.includes("ชื่อ");
        if (isName) {
          setNameError(message);
          document.getElementById("join-nickname")?.focus();
        } else {
          setFormError(message);
        }
        setLoading(false);
      }
    })();
  };

  // ตอนย่ออยู่: ถ้ารูปที่เลือกอยู่นอกชุดแรก ให้แสดงแทนช่องสุดท้าย เพื่อให้เห็นตัวที่เลือกเสมอ
  const allIndexes = AVATARS.map((_, i) => i);
  const visibleIndexes = showAllAvatars
    ? allIndexes
    : avatar < INITIAL_AVATAR_COUNT
      ? allIndexes.slice(0, INITIAL_AVATAR_COUNT)
      : [...allIndexes.slice(0, INITIAL_AVATAR_COUNT - 1), avatar];
  const hiddenAvatarCount = AVATARS.length - INITIAL_AVATAR_COUNT;
  const previewName = nickname.trim() || "ชื่อของคุณ";

  return (
    <div className="mx-auto max-w-xl">
      {!guest && (
        <div className="mb-4">
          <Breadcrumb />
        </div>
      )}
      {/* ─────── ส่วนหัว: ตัวอย่างโปรไฟล์ที่ผู้เล่นคนอื่นจะเห็น ─────── */}
      <section
        aria-labelledby="join-title"
        className="brand-gradient relative overflow-hidden rounded-2xl px-6 pb-16 pt-8 text-center shadow-xl"
      >
        <div className="relative fade-slide-up">
          <h1
            id="join-title"
            className="font-display text-headline-md text-on-primary md:text-headline-lg"
          >
            เข้าร่วมเกม
          </h1>
        </div>

        <div aria-live="polite" className="relative mt-6 flex flex-col items-center gap-2">
          <PlayerAvatar
            key={avatar}
            avatarIndex={avatar}
            nickname={previewName}
            size="xl"
            inverse
            className="animate-pop shadow-md"
          />
          <p
            className={`max-w-full truncate font-display text-headline-md ${
              nickname.trim() ? "text-on-primary" : "text-on-primary/50"
            }`}
          >
            {previewName}
          </p>
        </div>
      </section>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          handleJoin();
        }}
        className={`${cardClass} relative mx-3 -mt-10 space-y-6 p-6 shadow-md fade-slide-up stagger-1`}
      >
        <nav aria-label="วิธีเข้าร่วม" className="grid grid-cols-2 gap-3">
          {channels.map(({ key, href, title, desc, Icon, active }) => {
            const body = (
              <>
                <span className="flex items-center gap-2 text-label-md">
                  {active ? (
                    <CheckIcon className="h-5 w-5 shrink-0" />
                  ) : (
                    <Icon className="h-5 w-5 shrink-0" />
                  )}
                  {title}
                </span>
                <span
                  className={`text-label-sm ${active ? "text-on-primary/80" : "text-on-surface-variant"}`}
                >
                  {desc}
                </span>
              </>
            );
            const box =
              "flex min-h-24 flex-col items-start justify-center gap-1 rounded-xl border-2 px-4 py-3 text-left transition-colors";
            return active ? (
              <div
                key={key}
                aria-current="true"
                className={`${box} border-primary bg-primary text-on-primary`}
              >
                {body}
              </div>
            ) : (
              <Link
                key={key}
                href={href}
                className={`${box} border-outline-variant bg-surface text-on-surface hover:border-primary hover:bg-primary-container/10`}
              >
                {body}
              </Link>
            );
          })}
        </nav>

        {signedInAs && (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg bg-surface px-4 py-2 text-body-md text-on-surface-variant">
            <span className="min-w-0 break-all">
              เข้าร่วมในชื่อ <span className="text-label-md text-on-surface">{signedInAs}</span>
            </span>
            {/* ส่งฟอร์มออกจากระบบที่อยู่นอกฟอร์มนี้ (ซ้อน form ไม่ได้) → ล็อกอินใหม่ด้วยบัญชีอื่น */}
            <button
              type="submit"
              form="join-switch-account"
              className={`${linkClass} inline-flex min-h-11 items-center underline underline-offset-4`}
            >
              ไม่ใช่คุณ? เปลี่ยนบัญชี
            </button>
          </div>
        )}

        <RequiredNote />

        {pinLocked ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-outline-variant/60 bg-surface px-4 py-3">
            <div className="min-w-0">
              <p className={labelClass}>รหัสเกม</p>
              <p className="font-display text-headline-md tracking-widest text-on-surface tabular-nums">
                {pin}
              </p>
              <p className="truncate text-label-sm text-on-surface-variant" aria-live="polite">
                {roomTitle ? `พบห้อง: ${roomTitle}` : "กำลังค้นห้อง…"}
              </p>
            </div>
            <button type="button" onClick={editPin} className={secondaryButtonClass}>
              <EditIcon className="h-4 w-4" />
              เปลี่ยนรหัส
            </button>
          </div>
        ) : (
          <FormField
            id="join-pin"
            label="รหัสเกม (6 หลัก)"
            required
            error={pinError ?? undefined}
            hint={roomTitle ? `พบห้อง: ${roomTitle}` : undefined}
          >
            <input
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, "").slice(0, 6));
                setRoom(null);
                setPinError(null);
                setFormError(null);
              }}
              onBlur={() => {
                if (pin) setPinError(pinProblem(pin));
              }}
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              className={`${inputClass} text-center font-display text-headline-md tracking-widest tabular-nums`}
            />
          </FormField>
        )}

        <FormField
          id="join-nickname"
          label="ชื่อผู้เล่น"
          required
          error={nameError ?? undefined}
          hint={`${nickname.length}/${MAX_NICKNAME} · ทุกคนในห้องและผู้เปิดห้องจะเห็นชื่อนี้`}
        >
          <input
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value);
              setNameError(null);
              setFormError(null);
            }}
            // ช่องว่างยังไม่เตือนตอนออกจากช่อง (ช่องนี้ได้โฟกัสอัตโนมัติเมื่อสแกน QR) — ตรวจอีกครั้งตอนกดส่ง
            onBlur={() => {
              if (nickname) setNameError(nameProblem(nickname));
            }}
            maxLength={MAX_NICKNAME}
            autoComplete="nickname"
            className={inputClass}
          />
        </FormField>

        <fieldset className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <legend className={labelClass}>รูปโปรไฟล์</legend>
            <button type="button" onClick={randomize} className={secondaryButtonClass}>
              <CasinoIcon className="h-4 w-4" />
              สุ่มชื่อและรูป
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {visibleIndexes.map((index) => {
              const item = AVATARS[index];
              const active = avatar === index;
              return (
                <label
                  key={index}
                  className={`relative aspect-square min-h-11 cursor-pointer rounded-xl border-2 transition has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary-container ${
                    active
                      ? "animate-pop border-primary-container shadow-md"
                      : "border-transparent opacity-80 hover:border-accent hover:opacity-100"
                  }`}
                >
                  <input
                    type="radio"
                    name="join-avatar"
                    checked={active}
                    onChange={() => {
                      setAvatar(index);
                      setFormError(null);
                    }}
                    aria-label={`รูปที่ ${index + 1}: ${item.label}`}
                    className="sr-only"
                  />
                  <PlayerAvatar avatarIndex={index} size="fill" />
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary-container text-on-primary shadow-sm"
                    >
                      <CheckIcon className="h-4 w-4" />
                    </span>
                  )}
                </label>
              );
            })}
          </div>

          {hiddenAvatarCount > 0 && (
            <div className="flex justify-center">
              <button
                type="button"
                aria-expanded={showAllAvatars}
                onClick={() => setShowAllAvatars((v) => !v)}
                className={tonalButtonClass}
              >
                <ExpandMoreIcon
                  className={`h-4 w-4 transition-transform ${showAllAvatars ? "rotate-180" : ""}`}
                />
                {showAllAvatars ? "แสดงน้อยลง" : `ดูรูปทั้งหมด (+${hiddenAvatarCount})`}
              </button>
            </div>
          )}
        </fieldset>

        {/* สรุปข้อผิดพลาดให้โปรแกรมอ่านหน้าจอประกาศเมื่อกดส่ง (ข้อ 8.1) */}
        <p role="status" aria-live="polite" className="sr-only">
          {pinError || nameError ? "กรอกข้อมูลไม่ครบ กรุณาแก้ไขช่องที่แสดงข้อผิดพลาด" : ""}
        </p>

        {formError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-error-container px-4 py-3 text-body-md text-on-error-container"
          >
            <ErrorIcon className="mt-1 h-5 w-5 shrink-0" />
            {formError}
          </div>
        )}

        {/* ปุ่มส่งเต็มความกว้างของฟอร์ม เรียง [ยืนยัน] [ยกเลิก] จากซ้าย (ui-design-system.md ข้อ 8.1) */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            aria-busy={loading}
            className={`${primaryButtonClass} w-full sm:flex-1 ${loading ? "btn-loading" : ""}`}
          >
            <span className="btn-text flex items-center gap-2">
              <SportsEsportsIcon className="h-4 w-4" />
              เข้าร่วมเกม
            </span>
            <span className="dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
          {!guest && (
            <Link href="/" className={`${secondaryButtonClass} w-full sm:flex-1`}>
              ยกเลิก
            </Link>
          )}
        </div>
      </form>
      {signedInAs && <form id="join-switch-account" method="post" action={logoutUrl()} hidden />}
    </div>
  );
}
