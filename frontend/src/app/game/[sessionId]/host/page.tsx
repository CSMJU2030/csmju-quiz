// src/app/game/[sessionId]/host/page.tsx
"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Icon,
  EmojiEventsIcon,
  ErrorIcon,
  GroupIcon,
  CheckCircleIcon,
  CheckIcon,
  DeleteIcon,
  LeaderboardIcon,
  PlayArrowIcon,
  CloseIcon,
} from "@/components/icons";
import { ConfirmDeleteModal } from "@/components/shared/modal";
import { ConnectionBanner, RankIcon, StatusBadge, rankStyle } from "@/components/game/ui";
import { EmptyState, PageSkeleton } from "@/components/shared/states";
import {
  iconDangerButtonClass,
  primaryButtonClass,
  secondaryButtonClass,
  staggerClass,
} from "@/components/shared/ui";
import { formatNumber } from "@/lib/format";
import { PodiumView } from "@/components/game/podium-view";
import { PlayerAvatar, PlayerIdentity } from "@/components/game/player-avatar";
import type { GamePlayerView } from "@/lib/api-types";
import {
  TIMING,
  advanceGame,
  countdownValue as countdownOf,
  deleteGame,
  gameErrorMessage,
  getGameState,
  isFatalLoadError,
  isLastQuestion,
  removePlayer,
  remainingMs as remainingOf,
  startDelayMs as startDelayOf,
  startGame,
  useGameState,
  useServerClock,
} from "@/lib/game-api";
import { answerTheme } from "@/components/game/answer-theme";
import { AnswerBadge } from "@/components/game/question-view";

