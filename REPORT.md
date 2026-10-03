# REPORT — csmju-quiz

วันที่: 2026-09-30 · มาตรฐาน **v1.0.6** (สาย 1.0.x · สัญญา SSO 1.0) · ระดับเป้าหมาย L3

## ผลรัน

### CI static checks — `./standards/scripts/run-all-checks.sh .` (standards v1.0.6)

รันบน repo ทดสอบที่จัดโครงเหมือนจริง (clone ใหม่ · `pnpm install --frozen-lockfile` · submodule `standards` ชี้ `v1.0.6`
· branch `feature/quiz/…` · commit `feat(quiz): …`) — QA-01..04 รันจริง ไม่ได้ข้าม · รันซ้ำหลังเพิ่มประวัติการเล่นแล้ว

```
  ✅ PASS  Convention Check            check-branch-name.sh
  ✅ PASS  Convention Check            check-commit-messages.sh
  ✅ PASS  Convention Check            check-ci-untouched.sh
  ✅ PASS  Standards Version Check     check-submodule-pointer.sh
  ✅ PASS  Security & Stack Scan       check-no-secrets.sh
  ✅ PASS  Security & Stack Scan       check-no-local-storage.sh
  ✅ PASS  Security & Stack Scan       check-no-jwt-verify.sh
  ✅ PASS  Security & Stack Scan       check-db-isolation.sh
  ✅ PASS  Security & Stack Scan       check-authorized-deps.sh
  ✅ PASS  Security & Stack Scan       check-backend-nestjs.sh
  ✅ PASS  API Contract Sync           check-openapi-sync.sh
  ✅ PASS  API Contract Sync           check-api-conventions.sh
  ✅ PASS  Data Dictionary Compliance  check-field-aliases.sh
  ✅ PASS  Data Dictionary Compliance  check-snake-case.sh
  ✅ PASS  Data Dictionary Compliance  check-no-hardcoded-faculty.sh
  ✅ PASS  Data Dictionary Compliance  check-money-fields.sh
  ✅ PASS  UI Token Compliance         check-ui-tokens.sh
  ✅ PASS  Code Quality                check-qa.sh
  ✅ PASS  Exception Validation        check-exceptions.sh

✅ All 19 checks passed.
```

### Code Quality (ส่วนหนึ่งของ check-qa)

| | backend | frontend |
|---|---|---|
| lint (ESLint + Prettier) | ✅ | ✅ |
| typecheck | ✅ `tsc --noEmit` | ✅ `next typegen && tsc --noEmit` |
| unit test | ✅ 34/34 (jest) | ✅ 44/44 (vitest) |
| build | ✅ `nest build` | ✅ `next build` |

### เทสอื่นที่รันแล้ว

- `pnpm --filter backend test:e2e` (บูตแอปจริง + PostgreSQL 16 + Core Hub ปลอม) — **7/7 ผ่าน**
  รวมเคส: `lecturer` = HOST · `guest` = PLAYER · guest สร้างแบบทดสอบได้ 403 · เล่นจนจบแล้ว `results` มีสถิติและรางวัล
  · ประวัติการเล่น/สถิติของผู้เล่น · host ไม่เห็นเกมที่ไม่ได้เล่น · ผู้ใช้อื่นเปิดประวัติคนอื่น 404 · ผู้เล่นเปิดรายงานรายคน 403
- **เบราว์เซอร์จริงกับ Core Hub จริง** (`csmju-core-hub` main · Playwright + Chromium) — ล็อกอินที่หน้า Core Hub → กดไทล์
  CSMJU Quiz ในพอร์ทัล → SSO → `/auth/callback` · 3 บัญชี (staff · student · alumni) — **26/26 ขั้นผ่าน · ไม่มี console error**
  สร้างแบบทดสอบผ่านหน้าเว็บ → เพิ่มคำถาม → เผยแพร่ → คลังคำถามโหลดจาก backend → เปิดห้อง (ได้ PIN) →
  student + guest เข้าร่วมด้วย PIN → host เห็นผู้เล่นแบบสด (SSE) → นับ 3-2-1 → ตอบ → เฉลย (ถูก / หมดเวลา) →
  ประกาศผลพร้อมรางวัลที่ server คำนวณ → รายงาน · ไม่มี request API ใดตอบ 4xx/5xx
  · host เปิดคำตอบรายคนจากตารางรายงาน · ผู้เล่นเปิดประวัติ → ทบทวนคำตอบ · alumni เห็นข้อหมดเวลาในหมวด "ควรทบทวน"
  · หน้าแรกผู้เล่นมีช่องรหัสเกม + เกมล่าสุด (host ที่ไม่เคยเล่นไม่เห็น) · browser storage เหลือแค่ `csmju:last-nickname` และ `csmju:last-avatar`
