// src/hooks/use-sfx.ts
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { readSfxMuted, saveSfxMuted } from "@/lib/player-session";

type Sfx = "start" | "tick" | "urgent" | "lock" | "correct" | "wrong" | "count" | "finish";

export function useSfx() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setMuted(readSfxMuted());
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // ปิด AudioContext เมื่อออกจากหน้า — เบราว์เซอร์จำกัดจำนวน context ต่อแท็บ
  useEffect(
    () => () => {
      const ctx = ctxRef.current;
      ctxRef.current = null;
      if (ctx && ctx.state !== "closed") void ctx.close().catch(() => undefined);
    },
    [],
  );

  const toggle = useCallback(() => {
    setMuted((m) => {
      saveSfxMuted(!m);
      return !m;
    });
  }, []);

  const unlock = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (!ctxRef.current) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctxRef.current = new AC();
    }
    if (ctxRef.current.state === "suspended") void ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const blip = (
    ctx: AudioContext,
    freq: number,
    at: number,
    dur: number,
    type: OscillatorType = "sine",
    gain = 0.1,
  ) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + at);
    g.gain.setValueAtTime(0.0001, ctx.currentTime + at);
    g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(ctx.currentTime + at);
    osc.stop(ctx.currentTime + at + dur + 0.02);
  };

  const play = useCallback(
    (name: Sfx) => {
      if (muted) return;
      const ctx = ctxRef.current;
      if (!ctx || ctx.state !== "running") return;
      switch (name) {
        case "start":
          [523, 659, 784].forEach((f, i) => blip(ctx, f, i * 0.08, 0.12));
          break;
        case "tick":
          blip(ctx, 880, 0, 0.04, "square", 0.035);
          break;
        case "urgent":
          blip(ctx, 1180, 0, 0.06, "square", 0.07);
          break;
        case "lock":
          blip(ctx, 520, 0, 0.09, "triangle", 0.09);
          break;
        case "count":
          blip(ctx, 700, 0, 0.12, "sine", 0.09);
          break;
        case "correct":
          [659, 784, 988, 1319].forEach((f, i) => blip(ctx, f, i * 0.07, 0.15));
          break;
        case "wrong":
          [220, 165].forEach((f, i) => blip(ctx, f, i * 0.11, 0.2, "sawtooth", 0.07));
          break;
        case "finish":
          [523, 659, 784, 1046].forEach((f, i) => blip(ctx, f, i * 0.13, 0.28));
          break;
      }
    },
    [muted],
  );

  return { play, muted, toggle, unlock };
}

export function vibrate(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* ignore */
    }
  }
}
