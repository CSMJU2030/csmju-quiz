# CSMJU Quiz — backend

NestJS 11 · Prisma 7.9.1 (PrismaPg) · PostgreSQL 16 · pnpm · Node 22

ระบบย่อย `csmju-quiz` ของ CSMJU2030 — แบบทดสอบ · คลังคำถาม · ห้องเกมแบบเรียลไทม์ · รายงานผล
ผู้ใช้ทุกคนเข้าผ่าน **Core Hub SSO** เท่านั้น (ไม่มีหน้า login / ไม่มีตาราง users)

## เริ่มใช้งาน

### พอร์ตและฐานข้อมูล (ตาม LOCAL_INTEGRATION_GUIDE)

| พอร์ต | ระบบ |
|---|---|
| 3000 | Core Hub backend (API · JWKS · SSO) |
| 3100 | Core Hub frontend (หน้า login · เมนูระบบย่อย) |
| 3001 | สงวนไว้ให้ demo-student-subsystem — **ห้ามใช้** |
| **3002** | **backend นี้** |
| **3102** | **frontend ของ CSMJU Quiz** (`FRONTEND_URL`) |
| 5432 | PostgreSQL ตัวเดียวกับ Core Hub — ระบบนี้ใช้ฐานข้อมูล **`quiz_db`** แยกของตัวเอง |

```bash
# สร้างฐานข้อมูลแยก (ครั้งเดียว) ใน PostgreSQL ที่ :5432
createdb -h localhost -U <user> quiz_db

cp .env.example .env          # แก้ DATABASE_URL=postgresql://<user>:<password>@localhost:5432/quiz_db
pnpm install                  # รันที่ราก repo ครั้งเดียว (workspace) — generate Prisma client ให้อัตโนมัติ
pnpm prisma:deploy            # (ในโฟลเดอร์ backend/) สร้างตารางจาก prisma/migrations
pnpm prisma:seed              # (ไม่บังคับ) build แล้วรัน prisma/seed.js จาก dist/ — ไม่ใช้ ts-node
pnpm start:dev                # http://localhost:3002 · เอกสาร API: /api/docs (ไม่ใช่ production)
```

เปิด http://localhost:3002/api/health — ต้องได้ `"service":"csmju-quiz"`

ต้องมี Core Hub รันอยู่ที่ `http://localhost:3000` — backend ดึงกุญแจจาก JWKS ของ Core Hub
`SUBSYSTEM_ID` ต้องตรงกัน 3 ที่: `.env` · `name` ใน `subsystem.yaml` (ที่ราก repo) · ชื่อในทะเบียน Core Hub

ทางเลือก: `docker compose up -d --build` ที่ราก repo (ฐานข้อมูล `quiz_db` ในคอนเทนเนอร์ เปิดที่ host :5434 เพื่อไม่ชนกับ :5432 · ต้องตั้ง `POSTGRES_PASSWORD` ใน `.env` ที่ราก)

## ลงทะเบียนกับ Core Hub (ครั้งแรกครั้งเดียว)

ใช้บัญชี admin ของ Core Hub · token อายุ 15 นาที · รันทุกบรรทัดใน terminal เดียวกัน

**Windows PowerShell**

```powershell
$CORE = "http://localhost:3000/api/v1"
$TOKEN = (Invoke-RestMethod -Method Post "$CORE/auth/login" -ContentType "application/json" -Body '{"email":"admin@core.local","password":"password1"}').data.access_token
$H = @{ Authorization = "Bearer $TOKEN" }

$body = '{"name":"csmju-quiz","displayName":"CSMJU Quiz","owner":"admin","repo":"CSMJU2030/csmju-quiz","standardsVersion":"1.0","callbackUrl":"http://localhost:3102/auth/callback","defaultRoleMapping":{"student":"PLAYER","alumni":"PLAYER","guest":"PLAYER","staff":"HOST","lecturer":"HOST","admin":"ADMIN"},"requestedExceptions":[]}'
$ID = (Invoke-RestMethod -Method Post "$CORE/subsystems" -Headers $H -ContentType "application/json" -Body $body).data.id

Invoke-RestMethod -Method Post "$CORE/subsystems/$ID/approve"  -Headers $H
Invoke-RestMethod -Method Post "$CORE/subsystems/$ID/activate" -Headers $H
```

**Git Bash / macOS / Linux**

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@core.local","password":"password1"}' | node -e "let s='';process.stdin.on('data',(d)=>s+=d).on('end',()=>console.log(JSON.parse(s).data.access_token))")