- smoke test ทุกหน้า (dashboard · quiz · overview · preview · edit · reports · question-bank · game/create) — ผ่าน
- จำลองขั้นตอน `backend/Dockerfile` (install แบบ workspace → build → migrate deploy → start) — `/api/health` ตอบ `csmju-quiz`

### conformance (runtime)

✅ `node standards/conformance/run.js` กับ **Core Hub จริง** (`csmju-core-hub` main) หลังลงทะเบียนด้วยคำสั่งใน `backend/README.md`
(6 role · approve · activate) — **62 passed · 0 failed · 0 skipped → CONFORMANT L3**

## รอบแก้ล่าสุด (2 ต.ค. 2569) — ตามผลพิจารณาของ PM

- **บัตรเข้าห้อง:** ผู้เล่นสแกน QR แล้วใส่ชื่อเล่นกับเลือกรูป เล่นได้โดยไม่ล็อกอิน
  - endpoint ของผู้เล่นอยู่ที่ `/api/v1/guest-games/*` ประกาศใน `public_endpoints` แล้ว
  - บัตรเป็นค่าสุ่ม 32 bytes ฐานข้อมูลเก็บเฉพาะ sha256 ส่งเป็นคุกกี้ `quiz_room_pass` (HttpOnly · SameSite=Lax · Secure เมื่อ production · path ของห้อง)
  - หมดอายุเมื่อปิดห้อง ถูกนำออก หรือครบ 4 ชั่วโมง · ห้องละไม่เกิน 100 คน
  - จำกัดการค้นห้องและการเข้าร่วม 30 ครั้งต่อนาทีต่อ IP เกินแล้วตอบ `429 TOO_MANY_REQUESTS` + `Retry-After`
  - endpoint อื่นยังอยู่หลัง `CoreHubJwtGuard` ทั้งหมด · ปิดโหมดนี้ได้ด้วย `GUEST_PLAY_ENABLED=false`
  - migration `20261002000000_room_pass`: `core_user_id` เป็นค่าว่างได้ + `room_pass_hash` + `room_pass_expires_at`
- **ห้องรอมี QR** ชี้ไป `/play?pin=` · ผู้สอนนำผู้เล่นออกได้ (มี ConfirmDialog)
- **หน้า `/play`:** ใช้หน้าเข้าร่วม หน้าเล่น และหน้าผลชุดเดียวกับผู้เล่นที่ล็อกอิน ไม่เรียก `/me` ไม่พาไป SSO ไม่มีเมนู
- **ตัดประวัติฝั่งผู้เล่น:** ถอด `/api/v1/game-histories` `/api/v1/me/game-stats` และหน้า `/history` ออก ผลรายคนย้ายไปอยู่ใน `src/reports/`
- **สีปุ่มตัวเลือก:**
  - ย้ายไป `frontend/src/components/game/answer-colors.module.css` (4 class)
  - ไอคอนรูปทรงและเครื่องหมายถูก/ผิดมาจาก `icons.tsx` ชุดเดียว ขนาดอย่างน้อย 24px ทุกที่
  - ไม่มีอักขระ ✓/✗ แล้ว
- **ผลรัน:**
  - backend unit 40 · e2e 8 (มีเคสบัตรเข้าห้องครบทุกเงื่อนไข) · frontend 44 · `next build` ผ่าน
  - conformance 62/62
  - CI 18/19: UI-01 ไม่ผ่านจนกว่า DevOps จะเพิ่มข้อยกเว้นของไฟล์สี (ทดสอบแล้วว่าเมื่อเพิ่มแล้วผ่าน 19/19)
  - เบราว์เซอร์จริง: ผู้เล่นที่ล็อกอิน 24 ขั้น · ผู้เล่นที่สแกน QR 9 ขั้น ไม่มี console error
