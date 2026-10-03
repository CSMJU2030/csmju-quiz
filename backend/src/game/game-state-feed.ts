// สถานะห้องเกมแบบสดสำหรับ SSE — โหลดจาก DB ครั้งเดียวต่อการเปลี่ยนแปลง แล้วแจกให้ผู้ฟังทุกคนของห้อง
// (เดิมผู้ฟังแต่ละคนโหลดเอง → 100 คนในห้อง = 100 query ต่อการเปลี่ยนแปลง)
// แต่ละผู้ดูแปลงเป็นมุมมองของตัวเอง (host / ผู้เล่น) ใน liveStream()
import { Injectable, type MessageEvent } from '@nestjs/common';
import {
  auditTime,
  catchError,
  concat,
  concatMap,
  finalize,
  from,
  interval,
  map,
  merge,
  type Observable,
  of,
  share,
  takeWhile,
  timer,
} from 'rxjs';
import { GameHub } from './game-hub';
import { type FullSession, GameSessionsService } from './game-sessions.service';

/** รวบการเปลี่ยนแปลงที่มาติดกันภายใน 25 มิลลิวินาทีเป็นการโหลดครั้งเดียว */
const COALESCE_MS = 25;

@Injectable()
export class GameStateFeed {
  private readonly feeds = new Map<string, Observable<FullSession | null>>();

  constructor(
    private readonly hub: GameHub,
    private readonly games: GameSessionsService,
  ) {}

  /**
   * สถานะล่าสุดของห้องทุกครั้งที่ห้องเปลี่ยน (ใช้ร่วมกันทุกผู้ฟังของห้องเดียวกัน)
   * null = โหลดไม่ได้ (เช่น ห้องถูกลบ) · ผู้ฟังคนสุดท้ายเลิกฟัง → ลบออกจาก map
   */
  changes(id: string): Observable<FullSession | null> {
    const cached = this.feeds.get(id);
    if (cached) return cached;
    const feed: Observable<FullSession | null> = this.hub.on(id).pipe(
      auditTime(COALESCE_MS),
      concatMap(() =>
        from(this.games.loadFull(id)).pipe(catchError(() => of<FullSession | null>(null))),
      ),
      finalize(() => {
        if (this.feeds.get(id) === feed) this.feeds.delete(id);
      }),
      share(),
    );
    this.feeds.set(id, feed);
    return feed;
  }

  /** จำนวนห้องที่มีผู้ฟังอยู่ (ใช้ในเทส) */
  get size() {
    return this.feeds.size;
  }
}

export interface LiveStreamOptions<S> {
  id: string;
  /** สถานะที่ผู้ดูคนนี้โหลดเองตอนเปิด stream (ตรวจสิทธิ์แล้ว) */
  first: S;
  changes: Observable<S | null>;
  /** ผู้ดูยังมีสิทธิ์ดูห้องนี้อยู่ไหม (host หรือยังเป็นผู้เล่น) */
  canView: (s: S) => boolean;
  view: (s: S) => object;
  /**
   * สถานะที่แชร์อาจโหลดก่อนผู้ดูเข้าห้อง — เมื่อดูเหมือนไม่มีสิทธิ์ ให้โหลดใหม่ตรวจอีกครั้งก่อนปิด
   * (เกิดน้อยมาก จึงไม่กระทบการโหลดครั้งเดียวต่อการเปลี่ยนแปลง)
   */
  recheck: () => Promise<S>;
  heartbeatMs: number;
  /** ปิด stream เมื่อถึงเวลานี้ (epoch ms) เช่น บัตรเข้าห้องหมดอายุ */
  expiresAt?: number;
}

/**
 * event "state" ต่อผู้ดู + "ping" ตามรอบ · หมดสิทธิ์ / ห้องถูกลบ / หมดอายุ → ส่ง "closed"
 * แล้วจบ stream ทั้งหมด (รวม ping) — EventSource ฝั่งหน้าเว็บจึงไม่ค้างต่อ
 */
export function liveStream<S>(o: LiveStreamOptions<S>): Observable<MessageEvent> {
  const closed: MessageEvent = { type: 'closed', data: { id: o.id } };

  const states = concat(of(o.first), o.changes).pipe(
    concatMap((s): Observable<S | null> => {
      if (s === null) return of(null);
      if (o.canView(s)) return of(s);
      return from(o.recheck()).pipe(
        map((fresh) => (o.canView(fresh) ? fresh : null)),
        catchError(() => of(null)),
      );
    }),
    map((s): MessageEvent => (s === null ? closed : { type: 'state', data: o.view(s) })),
    catchError(() => of(closed)),
  );
  const pings = interval(o.heartbeatMs).pipe(
    map((): MessageEvent => ({ type: 'ping', data: { serverTime: new Date().toISOString() } })),
  );
  const sources = [states, pings];
  if (o.expiresAt !== undefined) {
    sources.push(timer(Math.max(0, o.expiresAt - Date.now())).pipe(map(() => closed)));
  }
  return merge(...sources).pipe(takeWhile((e) => e.type !== 'closed', true));
}