curl -s -X POST http://localhost:3000/api/v1/subsystems -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"name":"csmju-quiz","displayName":"CSMJU Quiz","owner":"admin","repo":"CSMJU2030/csmju-quiz","standardsVersion":"1.0","callbackUrl":"http://localhost:3102/auth/callback","defaultRoleMapping":{"student":"PLAYER","alumni":"PLAYER","guest":"PLAYER","staff":"HOST","lecturer":"HOST","admin":"ADMIN"},"requestedExceptions":[]}'

# จด "id" ที่ได้ แล้ว approve + activate
curl -s -X POST http://localhost:3000/api/v1/subsystems/<ID>/approve  -H "Authorization: Bearer $TOKEN"
curl -s -X POST http://localhost:3000/api/v1/subsystems/<ID>/activate -H "Authorization: Bearer $TOKEN"
```

- `defaultRoleMapping` ต้องตรงกับ `src/auth/role-mapping.ts` ทุก key (ai/CHECKLIST.md) — ใส่ครบ 6 core role ตาม authorization.md (standards 1.7.0)
- **Callback URL ต้องเป็นพอร์ต frontend** `http://localhost:3102/auth/callback` — frontend เป็นประตูเดียวและ proxy `/api/*` `/auth/*` มาที่ backend :3002 (connect-core-hub ข้อ 0–1) · ทะเบียนเดิมที่ลง `:3002` ต้องให้ admin ระบบกลางแก้
- Core Hub ตอนนี้ออก token ได้แค่ `student` · `alumni` · `staff` · `admin` (อาจารย์ได้ `staff`) — key `lecturer`/`guest` จึงยังไม่มีผล แต่ไม่ทำให้ผิด
  และจะใช้ได้ทันทีเมื่อ Core Hub เพิ่ม role ใหม่ โดยไม่ต้องแก้ทะเบียน
- `POST /subsystems` ไม่ตรวจชื่อ role จึงลงทะเบียนครบ 6 ได้ · แต่ `PATCH /subsystems/<ID>/role-mapping` ตรวจชื่อ role
  กับตาราง `roles` ของ Core Hub — ถ้าต้องแก้ทะเบียนภายหลังก่อน Core Hub มี `lecturer`/`guest` ให้แจ้งผู้ดูแล Core Hub
- ชื่อซ้ำ (409 `Subsystem name already exists`) = ลงทะเบียนไว้แล้ว ไม่ต้องทำซ้ำ

### ทดสอบการเชื่อมต่อ

```bash
login() { curl -s -X POST http://localhost:3000/api/v1/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"$1@core.local\",\"password\":\"$2\"}" | node -e "let s='';process.stdin.on('data',(d)=>s+=d).on('end',()=>console.log(JSON.parse(s).data.access_token))"; }
ADMIN=$(login admin password1); STAFF=$(login staff password3); STUDENT=$(login student password2); ALUMNI=$(login alumni password4)
```

| # | คำสั่ง | ผลที่ต้องได้ |
|---|---|---|
| Q1 | `curl -s localhost:3002/api/v1/me -H "Authorization: Bearer $STUDENT"` | `"subsystemRole":"PLAYER"` |
| Q2 | `curl -s localhost:3002/api/v1/me -H "Authorization: Bearer $STAFF"` | `"subsystemRole":"HOST"` |
| Q3 | `curl -s -o /dev/null -w '%{http_code}' localhost:3002/api/v1/me` | `401` |
| Q4 | `curl -s -o /dev/null -w '%{http_code}' localhost:3002/api/v1/me -H "Authorization: Bearer abc.def.ghi"` | `401` |
| Q5 | `curl -s -D - -o /dev/null "localhost:3000/api/v1/auth/sso/authorize?subsystem=csmju-quiz&state=q5" -H "Authorization: Bearer $ADMIN" \| grep -i location` | `Location: http://localhost:3102/auth/callback?...` |
| Q6 | เหมือน Q5 แต่ใช้ `$ALUMNI` | `302` — ระบบนี้**อนุญาต alumni** (เป็น PLAYER) |
| Q7 | `curl -s -o /dev/null -w '%{http_code}' -X POST localhost:3002/api/v1/quizzes -H "Authorization: Bearer $STUDENT" -H 'Content-Type: application/json' -d '{"title":"x"}'` | `403` — PLAYER สร้างแบบทดสอบไม่ได้ |

ผ่านหน้าเว็บ: เปิด http://localhost:3102 → กดเข้าสู่ระบบ (`/auth/login`) → login ที่ Core Hub → กลับมา `localhost:3102/auth/callback` (proxy ไป backend) → กลับหน้าเดิม
หรือกดเมนู **CSMJU Quiz** ในพอร์ทัล Core Hub → callback ไม่มี state → ระบบพาไป `/auth/login` แล้วผ่านเอง