- **คำร้องที่ต้องยื่น:** `issue-1-room-pass.md` · `issue-2-answer-colors.md` (มีข้อเสนอระยะเวลาเก็บรายงาน 180 วัน)

## รอบแก้ก่อนหน้า (1 ต.ค. 2569)

- **สีปุ่มตัวเลือกคำตอบ** — พื้นสีเต็ม ตัวอักษรและไอคอนรูปทรงสีขาว: แดง ◆ · น้ำเงิน ▲ · เหลืองทอง ■ · เขียว ●
  · เฉลยมี ✓ "ถูก" / ✗ "ผิด" · เลือกแล้วมีกรอบ + "เลือกแล้ว" · ใช้ที่หน้าเล่น จอผู้สอน ตัวแก้ไข และหน้ารายละเอียด
  · สีรวมไว้ที่ `frontend/src/components/game/answer-colors.ts` ไฟล์เดียว ตอนนี้ใช้ token ที่มีอยู่แล้ว (error · primary-container · brand-amber · success) จึงผ่าน UI-01
- **ฟอนต์ / สี / ขนาดตัวอักษร** ตามข้อ 3.1 · 4.1–4.3 (self-host 4 ไฟล์ด้วย `next/font/local` · preload ไทย 400/600)
- **ข้อความ error ภาษาไทยทั้งหมด** · toast เฉพาะสำเร็จ · error เป็น Alert inline · หน้าโหลดไม่สำเร็จแยกตาม `error.code` (403 · 404 · อื่น ๆ + ลองอีกครั้ง)
- **แบ่งหน้า/ค้นหา/เรียงที่ backend** (ข้อ 8.2) — แบบทดสอบของฉัน (`status=ACTIVE` · `sort=questionCount`) และรายงาน (`search=`)
- ฟอร์มเข้าร่วมเกมตรวจตอนออกจากช่อง และพา focus ไปช่องแรกที่ผิด · ปุ่มที่กดไม่ได้มีเหตุผลกำกับ (`aria-describedby`)
- เมนูผู้ใช้แสดงบทบาทตามข้อ 10.3 (เช่น "บุคลากร/อาจารย์ · ผู้สอน") · เมนูซ้ายเป็นภาษาไทยอย่างเดียว
- ผลรัน: CI 19/19 · conformance 62/62 · backend unit 34 + e2e 7 · frontend 44 · เบราว์เซอร์จริงกับ Core Hub จริง 26 ขั้นผ่าน

### คำร้องถึง PM (รอผล)

1. **ทางเข้าผู้เยี่ยมชมจาก Core Hub** — สแกน QR แล้วเล่นได้โดยไม่ล็อกอิน (token role `guest` อายุ 15 นาที ต่ออายุเงียบด้วย `sub` เดิม · session ≤ 4 ชั่วโมง)
   ยังไม่ทำในระบบนี้จนกว่าจะอนุมัติ — QR บนหน้าห้องรอทำพร้อมกันหลังได้ผล
2. **ชุดสีตัวเลือกคำตอบในเกม** — ขอแดง D0103A · น้ำเงิน 1F6FD1 · เหลืองทอง A16207 · เขียว 237A12 (ตัวอักษรขาว ผ่าน AA ทุกสี)
   อนุมัติแล้ว: เพิ่ม token `answer-1..4` ใน `app/globals.css` แล้วเปลี่ยนชื่อ class 4 ชุดใน `answer-colors.ts`

### ยังค้าง

- ย้ายมาตรฐานเป็น **1.7.0** (สาย 1.0.x ปิดแล้ว) — ตัวตรวจ token 10 ขั้น · SSO มี `state` ผ่าน `/sso/authorize` · ชื่อคุกกี้ใหม่ ·
  `subsystem.yaml` (`core_hub_web_url` · บล็อก `ui:` · ย้ายบัญชี conformance ออก) — PR ต้องให้ DevOps/PM approve
- คลังคำถามยังกรองแท็ก/ระดับความยาก/ค้นหาในหน้าเว็บ (เป็นการ์ด ไม่ใช่ตาราง) — ย้ายไป backend ได้เมื่อเพิ่มตัวกรองแท็กใน API

## เพิ่มก่อนหน้า: ประวัติการเล่นและผลรายคน

