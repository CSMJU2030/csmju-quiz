// e2e: สัญญา API (envelope · 400/401/403/404 · pagination) + วงจรแบบทดสอบ → เกม → รายงาน
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { startFakeCoreHub, type FakeCoreHub } from './support/fake-core-hub';

const hasDb = Boolean(process.env.DATABASE_URL);
const describeDb = hasDb ? describe : describe.skip;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describeDb('CSMJU Quiz API (e2e)', () => {
  let app: INestApplication;
  let hub: FakeCoreHub;
  let staff: string;
  let student: string;

  beforeAll(async () => {
    hub = await startFakeCoreHub();
    Object.assign(process.env, {
      NODE_ENV: 'test',
      CORE_HUB_URL: hub.url,
      CORE_HUB_JWKS_URL: `${hub.url}/api/v1/.well-known/jwks.json`,
      CORE_HUB_ISSUER: 'core-hub',
      CORE_HUB_AUDIENCE: 'csmju2030',
      SUBSYSTEM_ID: 'csmju-quiz',
      FRONTEND_URL: 'http://localhost:3102',
      CORE_HUB_WEB_URL: 'http://127.0.0.1:3100',
      GUEST_PLAY_ENABLED: 'true',
      GUEST_JOIN_RATE_LIMIT: '25',
    });
    // import หลังตั้ง env เพื่อให้ ConfigModule อ่านค่าชุดนี้
    const { AppModule } = await import('../src/app.module.js');
    const { configureApp } = await import('../src/app.setup.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app, 'http://localhost:3102');
    await app.init();
    staff = await hub.token('staff', `e2e-staff-${Date.now()}`);
    student = await hub.token('student', `e2e-student-${Date.now()}`);
  });

  afterAll(async () => {
    await app?.close();
    await hub?.close();
  });

  const api = () => request(app.getHttpServer());

  it('GET /api/health เป็น public และรายงานชื่อระบบ', async () => {
    const res = await api().get('/api/health').expect(200);
    expect(res.body).toEqual({ success: true, data: { status: 'ok', service: 'csmju-quiz' } });
  });

  it('ไม่มี token → 401 UNAUTHORIZED · token ปลอม → 401', async () => {
    const res = await api().get('/api/v1/me').expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    await api().get('/api/v1/me').set('Authorization', 'Bearer abc.def.ghi').expect(401);
  });

  it('/api/v1/me คืนตัวตนจาก token + session.expiresAt (ISO จาก exp)', async () => {
    const res = await api().get('/api/v1/me').set('Authorization', `Bearer ${staff}`).expect(200);
    expect(res.body.data).toMatchObject({ coreRole: 'staff', subsystemRole: 'HOST' });
    const exp = JSON.parse(Buffer.from(staff.split('.')[1], 'base64url').toString()).exp;
    expect(res.body.data.session).toEqual({ expiresAt: new Date(exp * 1000).toISOString() });
  });

  it('ตรวจ token ขั้น 9–10: อายุเกิน 900+60 → 401 · ไม่มี iat → 401 · azp ระบบอื่น → 401 · azp ตัวเอง → 200', async () => {
    const me = (t: string) => api().get('/api/v1/me').set('Authorization', `Bearer ${t}`);
    const long = await hub.token('staff', 'e2e-long', { lifetimeSec: 7 * 86_400 });
    expect((await me(long).expect(401)).body.error.code).toBe('UNAUTHORIZED');
    await me(await hub.token('staff', 'e2e-noiat', { omitIat: true })).expect(401);
    await me(await hub.token('staff', 'e2e-azp-x', { azp: 'csmju-equipment' })).expect(401);
    await me(await hub.token('staff', 'e2e-azp-ok', { azp: 'csmju-quiz' })).expect(200);
    // sub ไม่ใช่ UUID (นักศึกษาที่นำเข้าจาก CSV) ใช้ได้
    const csv = await me(await hub.token('student', 'user-6304101234')).expect(200);
    expect(csv.body.data.id).toBe('user-6304101234');
  });

  it('คุกกี้ session ชื่อ csmju_quiz_access_token · ไม่อ่านคุกกี้ของ Core Hub', async () => {
    const ok = await api()
      .get('/api/v1/me')
      .set('Cookie', `csmju_quiz_access_token=${staff}`)
      .expect(200);
    expect(ok.body.data.coreRole).toBe('staff');
    await api()
      .get('/api/v1/me')
      .set('Cookie', `csmju_access_token=${staff}; core_hub_access_token=${staff}`)
      .expect(401);
  });

  /** /auth/login แล้วคืน state + คุกกี้ state (ชื่อ=ค่า) */
  const beginLogin = async (next?: string) => {
    const res = await api()
      .get(next === undefined ? '/auth/login' : `/auth/login?next=${encodeURIComponent(next)}`)
      .expect(302);
    return {
      res,
      state: new URL(res.headers.location).searchParams.get('state') ?? '',
      cookie: String(res.headers['set-cookie']).split(';')[0],
    };
  };
  const setCookies = (res: request.Response) =>
    ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const sessionCookieOf = (res: request.Response) =>
    setCookies(res).find((c) => c.startsWith('csmju_quiz_access_token='));

  it('SSO เริ่มจากระบบนี้: /auth/login ตั้งคุกกี้ state → callback ตรวจ state → กลับหน้า next บน FRONTEND_URL', async () => {
    const next = '/game/join?pin=123456';
    const { res: login, state, cookie } = await beginLogin(next);
    const authorize = new URL(login.headers.location);
    expect(`${authorize.origin}${authorize.pathname}`).toBe('http://127.0.0.1:3100/sso/authorize');
    expect(authorize.searchParams.get('subsystem')).toBe('csmju-quiz');
    expect(authorize.searchParams.has('callback_url')).toBe(false);
    expect(Buffer.from(state, 'base64url')).toHaveLength(32);
    expect(login.headers['cache-control']).toBe('no-store');
    const stateCookie = String(login.headers['set-cookie']);
    expect(stateCookie).toMatch(/^csmju_quiz_sso_state=/);
    expect(stateCookie).toMatch(/Path=\/auth\/callback/);
    expect(stateCookie).toMatch(/HttpOnly/);
    expect(stateCookie).toMatch(/SameSite=Lax/);
    expect(stateCookie).toMatch(/Max-Age=600/);
    // ค่า = <state>.<next แบบ base64url>
    const [savedState, savedNext] = decodeURIComponent(cookie.split('=')[1]).split('.');
    expect(savedState).toBe(state);
    expect(Buffer.from(savedNext, 'base64url').toString()).toBe(next);

    const ok = await api()
      .get(`/auth/callback?access_token=${student}&state=${state}`)
      .set('Cookie', cookie)
      .expect(302);
    expect(ok.headers.location).toBe(`http://localhost:3102${next}`);
    expect(ok.headers['referrer-policy']).toBe('no-referrer');
    expect(ok.headers['cache-control']).toBe('no-store');
    const session = sessionCookieOf(ok) ?? '';
    expect(session).toMatch(/^csmju_quiz_access_token=ey/);
    expect(session).toMatch(/Path=\/;/);
    expect(session).toMatch(/HttpOnly/);
    expect(session).toMatch(/SameSite=Lax/);
    const maxAge = Number(/Max-Age=(\d+)/.exec(session)?.[1]);
    expect(maxAge).toBeGreaterThan(800);
    expect(maxAge).toBeLessThanOrEqual(900);
    // คุกกี้ state ถูกเผา
    expect(setCookies(ok).find((c) => c.startsWith('csmju_quiz_sso_state='))).toMatch(
      /^csmju_quiz_sso_state=;.*Max-Age=0/,
    );

    // ใช้ state ซ้ำไม่ได้ (คุกกี้ถูกเผาแล้ว → ไม่มีคุกกี้ state) → 401
    await api().get(`/auth/callback?access_token=${student}&state=${state}`).expect(401);

    // next ที่ออกนอกระบบ → ใช้หน้าแรกของ FRONTEND_URL
    for (const bad of [
      'https://evil.example/x',
      '//evil.example.com',
      '/\\evil.example',
      '/auth/login',
    ]) {
      const l = await beginLogin(bad);
      const back = await api()
        .get(`/auth/callback?access_token=${student}&state=${l.state}`)
        .set('Cookie', l.cookie)
        .expect(302);
      expect(back.headers.location).toBe('http://localhost:3102/');
    }
  });

  it('callback ไม่มี state (กดจาก sidebar) → ทิ้ง token · ไม่มี Set-Cookie เลย · 302 /auth/login', async () => {
    const { cookie } = await beginLogin('/x');
    const res = await api()
      .get(`/auth/callback?access_token=${student}`)
      .set('Cookie', cookie)
      .expect(302);
    expect(res.headers.location).toBe('http://localhost:3102/auth/login');
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    // state ว่าง = ไม่มี state
    const empty = await api().get(`/auth/callback?access_token=${student}&state=`).expect(302);
    expect(empty.headers['set-cookie']).toBeUndefined();
  });

  it('callback ไม่มี access_token → 400', async () => {
    const res = await api().get('/auth/callback').expect(400);
    expect(res.body.success).toBe(false);
    expect(res.headers['cache-control']).toBe('no-store');
    const { state, cookie } = await beginLogin();
    const withState = await api().get(`/auth/callback?state=${state}`).set('Cookie', cookie);
    expect(withState.status).toBe(400);
    expect(sessionCookieOf(withState)).toBeUndefined();
  });

  it('callback state ไม่ตรง / ไม่มีคุกกี้ state → 401 · ไม่ redirect · ไม่มีคุกกี้ session · HTML มีปุ่มเข้าสู่ระบบอีกครั้ง', async () => {
    const first = await beginLogin('/a');
    const second = await beginLogin('/b');

    // state ของรอบหนึ่งกับคุกกี้ของอีกรอบ
    const crossed = await api()
      .get(`/auth/callback?access_token=${student}&state=${first.state}`)
      .set('Cookie', second.cookie)
      .expect(401);
    expect(crossed.headers.location).toBeUndefined();
    expect(sessionCookieOf(crossed)).toBeUndefined();
    expect(crossed.body.error.code).toBe('UNAUTHORIZED');
    expect(String(crossed.headers['set-cookie'])).toMatch(/csmju_quiz_sso_state=;/);

    // ไม่มีคุกกี้ state + เบราว์เซอร์ขอ HTML → หน้า "เข้าสู่ระบบอีกครั้ง"
    const page = await api()
      .get(`/auth/callback?access_token=${student}&state=${first.state}`)
      .set('Accept', 'text/html,application/xhtml+xml,*/*;q=0.8')
      .expect(401);
    expect(page.headers['content-type']).toMatch(/text\/html/);
    expect(page.text).toContain('เข้าสู่ระบบอีกครั้ง');
    expect(page.text).toContain('href="/auth/login"');
    expect(page.headers.location).toBeUndefined();
    expect(sessionCookieOf(page)).toBeUndefined();
    expect(page.headers['cache-control']).toBe('no-store');
    expect(page.headers['referrer-policy']).toBe('no-referrer');
  });

  it('callback token ไม่ผ่าน (state ถูก) → 401 ไม่มีคุกกี้ session · role ที่แมปไม่ได้ → 403', async () => {
    const tampered = await beginLogin();
    const [h, , sig] = student.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(student.split('.')[1], 'base64url').toString()),
        role: 'admin',
      }),
    ).toString('base64url');
    const bad = await api()
      .get(`/auth/callback?access_token=${h}.${forgedPayload}.${sig}&state=${tampered.state}`)
      .set('Cookie', tampered.cookie)
      .expect(401);
    expect(sessionCookieOf(bad)).toBeUndefined();
    expect(bad.headers.location).toBeUndefined();

    const long = await beginLogin();
    const refreshLike = await hub.token('student', 'e2e-refresh', { lifetimeSec: 7 * 86_400 });
    const rejected = await api()
      .get(`/auth/callback?access_token=${refreshLike}&state=${long.state}`)
      .set('Cookie', long.cookie)
      .expect(401);
    expect(sessionCookieOf(rejected)).toBeUndefined();

    const role = await beginLogin();
    const unknown = await hub.token('janitor', `e2e-janitor-${Date.now()}`);
    const res = await api()
      .get(`/auth/callback?access_token=${unknown}&state=${role.state}`)
      .set('Cookie', role.cookie)
      .expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(sessionCookieOf(res)).toBeUndefined();
    await api().get('/api/v1/me').set('Authorization', `Bearer ${unknown}`).expect(403);
  });

  it('core role: lecturer = HOST · guest = PLAYER', async () => {
    const lecturer = await hub.token('lecturer', `e2e-lecturer-${Date.now()}`);
    const guest = await hub.token('guest', `e2e-guest-${Date.now()}`);
    const l = await api().get('/api/v1/me').set('Authorization', `Bearer ${lecturer}`).expect(200);
    expect(l.body.data).toMatchObject({ coreRole: 'lecturer', subsystemRole: 'HOST' });
    const g = await api().get('/api/v1/me').set('Authorization', `Bearer ${guest}`).expect(200);
    expect(g.body.data).toMatchObject({ coreRole: 'guest', subsystemRole: 'PLAYER' });
    await api()
      .post('/api/v1/quizzes')
      .set('Authorization', `Bearer ${guest}`)
      .send({ title: 'x' })
      .expect(403);
  });

  it('POST /auth/logout: ไม่ต้องมี token · ลบคุกกี้ session และ state (Max-Age=0) · 303 ไปหน้า logout ของ Core Hub', async () => {
    const res = await api().post('/auth/logout').expect(303);
    expect(res.headers.location).toBe('http://127.0.0.1:3100/logout');
    expect(res.headers['cache-control']).toBe('no-store');
    const cookies = setCookies(res);
    const session = cookies.find((c) => c.startsWith('csmju_quiz_access_token='));
    expect(session).toMatch(/^csmju_quiz_access_token=;/);
    expect(session).toMatch(/Max-Age=0(;|$)/);
    expect(session).toMatch(/Path=\/;/);
    expect(session).toMatch(/HttpOnly/);
    expect(session).toMatch(/SameSite=Lax/);
    const state = cookies.find((c) => c.startsWith('csmju_quiz_sso_state='));
    expect(state).toMatch(/^csmju_quiz_sso_state=;/);
    expect(state).toMatch(/Max-Age=0/);
    expect(state).toMatch(/Path=\/auth\/callback/);
    // ไม่แตะคุกกี้ของ Core Hub
    expect(cookies.some((c) => c.startsWith('csmju_access_token='))).toBe(false);
    // อยู่นอก prefix /api
    await api().post('/api/auth/logout').expect(404);
    // path อื่นใต้ /auth ก็ no-store
    const other = await api().get('/auth/logout');
    expect(other.headers['cache-control']).toBe('no-store');
  });

  it('limit=101 → 400 VALIDATION_ERROR · body ใหญ่เกิน → 400 (ไม่ใช่ 413)', async () => {
    const auth = { Authorization: `Bearer ${staff}` };
    const res = await api().get('/api/v1/quizzes?limit=101').set(auth).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const big = await api()
      .post('/api/v1/quizzes')
      .set(auth)
      .send({ title: 'x', description: 'x'.repeat(200_000) })
      .expect(400);
    expect(big.body).toMatchObject({ success: false, error: { code: 'BAD_REQUEST' } });
  });

  it('ผู้เล่นที่ยังไม่เคยเล่นเกม: ประวัติว่าง · สถิติเป็นศูนย์', async () => {
    const fresh = await hub.token('student', `e2e-fresh-${Date.now()}`);
    const auth = { Authorization: `Bearer ${fresh}` };
    const list = await api().get('/api/v1/game-histories').set(auth).expect(200);
    expect(list.body.data).toEqual([]);
    expect(list.body.meta).toMatchObject({ total: 0, page: 1 });
    const stats = (await api().get('/api/v1/me/game-stats').set(auth).expect(200)).body.data;
    expect(stats).toMatchObject({
      gamesPlayed: 0,
      wins: 0,
      bestRank: null,
      totalScore: 0,
      averageAccuracy: 0,
      lastPlayedAt: null,
    });
  });

  it('host B แตะเกม/แบบทดสอบของ host A ไม่ได้ (403) · ADMIN เข้าเป็นผู้เล่นไม่ได้ (409)', async () => {
    const hostA = { Authorization: `Bearer ${staff}` };
    const hostB = {
      Authorization: `Bearer ${await hub.token('lecturer', `e2e-host-b-${Date.now()}`)}`,
    };
    const admin = {
      Authorization: `Bearer ${await hub.token('admin', `e2e-admin-${Date.now()}`)}`,
    };
    const player = { Authorization: `Bearer ${student}` };

    const quiz = (await api().post('/api/v1/quizzes').set(hostA).send({ title: 'e2e owner' })).body
      .data;
    await api()
      .patch(`/api/v1/quizzes/${quiz.id}`)
      .set(hostA)
      .send({
        status: 'PUBLISHED',
        questions: [
          {
            type: 'TRUE_FALSE',
            prompt: 'ข้อความนี้ถูก',
            timeLimit: 5,
            points: 1000,
            options: [
              { text: 'ถูก', isCorrect: true },
              { text: 'ผิด', isCorrect: false },
            ],
          },
        ],
      })
      .expect(200);
    const game = (
      await api().post('/api/v1/game-sessions').set(hostA).send({ quizId: quiz.id }).expect(201)
    ).body.data;
    const joined = (
      await api()
        .post(`/api/v1/game-sessions/${game.id}/players`)
        .set(player)
        .send({ nickname: 'เจ้าของ' })
        .expect(201)
    ).body.data;

    // ADMIN เห็นเฉลยของทุกห้อง → เข้าเป็นผู้เล่นไม่ได้
    const adminJoin = await api()
      .post(`/api/v1/game-sessions/${game.id}/players`)
      .set(admin)
      .send({ nickname: 'แอดมิน' })
      .expect(409);
    expect(adminJoin.body.error.code).toBe('CONFLICT');
    // ผู้เล่นชื่อซ้ำ (ไม่สนตัวพิมพ์) → 409
    await api()
      .post(`/api/v1/guest-games/${game.id}/players`)
      .send({ nickname: 'เจ้าของ' })
      .expect(409);

    for (const [method, path] of [
      ['post', `/api/v1/game-sessions/${game.id}/start`],
      ['post', `/api/v1/game-sessions/${game.id}/advance`],
      ['delete', `/api/v1/game-sessions/${game.id}/players/${joined.playerId}`],
      ['delete', `/api/v1/game-sessions/${game.id}`],
      ['delete', `/api/v1/quizzes/${quiz.id}`],
    ] as const) {
      const res = await api()[method](path).set(hostB).expect(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    }
    await api().patch(`/api/v1/quizzes/${quiz.id}`).set(hostB).send({ title: 'ยึด' }).expect(403);
    const still = (await api().get(`/api/v1/game-sessions/${game.id}`).set(hostA).expect(200)).body
      .data;
    expect(still).toMatchObject({ status: 'LOBBY', playerCount: 1 });

    await api().delete(`/api/v1/game-sessions/${game.id}`).set(hostA).expect(200);
    await api().delete(`/api/v1/quizzes/${quiz.id}`).set(hostA).expect(200);
  });

  it('ผู้เล่นสร้างแบบทดสอบไม่ได้ → 403 FORBIDDEN', async () => {
    const res = await api()
      .post('/api/v1/quizzes')
      .set('Authorization', `Bearer ${student}`)
      .send({ title: 'x' })
      .expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('pagination / 400 / 404 / route ที่ไม่มี', async () => {
    const auth = { Authorization: `Bearer ${staff}` };
    const list = await api().get('/api/v1/quizzes?page=1&limit=1').set(auth).expect(200);
    expect(list.body.meta).toMatchObject({ page: 1, limit: 1 });
    const bad = await api().get('/api/v1/quizzes?limit=abc').set(auth).expect(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');
    await api().get('/api/v1/quizzes/not-a-uuid').set(auth).expect(400);
    const missing = await api()
      .get('/api/v1/quizzes/99999999-9999-4999-8999-999999999999')
      .set(auth)
      .expect(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');
    const unknown = await api().get('/api/v1/__nope__').set(auth).expect(404);
    expect(unknown.body.success).toBe(false);
  });

  it('วงจร: สร้าง → เผยแพร่ → เปิดเกม → เข้าร่วม → ตอบ → ได้คะแนน', async () => {
    const host = { Authorization: `Bearer ${staff}` };
    const player = { Authorization: `Bearer ${student}` };

    const quiz = (await api().post('/api/v1/quizzes').set(host).send({ title: 'e2e' }).expect(201))
      .body.data;
    await api()
      .patch(`/api/v1/quizzes/${quiz.id}`)
      .set(host)
      .send({ status: 'PUBLISHED' })
      .expect(409); // ยังไม่มีคำถาม

    await api()
      .patch(`/api/v1/quizzes/${quiz.id}`)
      .set(host)
      .send({
        status: 'PUBLISHED',
        questions: [
          {
            type: 'TRUE_FALSE',
            prompt: 'ข้อความนี้ถูก',
            timeLimit: 5,
            points: 1000,
            options: [
              { text: 'ถูก', isCorrect: true },
              { text: 'ผิด', isCorrect: false },
            ],
          },
        ],
      })
      .expect(200);

    const game = (
      await api().post('/api/v1/game-sessions').set(host).send({ quizId: quiz.id }).expect(201)
    ).body.data;
    await api()
      .post(`/api/v1/game-sessions/${game.id}/players`)
      .set(player)
      .send({ nickname: 'e2e' })
      .expect(201);
    const started = (
      await api().post(`/api/v1/game-sessions/${game.id}/start`).set(host).expect(200)
    ).body.data;
    const correct = started.question.options.find((o: { isCorrect: boolean }) => o.isCorrect);

    await sleep(3100); // นับถอยหลัง 3-2-1
    await api()
      .post(`/api/v1/game-sessions/${game.id}/answers`)
      .set(player)
      .send({ optionId: correct.id })
      .expect(201);

    await sleep(3800); // ทุกคนตอบครบ → ปิดรับใน 3 วินาที (+ LATE_GRACE_MS)
    const state = (await api().get(`/api/v1/game-sessions/${game.id}`).set(player).expect(200)).body
      .data;
    expect(state.phase).toBe('RESULT');
    expect(state.me.answer.isCorrect).toBe(true);
    expect(state.me.score).toBeGreaterThan(900);

    // host ข้ามเฟสจนจบ → PODIUM มีสถิติและรางวัลพิเศษ
    await api().post(`/api/v1/game-sessions/${game.id}/advance`).set(host).expect(200); // → LEADERBOARD
    const done = (
      await api().post(`/api/v1/game-sessions/${game.id}/advance`).set(host).expect(200)
    ).body.data;
    expect(done.phase).toBe('PODIUM');
    const podium = (await api().get(`/api/v1/game-sessions/${game.id}`).set(player).expect(200))
      .body.data;
    expect(podium.results.players).toEqual([
      expect.objectContaining({ correct: 1, answered: 1, maxStreak: 1, firstCorrect: 1 }),
    ]);
    expect(podium.results.awards.map((a: { kind: string }) => a.kind)).toEqual([
      'fastest',
      'accuracy',
    ]);
    const report = (await api().get(`/api/v1/game-reports/${game.id}`).set(host).expect(200)).body
      .data;
    expect(report.players[0]).toMatchObject({ correct: 1, rank: 1 });

    // ประวัติการเล่นของผู้เล่นที่เข้าด้วยบัญชี (เห็นเฉพาะของตัวเอง)
    const history = await api().get('/api/v1/game-histories').set(player).expect(200);
    expect(history.body.meta).toMatchObject({ page: 1, total: expect.any(Number) });
    const mine = history.body.data.find((h: { id: string }) => h.id === game.id);
    expect(mine).toMatchObject({ rank: 1, correct: 1, questionCount: 1, accuracy: 100 });
    expect(mine.awards).toEqual(['fastest', 'accuracy']);
    const review = (await api().get(`/api/v1/game-histories/${game.id}`).set(player).expect(200))
      .body.data;
    expect(review.answers).toEqual([
      expect.objectContaining({ result: 'CORRECT', selectedOptionId: correct.id }),
    ]);
    const stats = (await api().get('/api/v1/me/game-stats').set(player).expect(200)).body.data;
    expect(stats.gamesPlayed).toBeGreaterThanOrEqual(1);
    expect(stats.wins).toBeGreaterThanOrEqual(1);

    // host ไม่ได้เล่นเกมนี้ → ไม่มีในประวัติของ host · ผู้ใช้อื่นเปิดดู → 404
    const hostHistory = await api().get('/api/v1/game-histories').set(host).expect(200);
    expect(hostHistory.body.data.some((h: { id: string }) => h.id === game.id)).toBe(false);
    const other = await hub.token('student', `e2e-other-${Date.now()}`);
    await api()
      .get(`/api/v1/game-histories/${game.id}`)
      .set('Authorization', `Bearer ${other}`)
      .expect(404);
    await api().get('/api/v1/game-histories/not-a-uuid').set(player).expect(400);

    // host ดูคำตอบรายคนในรายงาน · ผู้เล่นเรียกไม่ได้ (403)
    const playerId = report.players[0].playerId;
    const perPlayer = (
      await api().get(`/api/v1/game-reports/${game.id}/players/${playerId}`).set(host).expect(200)
    ).body.data;
    expect(perPlayer.answers[0].result).toBe('CORRECT');
    await api().get(`/api/v1/game-reports/${game.id}/players/${playerId}`).set(player).expect(403);
    await api()
      .get(`/api/v1/game-reports/${game.id}/players/99999999-9999-4999-8999-999999999999`)
      .set(host)
      .expect(404);

    // รายการแบบแบ่งหน้าฝั่ง server: ค้นรายงานด้วยชื่อแบบทดสอบ · กรองแบบทดสอบ ACTIVE · เรียงตามจำนวนข้อ
    const found = await api()
      .get(`/api/v1/game-reports?search=${encodeURIComponent(report.quizTitle)}`)
      .set(host)
      .expect(200);
    expect(found.body.data.some((r: { id: string }) => r.id === game.id)).toBe(true);
    // รายการ (ดึงเฉพาะตัวเลขสรุป) ต้องตรงกับส่วนสรุปของรายงานเต็ม
    const { players: _p, questions: _q, ...summary } = report;
    expect(found.body.data.find((r: { id: string }) => r.id === game.id)).toEqual(summary);
    const none = await api()
      .get('/api/v1/game-reports?search=__no_such_quiz__')
      .set(host)
      .expect(200);
    expect(none.body.meta.total).toBe(0);
    const active = await api()
      .get('/api/v1/quizzes?status=ACTIVE&sort=questionCount')
      .set(host)
      .expect(200);
    const listed = active.body.data.find((q: { id: string }) => q.id === quiz.id);
    expect(listed).toMatchObject({ status: 'PUBLISHED', questionCount: 1 });
    expect(listed.totalTimeLimit).toBeGreaterThan(0);
    const archived = await api().get('/api/v1/quizzes?status=ARCHIVED').set(host).expect(200);
    expect(archived.body.data.some((q: { id: string }) => q.id === quiz.id)).toBe(false);
    await api().get('/api/v1/quizzes?sort=nope').set(host).expect(400);

    await api().delete(`/api/v1/game-sessions/${game.id}`).set(host).expect(200);
    const del = await api().delete(`/api/v1/quizzes/${quiz.id}`).set(host).expect(200);
    expect(del.body.data).toEqual({ id: quiz.id, deleted: true });
  });

  // บัตรเข้าห้อง (PM อนุมัติ 2 ต.ค. 2569): ผู้เล่นสแกน QR แล้วเล่นได้โดยไม่ล็อกอิน
  it('บัตรเข้าห้อง: เข้าร่วม · ตอบ · ถูกเตะ · ห้องปิด · ใช้ข้ามห้องไม่ได้ · ใช้กับ endpoint อื่นไม่ได้', async () => {
    const host = { Authorization: `Bearer ${staff}` };
    const quiz = (await api().post('/api/v1/quizzes').set(host).send({ title: 'e2e guest' })).body
      .data;
    await api()
      .patch(`/api/v1/quizzes/${quiz.id}`)
      .set(host)
      .send({
        status: 'PUBLISHED',
        questions: [
          {
            type: 'TRUE_FALSE',
            prompt: 'ข้อความนี้ถูก',
            timeLimit: 5,
            points: 1000,
            options: [
              { text: 'ถูก', isCorrect: true },
              { text: 'ผิด', isCorrect: false },
            ],
          },
        ],
      })
      .expect(200);
    const open = async () =>
      (await api().post('/api/v1/game-sessions').set(host).send({ quizId: quiz.id }).expect(201))
        .body.data;
    const game = await open();
    const other = await open();

    // ค้นห้องด้วย PIN ได้โดยไม่มี token
    const lobby = await api().get(`/api/v1/guest-games?gamePin=${game.gamePin}`).expect(200);
    expect(lobby.body.data[0]).toMatchObject({ id: game.id, joined: false });
    await api().get('/api/v1/guest-games').expect(400);

    // เข้าร่วม → คุกกี้ HttpOnly · SameSite=Lax · path ของห้อง · ไม่ใช่ JWT
    const joined = await api()
      .post(`/api/v1/guest-games/${game.id}/players`)
      .send({ nickname: 'ผู้มาเยือน', avatarIndex: 3 })
      .expect(201);
    const setCookie = String(joined.headers['set-cookie']);
    expect(setCookie).toMatch(/quiz_room_pass=[A-Za-z0-9_-]{43};/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toContain(`Path=/api/v1/guest-games/${game.id}`);
    expect(setCookie).not.toMatch(/eyJ/);
    const cookie = setCookie.split(';')[0];
    const guestId = joined.body.data.playerId;

    // เข้าซ้ำด้วยบัตรเดิม → ผู้เล่นเดิม ไม่ออกบัตรใหม่
    const again = await api()
      .post(`/api/v1/guest-games/${game.id}/players`)
      .set('Cookie', cookie)
      .send({ nickname: 'ชื่ออื่น' })
      .expect(201);
    expect(again.body.data.playerId).toBe(guestId);
    expect(again.headers['set-cookie']).toBeUndefined();

    // ไม่รับชื่อยาวเกิน · รูปนอกชุด · ไม่มีบัตร = ดูสถานะไม่ได้
    await api()
      .post(`/api/v1/guest-games/${game.id}/players`)
      .send({ nickname: 'x'.repeat(21) })
      .expect(400);
    await api()
      .post(`/api/v1/guest-games/${game.id}/players`)
      .send({ nickname: 'รูปผิด', avatarIndex: 999 })
      .expect(400);
    await api().get(`/api/v1/guest-games/${game.id}`).expect(401);

    // บัตรใช้ได้เฉพาะห้องที่ออกให้ และใช้แทน token กับ endpoint อื่นไม่ได้
    await api().get(`/api/v1/guest-games/${other.id}`).set('Cookie', cookie).expect(401);
    await api().get(`/api/v1/game-sessions/${game.id}`).set('Cookie', cookie).expect(401);
    await api().get('/api/v1/quizzes').set('Cookie', cookie).expect(401);
    await api().get(`/api/v1/game-reports/${game.id}`).set('Cookie', cookie).expect(401);
    await api().get('/api/v1/game-histories').set('Cookie', cookie).expect(401);
    await api().get('/api/v1/me/game-stats').set('Cookie', cookie).expect(401);

    // สถานะของห้อง: เห็นตัวเอง (me) ไม่มี core_user_id ของใคร
    const state = (
      await api().get(`/api/v1/guest-games/${game.id}`).set('Cookie', cookie).expect(200)
    ).body.data;
    expect(state).toMatchObject({
      viewer: 'PLAYER',
      me: { playerId: guestId, nickname: 'ผู้มาเยือน' },
    });
    expect(JSON.stringify(state)).not.toMatch(/coreUserId|e2e-staff/);

    // ผู้เปิดห้องเห็นผู้เล่นที่ไม่ล็อกอิน · ผู้เล่นคนที่สองถูกเตะ → บัตรใช้ไม่ได้ทันที
    const second = await api()
      .post(`/api/v1/guest-games/${game.id}/players`)
      .send({ nickname: 'คนที่สอง' })
      .expect(201);
    const secondCookie = String(second.headers['set-cookie']).split(';')[0];
    await api()
      .delete(`/api/v1/game-sessions/${game.id}/players/${second.body.data.playerId}`)
      .set(host)
      .expect(200);
    await api().get(`/api/v1/guest-games/${game.id}`).set('Cookie', secondCookie).expect(401);
    // ลบผู้เล่นคนอื่นด้วยบัตรของตัวเองไม่ได้
    await api()
      .delete(`/api/v1/guest-games/${game.id}/players/${guestId}`)
      .set('Cookie', secondCookie)
      .expect(401);

    // เริ่มเกม → ตอบด้วยบัตร → ได้คะแนน · ห้องเริ่มแล้วรับคนใหม่ไม่ได้
    const started = (
      await api().post(`/api/v1/game-sessions/${game.id}/start`).set(host).expect(200)
    ).body.data;
    const correct = started.question.options.find((o: { isCorrect: boolean }) => o.isCorrect);
    await api()
      .post(`/api/v1/guest-games/${game.id}/players`)
      .send({ nickname: 'มาสาย' })
      .expect(409);
    await sleep(3100);
    await api()
      .post(`/api/v1/guest-games/${game.id}/answers`)
      .set('Cookie', cookie)
      .send({ optionId: correct.id })
      .expect(201);
    await api()
      .post(`/api/v1/guest-games/${game.id}/answers`)
      .set('Cookie', cookie)
      .send({ optionId: correct.id })
      .expect(409);
    await sleep(3800); // ปิดรับใน 3 วินาที + LATE_GRACE_MS
    const result = (
      await api().get(`/api/v1/guest-games/${game.id}`).set('Cookie', cookie).expect(200)
    ).body.data;
    expect(result.me.answer.isCorrect).toBe(true);
    expect(result.me.score).toBeGreaterThan(900);

    // รายงานของผู้เปิดห้องมีชื่อเล่นและคะแนน · core_user_id ของผู้เล่นที่ไม่ล็อกอินเป็น null
    await api().post(`/api/v1/game-sessions/${game.id}/advance`).set(host).expect(200);
    await api().post(`/api/v1/game-sessions/${game.id}/advance`).set(host).expect(200);
    const report = (await api().get(`/api/v1/game-reports/${game.id}`).set(host).expect(200)).body
      .data;
    expect(report.players[0]).toMatchObject({
      nickname: 'ผู้มาเยือน',
      coreUserId: null,
      correct: 1,
    });

    // ห้องปิด (ผู้เปิดห้องลบ) → บัตรใช้ไม่ได้ทันที
    await api().delete(`/api/v1/game-sessions/${game.id}`).set(host).expect(200);
    await api().get(`/api/v1/guest-games/${game.id}`).set('Cookie', cookie).expect(401);

    // จำกัดจำนวนครั้งต่อ IP → 429 + Retry-After
    let limited: request.Response | undefined;
    for (let i = 0; i < 40 && !limited; i++) {
      const r = await api().get(`/api/v1/guest-games?gamePin=${other.gamePin}`);
      if (r.status === 429) limited = r;
    }
    expect(limited?.body.error.code).toBe('TOO_MANY_REQUESTS');
    expect(Number(limited?.headers['retry-after'])).toBeGreaterThan(0);

    // ผ่าน proxy ของ frontend: req.ip มาจาก X-Forwarded-For (trust proxy 1 hop) → นับแยกต่อ IP ของเบราว์เซอร์
    await api()
      .get(`/api/v1/guest-games?gamePin=${other.gamePin}`)
      .set('X-Forwarded-For', '203.0.113.7')
      .expect(200);
    let proxiedLimited = false;
    for (let i = 0; i < 40 && !proxiedLimited; i++) {
      const r = await api()
        .get(`/api/v1/guest-games?gamePin=${other.gamePin}`)
        .set('X-Forwarded-For', '203.0.113.8');
      proxiedLimited = r.status === 429;
    }
    expect(proxiedLimited).toBe(true);
    await api()
      .get(`/api/v1/guest-games?gamePin=${other.gamePin}`)
      .set('X-Forwarded-For', '203.0.113.9')
      .expect(200);

    await api().delete(`/api/v1/game-sessions/${other.id}`).set(host).expect(200);
    await api().delete(`/api/v1/quizzes/${quiz.id}`).set(host).expect(200);
  }, 30_000);
});