## คำสั่ง

| คำสั่ง | ทำอะไร |
|---|---|
| `pnpm build` | build ไป `dist/` |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint + Prettier |
| `pnpm test` | unit test (ไม่ต้องมีฐานข้อมูล) |
| `pnpm test:e2e` | e2e ทั้งแอป — ต้องตั้ง `DATABASE_URL` (ไม่ตั้ง = ข้าม) |
| `pnpm generate:openapi` | สร้าง `openapi.json` ใหม่ (ต้อง commit คู่กับการแก้ endpoint) · ที่ราก repo `pnpm generate:api` สร้างทั้ง `openapi.json` และ type ของ frontend |
| `pnpm prisma:migrate` | สร้าง migration ใหม่ตอนแก้ schema (ห้ามลบ/รวม migration เดิม) |

## API (สรุป — รายละเอียดใน `openapi.json`)

ทุก response ห่อด้วย `{ success, data[, meta] }` หรือ `{ success: false, error: { code, message[, details] } }`

| Method & path | สิทธิ์ | หมายเหตุ |
|---|---|---|
| `GET /api/health` | public | |
| `GET /auth/login?next=` | public | เริ่ม SSO: คุกกี้ `csmju_quiz_sso_state` (Path=/auth/callback · 600 วินาที) → 302 `{CORE_HUB_WEB_URL}/sso/authorize` |
| `GET /auth/callback` | public | auth-contract 1.2 ข้อ 5.1: ไม่มี token 400 · ไม่มี state → 302 `/auth/login` (ไม่ตั้งคุกกี้) · state ไม่ตรง 401 (หน้า "เข้าสู่ระบบอีกครั้ง") · token ไม่ผ่าน 401 · role ไม่รับ 403 · ผ่าน → คุกกี้ `csmju_quiz_access_token` แล้ว 302 ไป `FRONTEND_URL` + next |
| `POST /auth/logout` | public | ลบคุกกี้ session และ state → 303 `{CORE_HUB_WEB_URL}/logout` |
| `GET /api/v1/me` | ล็อกอิน | ตัวตน + role + permissions + `session.expiresAt` (ISO จาก `exp`) |
| `GET/POST /api/v1/quizzes` · `GET/PATCH/DELETE /api/v1/quizzes/:id` | HOST | `PATCH` ส่ง `questions` = แทนที่ทั้งชุด · `status: PUBLISHED` ต้องครบทุกข้อ (ไม่ครบ → 409) |
| `POST /api/v1/quizzes/:id/copies` | HOST | ทำสำเนาเป็นแบบร่าง |
| `GET/POST /api/v1/bank-items` · `GET/PATCH/DELETE /api/v1/bank-items/:id` | HOST | คำถามในคลังต้องครบตอนบันทึก |
| `POST /api/v1/game-sessions` | HOST | เปิดห้องจากแบบทดสอบที่เผยแพร่แล้ว |
| `GET /api/v1/game-sessions?gamePin=123456` | PLAYER | หาห้องที่เปิดรอด้วยรหัสเกม |
| `POST /api/v1/game-sessions/:id/players` | PLAYER | เข้าห้อง (เข้าซ้ำได้ข้อมูลเดิม) |
| `POST /api/v1/game-sessions/:id/start` · `/advance` | HOST | เริ่ม (นับ 3-2-1) · ข้ามไปขั้นถัดไป |
| `POST /api/v1/game-sessions/:id/answers` | PLAYER | ตอบข้อปัจจุบัน 1 ครั้ง · server คิดคะแนน |
| `GET /api/v1/game-sessions/:id` · `/events` | HOST / ผู้เล่นในห้อง | สถานะเกม · `/events` = Server-Sent Events · phase `PODIUM` มี `results` (สถิติ + รางวัลพิเศษ) |
| `GET /api/v1/game-reports` · `/:id` | HOST | รายงานของเกมที่จบแล้ว |
| `GET /api/v1/game-reports/:id/players/:playerId` | HOST | ผลและคำตอบรายข้อของผู้เล่นหนึ่งคน (host ของเกม · ADMIN) |
| `GET /api/v1/game-histories` · `/:id` | PLAYER · HOST · ADMIN | ประวัติการเล่นของ**ตัวเอง** (`game-history:read:own`) · `/:id` = ผลของฉัน + ทบทวนคำตอบรายข้อ · เกมที่ไม่ได้เล่น → 404 |
| `GET /api/v1/me/game-stats` | PLAYER · HOST · ADMIN | สถิติรวมของฉัน (จำนวนเกม · อันดับ 1 · ติดท็อป 3 · ความแม่นยำเฉลี่ย · รางวัลพิเศษ) |