**backend**
- `src/history/` (ใหม่) — `player-review.ts` (ฟังก์ชันล้วน: ผลของผู้เล่น + ทบทวนรายข้อ + สรุปสถิติ ใช้ `computeAwards`/`rankPlayers` เดิม)
  · `history.service.ts` (ตรวจ ownership ใน query: `game_players.core_user_id = token.sub`) · controller 2 ตัว · `history.dto.ts` · `history.mapper.ts` · unit test
- `GET /api/v1/game-histories` · `/:id` · `GET /api/v1/me/game-stats` — permission ใหม่ `game-history:read:own` (PLAYER · HOST · ADMIN)
- `GET /api/v1/game-reports/:id/players/:playerId` — host ดูคำตอบรายคน (สิทธิ์เดียวกับรายงาน)
- `src/auth/permissions.ts` · `app.module.ts` · `src/reports/*` · `test/app.e2e-spec.ts` · `openapi.json` (generate ใหม่)
- ไม่มี migration / ตารางใหม่ — ใช้ `game_players` · `game_answers` · `quiz_snapshot` ที่มีอยู่

**frontend**
- `/history` — สถิติรวม + รายการเกมที่เล่น (แสดงเพิ่มทีละ 10) · `/history/[sessionId]` — ผลของฉัน + ทบทวนคำตอบรายข้อ (กรอง "ควรทบทวน")
- `/reports/[sessionId]/players/[playerId]` — host ดูคำตอบรายคน · ตารางผู้เล่นในรายงานมีลิงก์ "ดูคำตอบ"
- หน้าแรก — ส่วน "การเล่นของฉัน" สำหรับผู้เล่น: ช่องรหัสเกม + เกมล่าสุด 3 เกม
- `components/history/*` (ใหม่) · `lib/history.ts` + test · `lib/awards.ts` (ย้ายชื่อรางวัลมาจาก `podium-view.tsx` ให้ใช้ร่วมกัน)
- เมนู "ประวัติการเล่น" · `HistoryIcon` · `permissions.ts` · `api-types.ts` · `types/api.d.ts` (generate ใหม่)

## ปรับหน้าจอ (ui-design-system.md ข้อ 5.1)

- แถบบนมีปุ่ม **← กลับหน้าหลัก** (ไปพอร์ทัล Core Hub) · มี **breadcrumb** อัตโนมัติจาก route (`lib/breadcrumb.ts` + test) — ไม่แสดงในห้องเกมเต็มจอ
- เมนูซ้ายเรียงตามลำดับงานของผู้สอน (ภาพรวม → แบบทดสอบ → คลังคำถาม → รายงาน) แล้วแยกหมวด **เล่นเกม** (เข้าร่วมเกม · ประวัติการเล่น) ไว้ล่าง
  · ผู้เล่นเห็นแค่ 2 เมนูโดยไม่มีหัวหมวด · รูปแบบรายการเมนูยังเป็น `{ label, href, icon }` ย้ายไป `CsmjuAppShell` ได้
- หน้าแรกผู้เล่น: ช่องรหัสเกมจุดเดียว (ตัด "เริ่มต้นใช้งาน" ที่ซ้ำ) · ข้อความ "ความสามารถของระบบ" แสดงเฉพาะก่อนล็อกอิน
- หน้าภาพรวมผู้สอน: ส่วน **ห้องที่เปิดอยู่** (รอผู้เล่น / กำลังเล่น) พร้อมปุ่มกลับเข้าห้อง — ใช้ `GET /api/v1/game-sessions?status=` ที่มีอยู่แล้ว
- หน้าแรกของผู้สอน = หน้าภาพรวม (ผู้สอนเข้า `/` แล้วไป `/dashboard`) · เพิ่ม **เกมล่าสุด** 3 เกม (กดไปรายงาน)
  · แบบทดสอบที่เผยแพร่แล้วมีปุ่ม **เปิดห้อง**
- ฟอร์มเรียงปุ่มล่างซ้าย `[บันทึก] [ยกเลิก]` (ข้อ 8.1) · breadcrumb อยู่ในหัวของแต่ละหน้าให้ตรงแนวเนื้อหา · ตัดปุ่มกลับที่ซ้ำกับ breadcrumb
- ตรวจที่หน้าจอมือถือ 375px (หน้าแรก · ประวัติ · ทบทวนคำตอบ · เมนู drawer) — ไม่มีการเลื่อนแนวนอน

## ไฟล์ที่สร้าง/แก้ไข (รอบก่อน)

