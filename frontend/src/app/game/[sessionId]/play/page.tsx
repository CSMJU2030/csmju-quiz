"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowDownwardIcon,
  ArrowUpwardIcon,
  CheckIcon,
  CloseIcon,
  EmojiEventsIcon,
  GroupIcon,
  LocalFireDepartmentIcon,
  PersonIcon,
  PlayArrowIcon,
  QuizIcon,
  RefreshIcon,
  ScheduleIcon,
  TrackChangesIcon,
  VolumeOffIcon,
  VolumeUpIcon,
  WarningIcon,
  type IconComponent,
} from "@/components/icons";
import { EmptyState, PageSkeleton } from "@/components/shared/states";
import {
  iconRoundButtonClass,
  staggerClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/shared/ui";
import { formatNumber } from "@/lib/format";
import { PodiumView } from "@/components/game/podium-view";
import { ConnectionBanner, RankIcon } from "@/components/game/ui";
import { PlayerAvatar, PlayerIdentity } from "@/components/game/player-avatar";
import {
  AnswerOptionButton,
  QuestionPrompt,
  TimerRing,
  AnswerBadge,
} from "@/components/game/question-view";
import type { GamePlayerView } from "@/lib/api-types";
import type { QuestionOption } from "@/types/quiz";
import { useSfx, vibrate } from "@/hooks/use-sfx";
import {
  TIMING,
  countdownValue as countdownOf,
  gameErrorMessage,
  isFatalLoadError,
  isLastQuestion,
  remainingMs as remainingOf,
  startDelayMs as startDelayOf,
  submitAnswer,
  toQuestionOptions,
  useGameState,
  useServerClock,
} from "@/lib/game-api";
import { clamp } from "@/lib/play-engine";
import { answerTheme } from "@/components/game/answer-theme";
import { CountUp, RankRow } from "@/components/game/live-motion";
import { playerLinks, useGameChannel } from "@/lib/game-channel";

type IconName =
  | "question"
  | "volume"
  | "volumeOff"
  | "check"
  | "x"
  | "clock"
  | "trophy"
  | "fire"
  | "play"
  | "users"
  | "arrowUp"
  | "arrowDown"
  | "alert"
  | "refresh"
  | "user"
  | "target";

const ICONS: Record<IconName, IconComponent> = {
  question: QuizIcon,
  volume: VolumeUpIcon,
  volumeOff: VolumeOffIcon,
  check: CheckIcon,
  x: CloseIcon,
  clock: ScheduleIcon,
  trophy: EmojiEventsIcon,
  fire: LocalFireDepartmentIcon,
  play: PlayArrowIcon,
  users: GroupIcon,
  arrowUp: ArrowUpwardIcon,
  arrowDown: ArrowDownwardIcon,
  alert: WarningIcon,
  refresh: RefreshIcon,
  user: PersonIcon,
  target: TrackChangesIcon,
};

/** ไอคอนจากชุดกลาง (ui-design-system.md ข้อ 14) — ขนาด 16 / 20 / 24 เท่านั้น */
function Icon({
  name,
  size = 20,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  const Glyph = ICONS[name];
  const sizeClass = size <= 16 ? "h-4 w-4" : size <= 20 ? "h-5 w-5" : "h-6 w-6";
  return <Glyph className={`${sizeClass} ${className}`} />;
}

/** อัตรารีเฟรชนาฬิกา — ตรงกับ transition ของวงเวลา (question-view.tsx) */
const TICK_MS = 200;

export default function PlayPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const { play, muted, toggle, unlock } = useSfx();
  const channel = useGameChannel();
  const links = playerLinks(channel, sessionId);

  const { state: game, error: loadError, loading, refresh, serverNow } = useGameState(sessionId);
  const [selected, setSelected] = useState<{ index: number; optionId: string } | null>(null);
  const [answerError, setAnswerError] = useState("");

  const prevPhaseRef = useRef("");
  const prevIndexRef = useRef(-1);
  const lastTickRef = useRef(-1);
  const submittingRef = useRef(false);

  const phase = game?.phase ?? "";
  // นาฬิกาเดินเฉพาะช่วงที่มีการนับเวลา — ช่วงรอเริ่มและประกาศผลไม่ต้องวาดหน้าใหม่
  const now = useServerClock(
    serverNow,
    TICK_MS,
    phase === "QUESTION" || phase === "RESULT" || phase === "LEADERBOARD",
  );
  const questionIndex = game?.currentQuestionIndex ?? 0;
  const question = game?.question ?? null;
  const totalQuestions = game?.totalQuestions ?? 0;
  const options = useMemo(() => toQuestionOptions(question?.options), [question]);

  const durationSec = Math.max(1, question?.timeLimit ?? 20);
  const remainingMs = remainingOf(game, now);
  /** นับถอยหลังก่อนเริ่มข้อ (ข้อแรก) */
  const startDelayMs = startDelayOf(game, now);
  // เผื่อนาฬิกาหน้าจอช้ากว่าเวลาจริง ไม่ให้ขึ้นนับถอยหลังแวบตอนเริ่มข้อปกติ
  const waitingToStart = startDelayMs > TIMING.START_TOLERANCE_MS;

  const secondsLeft = Math.ceil(remainingMs / 1000);
  const timeRatio = clamp(remainingMs / (durationSec * 1000), 0, 1);

  const activePlayers: GamePlayerView[] = useMemo(() => game?.players ?? [], [game]);
  const answeredIds = useMemo(
    () => new Set(activePlayers.filter((p) => p.hasAnswered).map((p) => p.id)),
    [activePlayers],
  );
  const answeredCount = game?.answeredCount ?? 0;
  const totalPlayers = Math.max(game?.playerCount ?? 0, answeredCount);
  const everyoneAnswered = totalPlayers > 0 && answeredCount >= totalPlayers;

  const me = game?.me ?? null;
  const playerId = me?.playerId ?? "";
  const myAnswer = me?.answer ?? null;
  const localPick = selected && selected.index === questionIndex ? selected.optionId : null;
  const myOptionId = localPick ?? myAnswer?.optionId ?? null;
  const answered = myOptionId !== null;
  // ถูก/ผิดมาจาก server หลังเฉลยเท่านั้น
  const isCorrect = myAnswer?.isCorrect === true;
  const gained = myAnswer?.points ?? 0;
  const streak = me?.streak ?? 0;

  const ranking = useMemo(
    () =>
      activePlayers.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        avatarIndex: p.avatarIndex,
        score: p.score,
        rank: p.rank,
      })),
    [activePlayers],
  );

  const myAvatar = me?.avatarIndex ?? null;
  const myNickname = me?.nickname ?? "ผู้เล่น";
  const myRank = me?.rank ?? 0;
  const score = me?.score ?? 0;

  // เก็บอันดับก่อนเริ่มข้อ — ปรับ state ระหว่าง render (แทนการอ่าน ref ระหว่าง render)
  const [round, setRound] = useState<{
    index: number;
    prevRanks: Record<string, number>;
    prevScores: Record<string, number>;
  }>({ index: -1, prevRanks: {}, prevScores: {} });
  if (phase === "QUESTION" && round.index !== questionIndex) {
    setRound({
      index: questionIndex,
      prevRanks: Object.fromEntries(ranking.map((p) => [p.id, p.rank])),
      prevScores: Object.fromEntries(ranking.map((p) => [p.id, p.score])),
    });
  }
  const myPrevRank = round.prevRanks[playerId] ?? myRank;

  const distribution = game?.distribution ?? {};

  const countdownValue = waitingToStart
    ? Math.min(TIMING.COUNTDOWN_MAX_SEC, Math.ceil(startDelayMs / 1000))
    : countdownOf(game, now);
  const isLast = isLastQuestion(game);
  const countdownLabel = waitingToStart
    ? "เริ่มคำถามแรกใน"
    : phase === "QUESTION"
      ? "ปิดรับคำตอบใน"
      : isLast
        ? "ประกาศผลใน"
        : "ข้อถัดไปใน";

  useEffect(() => {
    if (!phase) return;

    const changedPhase = prevPhaseRef.current !== phase;

    const changedIndex = prevIndexRef.current !== questionIndex;

    if (phase === "QUESTION" && (changedPhase || changedIndex)) {
      submittingRef.current = false;
      lastTickRef.current = -1;

      play("start");
      vibrate(40);
    }

    if (phase === "RESULT" && changedPhase) {
      play(isCorrect ? "correct" : "wrong");
      vibrate(isCorrect ? [35, 55, 35] : 200);
    }

    // ผลของข้อและอันดับแสดงบนสุด — เลื่อนกลับขึ้นไปให้เห็นทันที (มือถือมักเลื่อนลงมากดตัวเลือก)
    if ((phase === "RESULT" || phase === "LEADERBOARD") && changedPhase) {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    }

    if (phase === "PODIUM" && changedPhase) {
      play("finish");
    }

    prevPhaseRef.current = phase;
    prevIndexRef.current = questionIndex;
  }, [phase, questionIndex, isCorrect, play]);

  useEffect(() => {
    if (phase !== "QUESTION" || secondsLeft <= 0 || waitingToStart) {
      return;
    }

    if (secondsLeft === lastTickRef.current) {
      return;
    }

    lastTickRef.current = secondsLeft;

    if (secondsLeft <= 5) {
      play("urgent");
      vibrate(25);
    } else if (secondsLeft <= 10) {
      play("tick");
    }
  }, [secondsLeft, phase, play, waitingToStart]);

  useEffect(() => {
    if (countdownValue === null || countdownValue <= 0) {
      return;
    }

    play("count");
    vibrate(30);
  }, [countdownValue, play]);

  // จบเกม → แสดงผลต่อในหน้านี้ทันที (ไม่ต้องรอโหลดหน้าใหม่) แล้วเปลี่ยน URL ให้รีเฟรช/แชร์ลิงก์ได้
  useEffect(() => {
    if (phase !== "PODIUM") return;
    const target = links.podium;
    if (window.location.pathname !== target) window.history.replaceState(null, "", target);
  }, [phase, links.podium]);

  const handleAnswer = useCallback(
    (optionId: string) => {
      if (!game || !question || !me) return;
      if (phase !== "QUESTION" || answered || submittingRef.current) return;
      if (remainingMs <= 0 || waitingToStart) return;

      submittingRef.current = true;
      unlock();
      setAnswerError("");
      setSelected({ index: questionIndex, optionId });
      play("lock");
      vibrate(50);

      submitAnswer(sessionId, optionId, channel)
        .then(() => refresh())
        .catch((err: unknown) => {
          // ระบบไม่รับคำตอบ (เช่น ปิดรับไปแล้ว) → ล้างการเลือก แล้วแจ้งเหตุผล
          setSelected(null);
          setAnswerError(gameErrorMessage(err));
          void refresh();
        })
        .finally(() => {
          submittingRef.current = false;
        });
    },
    [
      game,
      question,
      me,
      phase,
      answered,
      remainingMs,
      waitingToStart,
      questionIndex,
      sessionId,
      channel,
      play,
      unlock,
      refresh,
    ],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!question) return;
      // ไม่แย่งคีย์ลัดของเบราว์เซอร์ (Ctrl/⌘+1 สลับแท็บ) และไม่ตอบเมื่อกำลังพิมพ์ในช่องกรอก
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      )
        return;

      const i = Number.parseInt(e.key, 10) - 1;

      const opt = options[i];

      if (opt) {
        handleAnswer(String(opt.id));
      }
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [question, options, handleAnswer]);

  useEffect(() => {
    const once = () => unlock();

    window.addEventListener("pointerdown", once, { once: true });

    window.addEventListener("keydown", once, { once: true });

    return () => {
      window.removeEventListener("pointerdown", once);

      window.removeEventListener("keydown", once);
    };
  }, [unlock]);

  if (loading) {
    return <PageSkeleton label="กำลังโหลดเกม" />;
  }

  // ห้องถูกปิด · บัตรหมดอายุ · ถูกนำออก — ลองใหม่ไม่ช่วย ให้กลับไปเข้าห้องใหม่
  if (loadError?.kind === "closed") {
    return (
      <div role="alert">
        <EmptyState
          icon={WarningIcon}
          title="ห้องนี้ใช้ต่อไม่ได้แล้ว"
          description={loadError.message}
          action={
            <Link href={links.join} className={primaryButtonClass}>
              เข้าร่วมเกมใหม่
            </Link>
          }
        />
      </div>
    );
  }

  // ดึงสถานะพลาดครั้งเดียว (เน็ตกระตุก) ไม่ต้องล้างหน้าเกม — แสดงเต็มหน้าเฉพาะเมื่อยังไม่มีเกมหรือแก้ไม่ได้
  const fatalError = loadError && (!game || isFatalLoadError(loadError)) ? loadError : null;
  const reconnecting = !!loadError && !fatalError;

  if (fatalError || (game && !me)) {
    return (
      <div role="alert">
        <EmptyState
          icon={WarningIcon}
          title="เข้าเกมไม่สำเร็จ"
          description={
            fatalError?.message ??
            "คุณยังไม่ได้เข้าร่วมห้องนี้ กรุณาเข้าร่วมด้วยรหัสเกมจากหน้าเข้าร่วมเกม"
          }
          action={
            <>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className={primaryButtonClass}
              >
                <RefreshIcon className="h-4 w-4" />
                ลองอีกครั้ง
              </button>
              <Link href={links.join} className={secondaryButtonClass}>
                กลับหน้าเข้าร่วมเกม
              </Link>
            </>
          }
        />
      </div>
    );
  }

  if (!game) {
    return null;
  }

  if (phase === "LOBBY") {
    return (
      <>
        <ConnectionBanner show={reconnecting} className="mx-auto mb-3 max-w-md lg:max-w-xl" />
        <div
          role="status"
          aria-live="polite"
          className="mx-auto max-w-md rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-6 text-center shadow-sm fade-slide-up lg:max-w-xl"
        >
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-container text-primary-container">
            <QuizIcon className="h-6 w-6" />
          </span>
          <h1 className="mt-4 font-display text-headline-md text-on-surface">{game.quizTitle}</h1>
          <p className="mt-2 text-body-md text-on-surface-variant">
            รอผู้ดำเนินเกมเริ่มเกม กรุณาอย่าปิดหน้านี้
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 rounded-xl bg-primary-container/10 px-4 py-5">
            <PlayerAvatar
              avatarIndex={myAvatar}
              nickname={myNickname}
              size="xl"
              highlight
              className="animate-pop"
            />
            <div className="min-w-0 max-w-full">
              <p className="text-label-sm text-on-surface-variant">คุณเข้าร่วมในชื่อ</p>
              <p className="mt-1 truncate font-display text-headline-md text-on-surface">
                {myNickname}
              </p>
            </div>
          </div>
          <p className="mt-6 flex items-center justify-center gap-2 text-body-md text-on-surface-variant tabular-nums">
            <GroupIcon className="h-5 w-5" />
            ผู้เล่นในห้อง {activePlayers.length} คน
          </p>
          <LobbyPlayers players={activePlayers} meId={playerId} />
        </div>
      </>
    );
  }

  if (phase === "PODIUM") {
    return <PodiumView game={game} sessionId={sessionId} viewer={{ role: "player", playerId }} />;
  }

  if (!question) {
    return <PageSkeleton label="กำลังเตรียมคำถาม" />;
  }

  const showResult = phase === "RESULT" || phase === "LEADERBOARD";

  const urgent = phase === "QUESTION" && timeRatio <= 0.25;

  return (
    <>
      <ConnectionBanner show={reconnecting} className="mx-auto mb-3 max-w-3xl lg:max-w-5xl" />
      <div className="mx-auto flex max-w-3xl flex-col overflow-hidden rounded-xl lg:max-w-5xl border border-outline-variant/40 bg-surface-container-lowest shadow-sm fade-slide-up">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/40 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <PlayerIdentity
              avatarIndex={myAvatar}
              nickname={myNickname}
              size="sm"
              highlight
              nameClassName="max-w-32 text-label-md text-on-surface sm:max-w-48"
            />
            <span className="shrink-0 rounded-full bg-primary-container/10 px-2.5 py-1 text-label-sm text-primary-container tabular-nums">
              ข้อ {questionIndex + 1}/{totalQuestions}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {streak >= 2 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-amber/15 px-2.5 py-1 text-label-sm text-on-surface tabular-nums">
                <Icon name="fire" size={16} className="text-brand-amber" />
                ตอบถูกติดกัน {streak} ข้อ
              </span>
            )}

            {myRank > 0 && (
              <span className="rounded-full bg-surface-variant px-2.5 py-1 text-label-sm text-on-surface-variant tabular-nums">
                อันดับ {myRank}
              </span>
            )}

            <span className="rounded-full bg-primary-container px-2.5 py-1 text-label-sm text-on-primary tabular-nums">
              {formatNumber(score)} คะแนน
            </span>

            <button
              type="button"
              onClick={toggle}
              aria-label={muted ? "เปิดเสียง" : "ปิดเสียง"}
              className={iconRoundButtonClass}
            >
              <Icon name={muted ? "volumeOff" : "volume"} size={20} />
            </button>
          </div>
        </header>

        <div
          role="progressbar"
          aria-label="ความคืบหน้าของเกม"
          aria-valuemin={0}
          aria-valuemax={totalQuestions}
          aria-valuenow={questionIndex + 1}
          className="h-1 w-full bg-surface-variant"
        >
          <div
            className="h-full bg-primary-container transition-[width] duration-300"
            style={{
              width: `${((questionIndex + 1) / Math.max(totalQuestions, 1)) * 100}%`,
            }}
          />
        </div>

        {phase === "RESULT" && (
          <ResultHero
            key={`result-${questionIndex}`}
            answered={answered}
            correct={isCorrect}
            gained={gained}
            streak={streak}
          />
        )}

        {phase === "LEADERBOARD" ? (
          <LiveStanding
            key={`standing-${questionIndex}`}
            ranking={ranking}
            meId={playerId}
            myRank={myRank}
            prevRank={myPrevRank}
            score={score}
            prevScore={round.prevScores[playerId] ?? score}
            prevRanks={round.prevRanks}
            prevScores={round.prevScores}
          />
        ) : (
          <>
            <section
              key={`prompt-${questionIndex}`}
              className="px-4 pt-6 fade-slide-up"
              aria-live="polite"
            >
              <QuestionPrompt
                as="h1"
                prompt={question.prompt}
                image={question.imageUrl ?? undefined}
              />
            </section>

            <div className="my-5 flex items-center justify-center gap-6">
              {phase === "QUESTION" ? (
                <TimerRing ratio={timeRatio} seconds={secondsLeft} urgent={urgent} />
              ) : (
                <div className="grid h-24 w-24 place-items-center rounded-full border-4 border-outline-variant/40 text-on-surface-variant">
                  {phase === "RESULT" ? (
                    isCorrect ? (
                      <Icon name="check" size={24} className="animate-pop text-success" />
                    ) : answered ? (
                      <Icon name="x" size={24} className="animate-shake text-error" />
                    ) : (
                      <Icon name="clock" size={24} className="text-secondary" />
                    )
                  ) : (
                    <Icon name="trophy" size={24} className="text-primary-container" />
                  )}
                </div>
              )}

              <div className="text-body-md text-on-surface-variant">
                <p className="text-label-md">ตอบแล้ว</p>

                <p className="text-headline-md font-bold tabular-nums text-on-surface font-display">
                  {answeredCount}
                  <span className="text-body-md text-secondary">/{totalPlayers || "–"}</span>
                </p>

                <div className="mt-1.5 h-1.5 w-28 overflow-hidden rounded-full bg-surface-variant">
                  <div
                    className="h-full bg-success transition-[width] duration-300"
                    style={{
                      width: `${(answeredCount / Math.max(totalPlayers, 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div key={`options-${questionIndex}`} className="grid gap-3 p-4 md:grid-cols-2">
              {options.map((option, index) => (
                <div key={option.id} className={`grid fade-slide-up ${staggerClass(index + 1)}`}>
                  <AnswerOptionButton
                    option={option}
                    index={index}
                    mine={myOptionId === String(option.id)}
                    showResult={showResult}
                    locked={phase !== "QUESTION" || answered || remainingMs <= 0 || waitingToStart}
                    onSelect={() => handleAnswer(String(option.id))}
                    showKeyHint={phase === "QUESTION"}
                  />
                </div>
              ))}
            </div>
          </>
        )}

        {phase !== "LEADERBOARD" && (
          <div aria-live="polite" className="border-t border-outline-variant/40 bg-surface p-4">
            {answerError && (
              <p role="alert" className="mb-2 text-center text-label-md text-error">
                {answerError}
              </p>
            )}

            {phase === "QUESTION" && !answered && remainingMs > 0 && (
              <p className="flex items-center justify-center gap-2 text-center text-body-md text-on-surface-variant">
                <Icon name="target" size={16} />
                เลือกคำตอบ หรือกดปุ่มตัวเลข 1–{options.length} บนแป้นพิมพ์
              </p>
            )}

            {phase === "QUESTION" && answered && !everyoneAnswered && (
              <div className="text-center">
                <p className="flex items-center justify-center gap-2 text-body-md font-bold text-on-surface">
                  <Icon name="check" size={20} className="text-success" />
                  ส่งคำตอบแล้ว
                </p>

                <p className="mt-0.5 text-body-md text-on-surface-variant">
                  รอผู้เล่นคนอื่น ({answeredCount}/{totalPlayers})
                </p>

                <AnsweredChips players={activePlayers} answeredIds={answeredIds} meId={playerId} />
              </div>
            )}

            {phase === "QUESTION" && everyoneAnswered && (
              <p className="flex items-center justify-center gap-2 text-center text-body-md font-bold text-on-surface">
                <Icon name="check" size={20} className="text-success" />
                ทุกคนตอบครบแล้ว กำลังไปข้อถัดไป
              </p>
            )}

            {phase === "QUESTION" && !answered && remainingMs <= 0 && (
              <p className="flex items-center justify-center gap-2 text-center text-body-md font-bold text-error">
                <Icon name="clock" size={20} />
                หมดเวลา กรุณารอเฉลย
              </p>
            )}

            {phase === "RESULT" && (
              <div className="fade-slide-up">
                <AnswerDistribution
                  distribution={distribution}
                  options={options}
                  totalAnswered={answeredCount}
                />
              </div>
            )}
          </div>
        )}

        {countdownValue !== null && countdownValue > 0 && (
          <div
            role="status"
            aria-live="assertive"
            className="fixed inset-0 z-50 grid place-items-center bg-surface-container-lowest/95 fade-slide-up"
          >
            <div className="text-center">
              <p className="text-label-md font-bold text-on-surface-variant">{countdownLabel}</p>

              <div
                key={countdownValue}
                className="mt-2 animate-pop font-display text-display-lg text-primary-container tabular-nums"
              >
                {countdownValue}
              </div>

              <p className="mt-2 text-body-md text-on-surface-variant">เตรียมตัว</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function AnsweredChips({
  players,
  answeredIds,
  meId,
}: {
  players: GamePlayerView[];
  answeredIds: Set<string>;
  meId: string;
}) {
  if (!players.length) return null;

  return (
    <div className="mt-3 flex flex-wrap justify-center gap-1.5">
      {players.slice(0, 16).map((p) => {
        const done = answeredIds.has(String(p.id));

        return (
          <span
            key={p.id}
            className={`inline-flex max-w-48 items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-label-sm transition-colors ${
              done
                ? "bg-success/10 text-on-surface"
                : "bg-surface-container text-on-surface-variant"
            }`}
          >
            <PlayerAvatar
              avatarIndex={p.avatarIndex}
              nickname={p.nickname || "ผู้เล่น"}
              size="xs"
              highlight={String(p.id) === meId}
              className="rounded-full"
            />

            <span className="truncate">{p.nickname || "ผู้เล่น"}</span>

            {String(p.id) === meId && <span className="shrink-0">(คุณ)</span>}

            <Icon
              name={done ? "check" : "clock"}
              size={16}
              className={`shrink-0 ${done ? "text-success" : "text-outline"}`}
            />
            <span className="sr-only">{done ? "ตอบแล้ว" : "ยังไม่ตอบ"}</span>
          </span>
        );
      })}

      {players.length > 16 && (
        <span className="rounded-full bg-surface-container px-2.5 py-1 text-caption text-on-surface-variant">
          +{players.length - 16}
        </span>
      )}
    </div>
  );
}

/** ผลของข้อนี้ — แสดงบนสุดของการ์ด เด้งเข้าพร้อมคะแนนที่นับขึ้น */
function ResultHero({
  answered,
  correct,
  gained,
  streak,
}: {
  answered: boolean;
  correct: boolean;
  gained: number;
  streak: number;
}) {
  const tone = correct
    ? "bg-success/10 text-on-surface"
    : answered
      ? "bg-error/10 text-error"
      : "bg-surface-variant text-on-surface-variant";
  return (
    <section
      aria-live="polite"
      className={`mx-4 mt-4 flex items-center gap-4 rounded-xl px-5 py-4 fade-slide-up ${tone}`}
    >
      <span
        className={`grid h-14 w-14 shrink-0 place-items-center rounded-full bg-surface-container-lowest result-pop ${
          correct ? "text-success" : answered ? "text-error animate-shake" : "text-secondary"
        }`}
      >
        <Icon name={correct ? "check" : answered ? "x" : "clock"} size={32} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-headline-md">
          {correct ? "ถูกต้อง!" : answered ? "ยังไม่ถูก" : "หมดเวลา"}
        </p>
        {correct && streak >= 2 && (
          <p className="mt-0.5 flex items-center gap-1.5 text-label-sm text-on-surface stagger-1 fade-slide-up">
            <Icon name="fire" size={16} className="text-brand-amber" />
            ตอบถูกติดกัน {streak} ข้อ
          </p>
        )}
        {!correct && <p className="mt-0.5 text-label-sm text-on-surface-variant">ดูเฉลยด้านล่าง</p>}
      </div>
      {correct && gained > 0 && (
        <CountUp
          to={gained}
          format={(n) => `+${formatNumber(n)}`}
          className="shrink-0 font-display text-headline-md text-primary-container tabular-nums"
        />
      )}
    </section>
  );
}

function AnswerDistribution({
  distribution,
  options,
  totalAnswered,
}: {
  distribution: Record<string, number>;
  options: QuestionOption[];
  totalAnswered: number;
}) {
  return (
    <div className="mx-auto max-w-sm space-y-1.5">
      <p className="mb-2 text-center text-label-md text-on-surface-variant">คำตอบของทุกคน</p>
      {options.map((o, i) => {
        const count = distribution[String(o.id)] ?? 0;
        const pct = (count / Math.max(totalAnswered, 1)) * 100;
        return (
          <div key={o.id} className="flex items-center gap-2">
            <AnswerBadge index={i} />
            <span className="sr-only">ตัวเลือกที่ {i + 1}</span>
            <div className="h-3 flex-1 overflow-hidden rounded bg-surface-variant">
              <div
                className={`h-full origin-left ${answerTheme(i).fill} bar-grow`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-6 text-right text-caption tabular-nums text-on-surface-variant">
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

type RankingRow = {
  id: string;
  nickname: string;
  avatarIndex: number | null;
  score: number;
  rank: number;
};

/** ระยะห่างระหว่างแถวของตารางอันดับ (h-14 = 56px + space-y-2 = 8px) */
const ROW_PITCH = 64;
const TOP_N = 5;

/** อันดับหลังจบข้อ — อันดับและคะแนนของฉันอยู่บนสุด แถวเลื่อนจากอันดับเดิมเข้าที่ */
function LiveStanding({
  ranking,
  meId,
  myRank,
  prevRank,
  score,
  prevScore,
  prevRanks,
  prevScores,
}: {
  ranking: RankingRow[];
  meId: string;
  myRank: number;
  prevRank: number;
  score: number;
  prevScore: number;
  prevRanks: Record<string, number>;
  prevScores: Record<string, number>;
}) {
  const delta = prevRank - myRank;
  const top = ranking.slice(0, TOP_N);
  const meRow = ranking.find((p) => p.id === meId);
  const inTop = top.some((p) => p.id === meId);
  // ลำดับในรายการก่อนข้อนี้ (เฉพาะที่อยู่ในช่วงที่แสดง) — ไม่มี = เพิ่งขึ้นมา
  const prevOrder = [...ranking]
    .filter((p) => prevRanks[p.id] !== undefined)
    .sort((a, b) => prevRanks[a.id] - prevRanks[b.id])
    .map((p) => p.id);
  const prevIndexOf = (id: string) => {
    const i = prevOrder.indexOf(id);
    return i >= 0 && i < TOP_N ? i : null;
  };

  return (
    <section aria-labelledby="standing-title" className="px-4 pb-5 pt-6">
      <div className="mx-auto max-w-md rounded-2xl brand-gradient px-5 py-5 text-center text-on-primary shadow-md result-pop">
        <p id="standing-title" className="text-label-md text-on-primary/80">
          อันดับของคุณตอนนี้
        </p>
        <div className="mt-1 flex items-center justify-center gap-3">
          <p className="font-display text-display-lg tabular-nums">
            {myRank > 0 ? <CountUp to={myRank} from={prevRank || myRank} /> : "–"}
          </p>
          {delta !== 0 && (
            <span
              className={`inline-flex items-center gap-1 rounded-full bg-surface-container-lowest px-2.5 py-1 text-label-md tabular-nums fade-slide-up stagger-2 ${
                delta > 0 ? "text-success" : "text-error"
              }`}
            >
              <Icon name={delta > 0 ? "arrowUp" : "arrowDown"} size={16} />
              <span className="sr-only">{delta > 0 ? "อันดับขึ้น" : "อันดับลง"}</span>
              {Math.abs(delta)}
            </span>
          )}
        </div>
        <p className="mt-1 text-body-md text-on-primary/90">
          <CountUp to={score} from={prevScore} format={formatNumber} className="tabular-nums" />{" "}
          คะแนน
        </p>
      </div>

      <h2 className="mb-3 mt-6 flex items-center justify-center gap-2 text-label-md text-on-surface-variant">
        <Icon name="trophy" size={16} className="text-primary-container" />
        ตารางอันดับ
      </h2>
      <ol className="mx-auto max-w-md space-y-2">
        {top.map((p, i) => (
          <RankRow
            key={p.id}
            index={i}
            prevIndex={prevIndexOf(p.id)}
            pitch={ROW_PITCH}
            className={`flex h-14 items-center gap-3 rounded-lg px-3 text-label-md ${
              p.id === meId
                ? "bg-primary-container font-bold text-on-primary"
                : "border border-outline-variant/40 bg-surface-container-lowest text-on-surface-variant"
            }`}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center font-bold">
              <RankIcon place={p.rank} />
            </span>
            <PlayerIdentity
              avatarIndex={p.avatarIndex}
              nickname={p.nickname}
              size="xs"
              isMe={p.id === meId}
              inverse={p.id === meId}
              nameClassName="text-label-md"
              className="min-w-0 flex-1"
            />
            <CountUp
              to={p.score}
              from={prevScores[p.id] ?? p.score}
              format={formatNumber}
              className="tabular-nums"
            />
          </RankRow>
        ))}

        {!inTop && meRow && (
          <li className="flex h-14 items-center gap-3 rounded-lg bg-primary-container px-3 text-label-md text-on-primary fade-slide-up stagger-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center">
              <RankIcon place={meRow.rank} />
            </span>
            <PlayerIdentity
              avatarIndex={meRow.avatarIndex}
              nickname={meRow.nickname}
              size="xs"
              isMe
              inverse
              nameClassName="text-label-md"
              className="min-w-0 flex-1"
            />
            <span className="tabular-nums">{formatNumber(meRow.score)}</span>
          </li>
        )}
      </ol>
    </section>
  );
}

/** รายชื่อผู้เล่นในห้องระหว่างรอเริ่มเกม */
function LobbyPlayers({ players, meId }: { players: GamePlayerView[]; meId: string }) {
  if (!players.length) return null;
  const MAX = 24;
  return (
    <ul aria-label="ผู้เล่นในห้อง" className="mt-3 flex flex-wrap justify-center gap-1.5">
      {players.slice(0, MAX).map((p, i) => {
        const name = p.nickname || "ผู้เล่น";
        const isMe = String(p.id) === meId;
        return (
          <li key={p.id} className={`fade-slide-up ${staggerClass(i)}`}>
            <span
              className={`inline-flex max-w-44 items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-label-sm ${
                isMe
                  ? "bg-primary-container/10 text-on-surface"
                  : "bg-surface-container text-on-surface-variant"
              }`}
            >
              <PlayerAvatar
                avatarIndex={p.avatarIndex}
                nickname={name}
                size="xs"
                highlight={isMe}
                className="rounded-full"
              />
              <span className="truncate">{name}</span>
              {isMe && <span className="shrink-0">(คุณ)</span>}
            </span>
          </li>
        );
      })}
      {players.length > MAX && (
        <li className="rounded-full bg-surface-container px-2.5 py-1 text-label-sm text-on-surface-variant">
          +{players.length - MAX}
        </li>
      )}
    </ul>
  );
}