### Role mapping (ต้องตรงกับ `default_role_mapping` ในทะเบียน Core Hub)

| core role | subsystem role | ทำอะไรได้ |
|---|---|---|
| `student` | `PLAYER` | เข้าร่วมเกม · ดูประวัติการเล่นของตัวเอง |
| `alumni` | `PLAYER` | เข้าร่วมเกม · ดูประวัติการเล่นของตัวเอง |
| `guest` | `PLAYER` | เข้าร่วมเกม · ดูประวัติการเล่นของตัวเอง (ผู้เยี่ยมชม) |
| `staff` | `HOST` | สร้างแบบทดสอบ/คลังคำถาม · เปิดห้อง · ดูรายงาน (รวมคำตอบรายคน) ของเกมตัวเอง |
| `lecturer` | `HOST` | เหมือน staff (อาจารย์) |
| `admin` | `ADMIN` | ทุกอย่างของ HOST + ของทุกคน (`:any`) |

เมทริกซ์สิทธิ์ทั้งหมดอยู่ใน `src/auth/permissions.ts` ที่เดียว

## เกมทำงานอย่างไร

server เป็นผู้คุมจังหวะเกมเพียงผู้เดียว (`src/game/game-engine.service.ts`) — ไม่ขึ้นกับแท็บของ host

```
LOBBY → start → QUESTION (นับ 3-2-1 ก่อนข้อแรก) → หมดเวลา หรือทุกคนตอบครบ (+3 วิ) → RESULT (5 วิ)
      → LEADERBOARD (8 วิ, 3 วิสุดท้ายนับถอยหลัง) → ข้อถัดไป … → PODIUM (FINISHED)
```

- เวลาเก็บเป็น timestamp ใน DB → รีสตาร์ต server กลางเกมแล้วเดินต่อได้
- ผู้เล่นไม่เห็น `isCorrect` จนกว่าจะเฉลย · คะแนนคิดที่ server (สูตรเดียวกับหน้าทดลองเล่น `frontend/src/lib/scoring.ts`)
- จบเกม: สถิติรายผู้เล่นและรางวัลพิเศษ (มือไว · ต่อเนื่อง · แม่นยำ) คำนวณที่ server (`src/game/podium.ts`)
- ประวัติการเล่น (`src/history/`) คำนวณจากสำเนาแบบทดสอบในเกม + คำตอบที่บันทึกไว้ ด้วยฟังก์ชันเดียวกับหน้าประกาศผล
  · ไม่มีตารางใหม่ · host ลบห้องเกม = ประวัติของเกมนั้นหายไปด้วย
- state มี `serverTime` ให้หน้าเว็บชดเชยนาฬิกาเครื่องผู้ใช้
- หน้าเว็บรับ state สดด้วย `new EventSource(url, { withCredentials: true })` — event `state` และ `ping`

## โครงสร้าง

```
src/
├── main.ts · app.module.ts · app.setup.ts
├── auth/          ชั้น auth ตาม auth-contract.md (JWKS · verifier 10 ขั้น · guards · SSO callback · /me)
├── common/        envelope · exception filter · validation · pagination · structured log
├── config/        ตรวจ env ด้วย zod ตอนบูต
├── prisma/        PrismaService (Prisma 7 + PrismaPg)
├── questions/     กติกาคำถามกลาง (ตรงกับ frontend question-model)
├── quizzes/ · bank-items/ · game/ · reports/ · health/
├── history/       ประวัติการเล่นของฉัน · สถิติ · ทบทวนคำตอบรายข้อ (ใช้ร่วมกับรายงานรายคน)
prisma/            schema.prisma · migrations/ · seed.js
test/              e2e (+ Core Hub ปลอมสำหรับเทส)
```

## การทำงานกับ repo (github-org-guide)

- ห้าม push เข้า `main` ตรง ๆ — แตก branch `feature/quiz/<เรื่อง>` (ตัวเล็ก + ขีดกลาง) แล้วเปิด PR ให้ `pl-quiz` รีวิว
- commit ตาม Conventional Commits โดย scope = `quiz` เช่น `feat(quiz): add game session api` · `fix(quiz): correct countdown drift`
- merge แบบ Squash เท่านั้น · PR ที่แตะ `backend/openapi.json` ต้องมี PM ร่วม approve
- ใช้ pnpm ตามเวอร์ชันใน `packageManager` ของ `package.json` ที่ราก repo (`corepack enable` แล้ว pnpm จะเลือกเวอร์ชันให้เอง) · lockfile เดียวที่ราก repo