**ราก repo (ใหม่)**
- `package.json` · `pnpm-workspace.yaml` · `pnpm-lock.yaml` — workspace เดียว lockfile เดียว (QA-05/06) · `packageManager: pnpm@12.3.4` (tech-stack 1.0.6)
  · `allowBuilds` ใน workspace (pnpm 12 ไม่อนุญาต build script = install ล้ม)
- `subsystem.yaml` — ย้ายจาก `backend/` · `standards_version: "1.0.6"` · owners `pl-quiz` / `aie-quiz`
- `.standards-version` = `1.0.6`
- `.gitignore` · `.dockerignore` · `docker-compose.yml` (db + backend + frontend) · `README.md` · `REPORT.md` (ย้ายจาก backend)

**backend**
- `src/auth/role-mapping.ts` · `me.dto.ts` — core role ครบ 6 ค่า: `lecturer` → HOST · `guest` → PLAYER (authorization.md 1.0.6)
- `src/game/podium.ts` (ใหม่) + `game-sessions.service.ts` · `game.dto.ts` — phase PODIUM ส่ง `results` (สถิติรายผู้เล่น + รางวัลพิเศษ)
  คำนวณที่ server แทนหน้าเว็บ · `GamePlayerView.streak`
- `src/reports/*` — `avatarIndex` ในรายงานผู้เล่น
- DTO ที่เป็น `string | null` / `number | null` ระบุ `type` ชัด (เดิม openapi.json ได้ type เป็น object ว่าง ทำให้ generate type ไม่ได้)
- `game-sessions.controller.ts` — ประกาศ response ของ `GET /game-sessions` (lobby / summary) ใน OpenAPI
- `openapi.json` — generate ใหม่
- `.prettierignore` (ใหม่) — ไม่ตรวจ `src/generated/` (เดิม lint ตก 15 ไฟล์)
- `.gitignore` — แก้ `generated/` ที่มี comment ท้ายบรรทัด (git ไม่รองรับ → pattern ไม่ทำงาน · Prisma client จะหลุดเข้า git)
- `Dockerfile` — build จากราก repo แบบ workspace
- `package.json` — ย้าย `packageManager` / ค่า pnpm ไปที่ราก
- `test/*` · `src/**/*.spec.ts` — เทส role ใหม่ · podium · lifecycle จนจบเกม

**frontend** — เลิกใช้ `localStorage` เป็นฐานข้อมูล ทุกหน้าเรียก backend
- `src/types/api.d.ts` (generate จาก `backend/openapi.json` ด้วย `openapi-typescript` — tech-stack ข้อ 3) · `src/lib/api-types.ts`
- `src/lib/quiz-store.ts` · `question-bank.ts` · `report-store.ts` — เขียนใหม่ให้เรียก `/api/v1/quizzes` · `/bank-items` · `/game-reports`
- `src/lib/game-api.ts` (ใหม่) — คำสั่งเกม + `useGameState` (SSE `/events` · สำรองด้วยการดึงซ้ำ · ชดเชยนาฬิกาด้วย `serverTime`)
- หน้าเกม `host` · `play` · `leaderboard` · `podium` · `join` · `game/create` — แสดงสถานะจาก server (server คุมเฟสและเวลา)
- หน้า quiz · question-bank · reports · dashboard · bank-picker — เปลี่ยนเป็น async ต่อ API และแสดงข้อผิดพลาดภาษาไทย
- `src/lib/permissions.ts` · `hooks/use-current-user.tsx` · `components/shell/app-shell.tsx` — role ครบ 6 ค่า · ยังไม่รู้ตัวตน = ไม่แสดงเมนู
  (เดิมโหมดในเครื่องแสดงทุกเมนู) · แจ้งเตือนเมื่อไม่ได้ตั้ง API / ไม่มีสิทธิ์ / เชื่อมต่อไม่ได้
- `src/lib/scoring.ts` (ใหม่) — สูตรคะแนนสำหรับหน้าทดลองเล่นเท่านั้น · `play-engine.ts` · `player-session.ts` เหลือแค่ส่วนที่ยังใช้
- `Dockerfile` (ใหม่) · `.env.example` (`NEXT_PUBLIC_API_BASE_URL` บังคับ) · `.prettierignore` · `package.json` (+ `openapi-typescript`, script `generate:api-types`)