// หน้าจอผู้ดำเนินเกม — เฟสและเวลาทั้งหมด backend เป็นผู้เลื่อน (ปิดแท็บนี้เกมก็ยังเดินต่อ)
// ปุ่มบนหน้านี้แค่สั่ง "เริ่ม" และ "ข้าม" (advance) ไปเฟสถัดไปก่อนหมดเวลา
export default function HostPage() {
  const params = useParams();

  const sessionId = Array.isArray(params.sessionId)
    ? params.sessionId[0]
    : String(params.sessionId ?? "");

  const { state: game, error: loadError, loading, accept, serverNow } = useGameState(sessionId);
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [kicking, setKicking] = useState<GamePlayerView | null>(null);
  const [closing, setClosing] = useState(false);
  const router = useRouter();
  // ลิงก์ของ QR สร้างหลัง mount (ต้องรู้ origin ของหน้าเว็บ)
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setOrigin(window.location.origin), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const phase = game?.phase ?? "";

  // นาฬิกาเดินเฉพาะช่วงที่ต้องจับเวลา (ข้อคำถาม · เฉลย · อันดับ)
  const now = useServerClock(
    serverNow,
    200,
    phase === "QUESTION" || phase === "RESULT" || phase === "LEADERBOARD",
  );

  const questionIndex = game?.currentQuestionIndex ?? 0;
  const total = game?.totalQuestions ?? 0;
  const question = game?.question ?? null;
  const isLast = isLastQuestion(game);
  const durationSec = Math.max(1, question?.timeLimit ?? 20);
  const remainingMs = remainingOf(game, now);
  // เผื่อนาฬิกาหน้าจอช้ากว่าเวลาจริงเล็กน้อย (ไม่ให้ขึ้นนับถอยหลังแวบตอนเริ่มข้อปกติ)
  const rawStartDelay = startDelayOf(game, now);
  const startDelayMs = rawStartDelay > TIMING.START_TOLERANCE_MS ? rawStartDelay : 0;
  const secondsLeft = phase === "QUESTION" ? Math.ceil(remainingMs / 1000) : 0;

  const players: GamePlayerView[] = game?.players ?? [];
  const answeredCount = game?.answeredCount ?? 0;
  const everyoneAnswered = players.length > 0 && answeredCount >= players.length;
  const distribution = game?.distribution ?? {};
  const countdownValue = startDelayMs > 0 ? null : countdownOf(game, now);
  const COUNTDOWN_MAX = TIMING.COUNTDOWN_MAX_SEC;

  const answerProgress =
    players.length > 0 ? Math.min(100, (answeredCount / players.length) * 100) : 0;

  const questionProgress =
    durationSec > 0 ? Math.min(100, Math.max(0, (remainingMs / (durationSec * 1000)) * 100)) : 0;

  const lobbyTimeText =
    game?.settings.timeLimitOverride != null
      ? `ข้อละ ${game.settings.timeLimitOverride} วินาที`
      : "เวลาตามที่ตั้งไว้แต่ละข้อ";

  /** สั่ง backend แล้วแสดงสถานะที่ได้กลับมาทันที (SSE จะตามมาอีกทาง) */
  const run = async (action: () => Promise<Parameters<typeof accept>[0]>) => {
    if (busy) return;
    setBusy(true);
    setActionError("");
    try {
      accept(await action());
    } catch (err) {
      setActionError(gameErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleStart = () => {
    if (phase !== "LOBBY" || total === 0 || players.length === 0) return;
    void run(() => startGame(sessionId));
  };

  /** นำผู้เล่นออกจากห้อง — บัตรเข้าห้องของคนนั้นใช้ไม่ได้ทันที */
  const handleKick = async () => {
    if (!kicking) return;
    const target = kicking;
    await run(async () => {
      await removePlayer(sessionId, target.id);
      return getGameState(sessionId);
    });
    setKicking(null);
  };

  /** ปิดห้อง (ลบห้อง) — บัตรเข้าห้องของผู้เล่นทุกคนใช้ไม่ได้ทันที */
  const handleClose = async () => {
    if (busy) return;
    setBusy(true);
    setActionError("");
    try {
      await deleteGame(sessionId);
      router.replace("/dashboard");
    } catch (err) {
      setActionError(gameErrorMessage(err));
      setBusy(false);
      setClosing(false);
    }
  };

  /** ข้ามไปเฟสถัดไป: รับคำตอบ → เฉลย · เฉลย → อันดับ · อันดับ → ข้อถัดไป/ประกาศผล */
  const handleAdvance = () => void run(() => advanceGame(sessionId));

  // ดึงสถานะพลาดชั่วคราว (เน็ตกระตุก) → เกมยังอยู่บนจอพร้อมแถบแจ้ง · เต็มหน้าเฉพาะยังไม่มีเกมหรือแก้ไม่ได้
  const fatalError = loadError && (!game || isFatalLoadError(loadError)) ? loadError : null;
  const error = fatalError?.message ?? "";
  const connectionBanner = (
    <ConnectionBanner show={!!loadError && !fatalError} className="mx-auto mb-4 max-w-4xl" />
  );

  // จบเกม → เปลี่ยน URL ให้รีเฟรช/แชร์ลิงก์ผลได้ (แสดงผลต่อในหน้านี้ทันที)
  useEffect(() => {
    if (phase !== "PODIUM") return;
    const target = `/game/${sessionId}/podium`;
    if (window.location.pathname !== target) window.history.replaceState(null, "", target);
  }, [phase, sessionId]);

  if (loading) {
    return <PageSkeleton label="กำลังโหลดเกม" />;
  }

  if (error || !game) {
    return (
      <div role="alert">
        <EmptyState
          icon={ErrorIcon}
          title="โหลดเกมไม่สำเร็จ"
          description={error || "ไม่พบข้อมูลที่คุณกำลังค้นหา อาจถูกลบไปแล้วหรือลิงก์ไม่ถูกต้อง"}
          action={
            <>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className={primaryButtonClass}
              >
                ลองอีกครั้ง
              </button>
              <Link href="/quiz" className={secondaryButtonClass}>
                กลับไปแบบทดสอบของฉัน
              </Link>
            </>
          }
        />
      </div>
    );
  }

  if (game.viewer !== "HOST") {
    return (
      <div role="alert">
        <EmptyState
          icon={ErrorIcon}
          title="เฉพาะผู้ดำเนินเกม"
          description="หน้านี้สำหรับผู้เปิดห้องเท่านั้น ผู้เล่นให้เข้าร่วมจากหน้าเล่นเกม"
          action={
            <Link href={`/game/${sessionId}/play`} className={primaryButtonClass}>
              ไปหน้าเล่นเกม
            </Link>
          }
        />
      </div>
    );
  }

  const actionAlert = actionError ? (
    <p role="alert" className="mt-3 text-center text-label-md text-error">
      {actionError}
    </p>
  ) : null;

  if (phase === "LOBBY") {
    return (
      <div key={`${phase}-${questionIndex}`} className="fade-slide-up">
        {connectionBanner}
        <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center">
          <div className="w-full text-center">
            <h1 className="mt-2 text-headline-md font-bold text-on-surface sm:text-headline-lg font-display">
              พร้อมเริ่มเกม
            </h1>

            <p className="mx-auto mt-2 max-w-lg text-body-md text-on-surface-variant">
              รอผู้เล่นเข้าร่วม แล้วเริ่มการแข่งขันเมื่อพร้อม
            </p>

            <h2 className="mx-auto mt-4 max-w-2xl wrap-break-word text-body-lg font-bold text-on-surface sm:text-headline-md font-display">
              {game.quizTitle}
            </h2>

            <p className="mt-1 text-body-md text-on-surface-variant tabular-nums">
              {total} คำถาม · {lobbyTimeText}
            </p>
          </div>

          <div className="relative mt-6 w-full max-w-md overflow-hidden rounded-xl border border-primary-container/20 bg-surface-container-lowest p-5 shadow-md sm:p-7">
            <div className="relative rounded-xl border border-primary-container/20 bg-primary-container/10 px-5 py-7 text-center sm:py-8">
              <p className="text-label-md text-primary-container">รหัสเกม</p>

              <p className="mt-3 font-display text-display-lg text-primary tabular-nums">
                {game.gamePin}
              </p>

              <p className="mt-3 text-body-md text-primary-container">
                ให้ผู้เล่นสแกน QR หรือเปิดหน้าเข้าร่วมเกมแล้วกรอกรหัสนี้
              </p>
            </div>

            {origin && (
              <figure className="mt-5 flex flex-col items-center gap-3 text-center">
                <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3">
                  <QRCodeSVG
                    value={`${origin}/play?pin=${game.gamePin}`}
                    size={192}
                    level="M"
                    title={`QR สำหรับเข้าร่วมเกม รหัส ${game.gamePin}`}
                  />
                </div>
                <figcaption className="text-body-md text-on-surface-variant">
                  สแกนเพื่อเข้าร่วม ไม่ต้องเข้าสู่ระบบ
                  <span className="mt-1 block text-label-sm text-on-surface-variant">
                    ผู้ที่มีบัญชี MJU เลือกเข้าร่วมด้วยบัญชีได้ในหน้าที่เปิดขึ้น
                  </span>
                  <span className="mt-1 block text-label-sm text-on-surface-variant">
                    หรือเปิด {origin}/play แล้วกรอกรหัสเกม
                  </span>
                </figcaption>
              </figure>
            )}
          </div>

          <section className="mt-6 w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-sm sm:p-7">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex items-center gap-2">
                <Icon icon={GroupIcon} className="h-4 w-4 text-primary-container" />
              </div>

              <h2 className="font-display text-headline-md text-on-surface">ผู้เล่นในห้อง</h2>

              <div className="mt-1 rounded-full bg-primary-container/10 px-3 py-1 text-label-sm font-bold text-primary-container">
                {players.length} คน
              </div>
            </div>

            <div className="mx-auto mt-6 grid w-full max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {players.map((player, index) => (
                <PlayerLobbyCard
                  key={player.id}
                  player={player}
                  index={index}
                  onRemove={() => setKicking(player)}
                />
              ))}

              {players.length === 0 && (
                <div className="col-span-full flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant bg-surface px-6 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-surface-container-lowest text-outline shadow-sm">
                    <Icon icon={GroupIcon} className="h-6 w-6" />
                  </div>

                  <p className="mt-4 text-label-md font-bold text-on-surface-variant">
                    ยังไม่มีผู้เล่น
                  </p>

                  <p className="mt-1 text-caption text-secondary">รอผู้เล่นเข้าร่วมด้วยรหัสเกม</p>
                </div>
              )}
            </div>
          </section>

          <button
            type="button"
            onClick={handleStart}
            disabled={players.length === 0 || total === 0 || busy}
            aria-busy={busy}
            aria-describedby={
              players.length === 0 || total === 0 ? "start-disabled-reason" : undefined
            }
            className={`${primaryButtonClass} mt-6 w-full max-w-md`}
          >
            <PlayArrowIcon className="h-4 w-4" />
            เริ่มเกม
          </button>
          {(players.length === 0 || total === 0) && (
            <p id="start-disabled-reason" className="mt-2 text-caption text-on-surface-variant">
              {total === 0
                ? "แบบทดสอบนี้ยังไม่มีคำถาม"
                : "ต้องมีผู้เล่นอย่างน้อย 1 คนจึงเริ่มเกมได้"}
            </p>
          )}
          <button
            type="button"
            onClick={() => setClosing(true)}
            disabled={busy}
            className={`${secondaryButtonClass} mt-3 w-full max-w-md`}
          >
            <DeleteIcon className="h-4 w-4" />
            ปิดห้อง
          </button>
          {actionAlert}
        </div>
        <ConfirmDeleteModal
          open={closing}
          title="ปิดห้อง"
          itemName={`ห้องรหัส ${game.gamePin}`}
          consequence="จะถูกลบทันที ผู้เล่นทุกคนในห้องจะออกจากห้อง และบัตรเข้าห้องใช้ไม่ได้อีก"
          confirmLabel="ปิดห้อง"
          busy={busy}
          onCancel={() => setClosing(false)}
          onConfirm={() => void handleClose()}
        />
        <ConfirmDeleteModal
          open={kicking !== null}
          title="นำผู้เล่นออก"
          itemName={`“${kicking?.nickname ?? ""}”`}
          consequence="จะถูกนำออกจากห้องนี้ทันที หากจะเล่นต่อต้องเข้าร่วมด้วยรหัสเกมอีกครั้ง"
          confirmLabel="นำผู้เล่นออก"
          busy={busy}
          onCancel={() => setKicking(null)}
          onConfirm={() => void handleKick()}
        />
      </div>
    );
  }

  if (phase === "QUESTION") {
    const answerStatus =
      countdownValue !== null
        ? "กำลังปิดรับคำตอบ"
        : secondsLeft <= 0
          ? "หมดเวลา"
          : everyoneAnswered
            ? "ทุกคนตอบแล้ว"
            : "กำลังรับคำตอบ";

    const answerStatusClass =
      countdownValue !== null
        ? "bg-brand-amber/15 text-on-surface"
        : secondsLeft <= 5
          ? "bg-error-container text-error"
          : everyoneAnswered
            ? "bg-success/10 text-on-surface"
            : "bg-primary-container/10 text-primary-container";

    return (
      <div key={`${phase}-${questionIndex}`} className="fade-slide-up">
        {connectionBanner}
        <div className="relative z-10 mx-auto w-full max-w-6xl">
          <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 text-center lg:text-left">
                <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                  <span className="rounded-full bg-primary-container/10 px-3 py-1 text-label-sm font-bold text-primary-container">
                    ข้อ {questionIndex + 1} / {total}
                  </span>

                  <span
                    className={`rounded-full px-3 py-1 text-label-sm font-bold ${answerStatusClass}`}
                  >
                    {answerStatus}
                  </span>
                </div>

                <h1 className="mx-auto mt-4 max-w-3xl wrap-break-word text-headline-md font-bold text-on-surface sm:text-headline-md lg:mx-0 font-display">
                  {question?.prompt ?? "กำลังโหลดคำถาม..."}
                </h1>
                {question?.imageUrl && (
                  <Image
                    src={question.imageUrl}
                    alt="ภาพประกอบคำถาม"
                    width={640}
                    height={360}
                    unoptimized
                    className="mx-auto mt-4 h-auto max-h-56 w-auto rounded-xl object-contain lg:mx-0"
                  />
                )}
              </div>

              <div className="flex shrink-0 items-center justify-center gap-4">
                <div className="text-center sm:text-right">
                  <p className="text-label-md text-on-surface-variant">ตอบแล้ว</p>

                  <p className="mt-1 text-body-lg font-bold text-on-surface">
                    {answeredCount}
                    <span className="font-semibold text-outline">/{players.length}</span>
                  </p>
                </div>

                <div
                  role="timer"
                  aria-label={`เหลือเวลา ${secondsLeft} วินาที`}
                  className={`flex h-20 w-20 items-center justify-center rounded-full border-4 bg-surface-container-lowest text-headline-md tabular-nums ${
                    secondsLeft <= 5
                      ? "border-error/30 text-error"
                      : "border-primary-container/20 text-primary-container"
                  } font-display`}
                >
                  {secondsLeft}
                </div>
              </div>
            </div>

            <div className="mt-5 h-2 overflow-hidden rounded-full bg-surface-container">
              <div
                className={`h-full rounded-full transition duration-200 ${
                  secondsLeft <= 5 ? "bg-error" : "bg-primary-container"
                }`}
                style={{
                  width: `${questionProgress}%`,
                }}
              />
            </div>
          </div>

          {players.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
              {players.slice(0, 18).map((player) => (
                <PlayerMiniAvatar key={player.id} player={player} done={player.hasAnswered} />
              ))}

              {players.length > 18 && (
                <span className="rounded-full bg-surface-container-lowest px-3 py-1.5 text-label-sm font-bold text-secondary shadow-sm ring-1 ring-outline-variant/40">
                  +{players.length - 18}
                </span>
              )}
            </div>
          )}

          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            <section className="min-w-0 lg:col-span-2 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-sm sm:p-7">
              <div className="mb-5 text-center">
                <h2 className="font-display text-headline-md text-on-surface">ตัวเลือกคำตอบ</h2>

                <p className="mt-1 text-body-md text-on-surface-variant">
                  จำนวนคำตอบอัปเดตอัตโนมัติ
                </p>
              </div>

              <div className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-2">
                {Array.isArray(question?.options) &&
                  question.options.map((option, index) => {
                    const count = distribution[option.id] ?? 0;

                    const theme = answerTheme(index);

                    const percent =
                      answeredCount > 0 ? Math.round((count / answeredCount) * 100) : 0;

                    return (
                      <div key={option.id} className={`rounded-xl p-4 ${theme.fill}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 gap-3">
                            <theme.Icon className="mt-0.5 h-8 w-8 shrink-0" />
                            <span className="sr-only">
                              ตัวเลือกที่ {index + 1} ({theme.label})
                            </span>

                            <p className="min-w-0 wrap-break-word pt-1 text-body-lg font-bold text-on-primary">
                              {option.text}
                            </p>
                          </div>

                          <span className="shrink-0 rounded-full bg-surface-container-lowest px-2.5 py-1 text-label-sm text-on-surface tabular-nums">
                            {count}
                          </span>
                        </div>

                        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-on-primary/30">
                          <div
                            className={`h-full rounded-full transition duration-300 bg-on-primary`}
                            style={{
                              width: `${percent}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>

              <div className="mx-auto mt-6 flex max-w-4xl flex-wrap justify-center gap-2.5 border-t border-outline-variant/40 pt-5">
                <button
                  type="button"
                  onClick={handleAdvance}
                  disabled={busy || startDelayMs > 0}
                  aria-busy={busy}
                  className={primaryButtonClass}
                >
                  ปิดรับคำตอบและเฉลย
                </button>
              </div>
              {actionAlert}
            </section>

            <section className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-sm sm:p-6">
              <div className="text-center">
                <h2 className="font-display text-headline-md text-on-surface">คำตอบที่ได้รับ</h2>

                <p className="mt-3 font-display text-display-lg text-primary-container tabular-nums">
                  {answeredCount}
                  <span className="text-headline-md text-outline font-display">
                    /{players.length}
                  </span>
                </p>

                <div className="mx-auto mt-4 h-2 max-w-xs overflow-hidden rounded-full bg-surface-container">
                  <div
                    className="h-full rounded-full bg-success transition-[width] duration-300"
                    style={{
                      width: `${answerProgress}%`,
                    }}
                  />
                </div>

                <p className="mt-2 text-label-sm font-semibold text-secondary">
                  {everyoneAnswered
                    ? "ทุกคนตอบแล้ว"
                    : `เหลืออีก ${Math.max(0, players.length - answeredCount)} คน`}
                </p>
              </div>

              <div className="mt-6 max-h-90 space-y-2 overflow-y-auto pr-1">
                {players.map((player) => {
                  const answered = player.hasAnswered;

                  return (
                    <div
                      key={player.id}
                      className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 ${
                        answered ? "bg-success/10" : "bg-surface"
                      }`}
                    >
                      <PlayerIdentity
                        avatarIndex={player.avatarIndex}
                        nickname={player.nickname}
                        size="sm"
                        nameClassName="text-label-md font-bold text-on-surface"
                      />

                      <span
                        className={`inline-flex shrink-0 items-center gap-1 text-label-sm font-bold ${
                          answered ? "text-on-surface" : "text-on-surface-variant"
                        }`}
                      >
                        {answered && <CheckIcon className="h-4 w-4 text-success" />}
                        {answered ? "ตอบแล้ว" : "ยังไม่ตอบ"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>

        {startDelayMs > 0 ? (
          <CountdownOverlay
            value={Math.min(COUNTDOWN_MAX, Math.ceil(startDelayMs / 1000))}
            label="เริ่มคำถามแรกใน"
          />
        ) : (
          countdownValue !== null && (
            <CountdownOverlay value={countdownValue} label="ปิดรับคำตอบใน" />
          )
        )}
      </div>
    );
  }

  if (phase === "RESULT") {
    const correctOption = question?.options.find((option) => option.isCorrect) ?? null;

    return (
      <div key={`${phase}-${questionIndex}`} className="fade-slide-up">
        {connectionBanner}
        <div className="relative z-10 mx-auto w-full max-w-4xl">
          <SimpleHeader title="เฉลยคำตอบ" subtitle={`คำถามที่ ${questionIndex + 1} จาก ${total}`} />

          <section className="mt-6 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-6 text-center shadow-sm sm:p-8">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
              <CheckCircleIcon className="h-6 w-6" />
            </span>

            <p className="mt-5 text-label-md font-semibold text-on-surface-variant">
              คำตอบที่ถูกต้องคือ
            </p>

            <p className="mx-auto mt-2 max-w-2xl wrap-break-word font-display text-headline-md text-on-surface">
              {correctOption?.text ?? "ไม่มีข้อมูล"}
            </p>

            <div className="mx-auto mt-7 grid max-w-3xl gap-3 sm:grid-cols-2">
              {Array.isArray(question?.options) &&
                question.options.map((option, index) => {
                  const count = distribution[option.id] ?? 0;

                  const percent = answeredCount > 0 ? Math.round((count / answeredCount) * 100) : 0;

                  return (
                    <div
                      key={option.id}
                      className={`rounded-xl border border-l-8 p-4 text-left ${answerTheme(index).edge} ${
                        option.isCorrect
                          ? "border-success bg-success/10"
                          : "border-outline-variant/40 bg-surface-container-lowest"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <AnswerBadge index={index} />

                          <p className="min-w-0 wrap-break-word text-label-md font-bold text-on-surface">
                            {option.text}
                          </p>
                          {option.isCorrect && <span className="sr-only">คำตอบที่ถูก</span>}
                          {option.isCorrect && (
                            <CheckCircleIcon className="h-5 w-5 shrink-0 text-success" />
                          )}
                        </div>

                        <span className="shrink-0 text-label-md font-bold text-on-surface-variant">
                          {count}
                        </span>
                      </div>

                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-variant">
                        <div
                          className={`h-full rounded-full transition-[width] duration-300 ${answerTheme(index).fill}`}
                          style={{
                            width: `${percent}%`,
                          }}
                        />
                      </div>

                      <p className="mt-1.5 text-right text-label-sm font-bold text-secondary">
                        {percent}%
                      </p>
                    </div>
                  );
                })}
            </div>

            <button
              type="button"
              onClick={handleAdvance}
              disabled={busy}
              aria-busy={busy}
              className={`${primaryButtonClass} mt-6`}
            >
              <LeaderboardIcon className="h-4 w-4" />
              ดูอันดับคะแนน
            </button>
            {actionAlert}
          </section>
        </div>
      </div>
    );
  }

  if (phase === "LEADERBOARD") {
    return (
      <div key={`${phase}-${questionIndex}`} className="fade-slide-up">
        {connectionBanner}
        <div className="relative z-10 mx-auto w-full max-w-4xl">
          <SimpleHeader
            title="อันดับคะแนน"
            subtitle={`หลังจบข้อ ${questionIndex + 1} จาก ${total}`}
          />

          <section className="mt-6 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-sm sm:p-7">
            <div className="space-y-3">
              {players.slice(0, 5).map((player, index) => {
                return (
                  <div
                    key={player.id}
                    className={`flex items-center gap-4 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4 fade-slide-up ${staggerClass(index)}`}
                  >
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-label-md font-bold ${rankStyle(player.rank)}`}
                    >
                      <RankIcon place={player.rank} />
                    </div>

                    <PlayerIdentity
                      avatarIndex={player.avatarIndex}
                      nickname={player.nickname}
                      size="md"
                      highlight={player.rank === 1}
                      nameClassName="text-label-md font-bold text-on-surface sm:text-body-md"
                      className="flex-1"
                    />

                    <p className="shrink-0 font-display text-headline-md text-primary-container tabular-nums">
                      {formatNumber(player.score)}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={handleAdvance}
                disabled={busy}
                aria-busy={busy}
                className={`${primaryButtonClass} w-full max-w-sm`}
              >
                {isLast ? "จบเกมและประกาศผล" : `ไปข้อที่ ${questionIndex + 2}`}
              </button>
            </div>
            {actionAlert}
          </section>
        </div>

        {countdownValue !== null && (
          <CountdownOverlay value={countdownValue} label={isLast ? "ประกาศผลใน" : "ข้อถัดไปใน"} />
        )}
      </div>
    );
  }

  if (phase === "PODIUM") {
    return <PodiumView game={game} sessionId={sessionId} viewer={{ role: "host" }} />;
  }

  return (
    <div role="status">
      <EmptyState icon={EmojiEventsIcon} title="จบเกมแล้ว" description="กำลังเตรียมผลการแข่งขัน" />
    </div>
  );
}

function PlayerLobbyCard({
  player,
  index,
  onRemove,
}: {
  player: GamePlayerView;
  index: number;
  onRemove: () => void;
}) {
  return (
    <div
      className={`rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4 fade-slide-up ${staggerClass(index)}`}
    >
      <div className="flex items-center gap-3">
        <PlayerIdentity
          avatarIndex={player.avatarIndex}
          nickname={player.nickname}
          size="lg"
          nameClassName="text-body-md font-bold text-on-surface"
          className="flex-1"
        />

        <StatusBadge tone="success">พร้อม</StatusBadge>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`นำ ${player.nickname} ออกจากห้อง`}
          className={iconDangerButtonClass}
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

/** ไอคอนผู้เล่นแถวบนระหว่างรับคำตอบ — ขอบเขียว + เครื่องหมายถูกเมื่อตอบแล้ว */
function PlayerMiniAvatar({ player, done }: { player: GamePlayerView; done: boolean }) {
  return (
    <div
      title={player.nickname}
      className={`relative rounded-full p-0.5 ${done ? "bg-success" : "bg-surface-variant"}`}
    >
      <PlayerAvatar
        avatarIndex={player.avatarIndex}
        nickname={player.nickname}
        size="sm"
        className="rounded-full"
      />
      <span className="sr-only">
        {player.nickname} {done ? "ตอบแล้ว" : "ยังไม่ตอบ"}
      </span>

      {done && (
        <span
          aria-hidden="true"
          className="absolute -bottom-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-surface-container-lowest bg-success text-on-surface animate-pop"
        >
          <CheckIcon className="h-4 w-4" />
        </span>
      )}
    </div>
  );
}

function SimpleHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="w-full text-center">
      <h1 className="font-display text-headline-md text-on-surface md:text-headline-lg">{title}</h1>
      <p className="mx-auto mt-1 max-w-xl text-body-md text-on-surface-variant">{subtitle}</p>
    </header>
  );
}

function CountdownOverlay({ value, label }: { value: number; label: string }) {
  return (
    <div
      role="status"
      aria-live="assertive"
      className="fixed inset-0 z-50 grid place-items-center bg-surface-container-lowest/95 px-6 fade-slide-up"
    >
      <div className="text-center">
        <p className="text-label-md text-primary-container">{label}</p>
        <p
          key={value}
          className="mt-4 animate-pop font-display text-display-lg text-primary-container tabular-nums"
        >
          {value}
        </p>
        <p className="mt-3 text-body-md text-on-surface-variant">เตรียมตัว</p>
      </div>
    </div>
  );
}