**ลบ** — `backend/{subsystem.yaml,docker-compose.yml,.dockerignore,REPORT.md,pnpm-lock.yaml}` · `frontend/pnpm-lock.yaml`
· `frontend/src/lib/{game-store,game-store.test,game-flow,mock-data,podium-awards,podium-awards.test,game-snapshot}.ts`
· `frontend/src/hooks/use-now.ts`

## ชั้น auth ที่คัดลอกมา
- คัดลอกจาก demo-student-subsystem: **ไม่ได้** — repo เป็น private เข้าถึงไม่ได้ ชั้น auth เดิมเขียนตาม auth-contract.md (สัญญา SSO 1.0)
- แก้ไขรอบนี้: `role-mapping.ts` (ค่าในตารางเท่านั้น) · `me.dto.ts` (enum ของ OpenAPI) — ไม่แตะตรรกะการตรวจ token

## Role mapping ที่ประกาศ (ต้องตรงกับ default_role_mapping ในทะเบียน)
| core role | subsystem role |
|---|---|
| student | PLAYER |
| alumni | PLAYER |
| guest | PLAYER |
| staff | HOST |
| lecturer | HOST |
| admin | ADMIN |

## ข้อสมมติที่ตั้งเอง (เพราะมาตรฐานไม่ได้ระบุ)
1. เลือกสาย 1.0.x (1.0.6) ไม่ขึ้น 1.1+ — ทุกทีมยังใช้สัญญา SSO 1.0 · 1.0.6 ได้ role `lecturer`/`guest` โดยไม่ต้องเปลี่ยน SSO
2. อาจารย์ (`lecturer`) เปิดห้องได้เหมือน `staff` · ผู้เยี่ยมชม (`guest`) เข้าร่วมเล่นได้เหมือน `student`
3. รางวัลพิเศษ "มือไวที่สุด" ตัดสินจากเวลาตอบ (`responseMs`) ที่ server บันทึก แทนเวลาที่เครื่องผู้เล่น
4. host ไม่มีปุ่ม "นับถอยหลัง 3 วินาทีก่อนปิดรับ" แล้ว — server นับให้อัตโนมัติเมื่อทุกคนตอบครบ · ปุ่มที่เหลือใช้ `POST /advance`
5. หน้า "แบบทดสอบของฉัน" ใช้สรุปจาก `GET /quizzes` ทีละ 20 รายการ (เพิ่ม `totalTimeLimit` ในสรุป) — หน้าภาพรวม/เปิดห้อง/คลังคำถามยังโหลดรายละเอียดทุกชุด
6. ข้อสมมติเดิม (SSE · ผู้เล่นต้องล็อกอินผ่าน Core Hub · snapshot ตอนเปิดห้อง · ตัวจับเวลา process เดียว) ยังคงเดิม

## สิ่งที่ยังทำไม่ได้ / เคสที่ยังไม่ผ่าน
- **ต้องให้ DevOps/PM สร้าง repo** `csmju-quiz` ด้วย `new-subsystem.sh quiz` — ได้ `.github/workflows/ci.yml` · `.github/CODEOWNERS`
  · submodule `standards` (ชี้ `v1.0.6`) · Team `pl-quiz` / `aie-quiz` (AIE ห้ามสร้าง/แก้ `.github/` เอง — GH-03)
- ลงทะเบียนใน Core Hub ด้วย `POST /subsystems` ครบ 6 role ให้ตรงกับโค้ด (คำสั่งใน `backend/README.md`) → approve → activate
  · Core Hub ปัจจุบันออก token แค่ 4 role — `lecturer`/`guest` ยังไม่มีผลจนกว่า Core Hub จะรองรับ
- `run-all-checks.sh` ในเครื่องตัวเองจะเห็น SEC-01 ถ้า `backend/.env` มี `postgresql://user:pass@…` — สคริปต์ค้นไฟล์ในโฟลเดอร์
  ไม่ใช่ใน git · ใน CI ไม่มีไฟล์นี้ (ถูก gitignore) จึงผ่าน · ตรวจในเครื่องให้ย้าย `.env` ออกชั่วคราวก่อนรัน
- ยังไม่ได้ build Docker image จริง (เครื่องทดสอบไม่มี Docker daemon) — จำลองขั้นตอน backend แล้วผ่าน
