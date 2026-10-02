# CSMJU Quiz — frontend

Next.js 16 (App Router) · React 19 · Tailwind v4 · pnpm · Node 22

## เริ่มใช้งาน

```bash
cp .env.example .env.local    # แล้วแก้ค่าตามเครื่อง (BACKEND_URL · ค่า default http://127.0.0.1:3002)
pnpm install                  # รันที่ราก repo ครั้งเดียว (workspace)
pnpm dev                      # http://localhost:3102 · ต้องรัน backend ที่ :3002 ด้วย
```

ข้อมูลทุกหน้า (แบบทดสอบ · คลังคำถาม · ห้องเกม · รายงาน) มาจาก backend ผ่าน `src/lib/*-store.ts`
และ `src/lib/game-api.ts` เท่านั้น — หน้าเว็บไม่เก็บข้อมูลเกมหรือ token ในเบราว์เซอร์
(`localStorage` ใช้จำแค่ชื่อ/รูปที่ใช้ครั้งก่อน และค่าปิดเสียง)

type ของ API generate จาก `backend/openapi.json` (`src/types/api.d.ts` — ห้ามแก้เอง)
แก้ endpoint แล้วรัน `pnpm generate:api` ที่ราก repo

**ประตูเดียว** (standards 1.7.0 · connect-core-hub ข้อ 1): เบราว์เซอร์คุยกับ `http://localhost:3102` เท่านั้น
`next.config.ts` ส่ง `/api/*` และ `/auth/login` · `/auth/callback` · `/auth/logout` ต่อไป backend (`BACKEND_URL`)
คุกกี้ session `csmju_quiz_access_token` (HttpOnly) จึงผูกกับ origin ของหน้าเว็บ — หน้าเว็บไม่อ่านคุกกี้นี้
เปิดด้วย `http://localhost:3102` (ไม่ใช่ `127.0.0.1`) ให้ตรงกับ callback ที่ลงทะเบียนไว้

## พอร์ต (ตาม LOCAL_INTEGRATION_GUIDE)

| พอร์ต    | ระบบ                                          |
| -------- | --------------------------------------------- |
| 3000     | Core Hub backend (API · JWKS · SSO)           |
| 3100     | Core Hub frontend (หน้า login · เมนูระบบย่อย) |
| 3001     | สงวนไว้ให้ demo-student-subsystem — ห้ามใช้   |
| 3002     | backend ของ CSMJU Quiz                        |
| **3102** | **หน้าเว็บนี้**                               |

## เข้าสู่ระบบ

ระบบย่อยไม่มีหน้า login ของตัวเอง — `GET /auth/login?next=<หน้า>` (proxy ไป backend) พาไป Core Hub
→ Core Hub ส่งกลับมาที่ `localhost:3102/auth/callback` → backend ตั้งคุกกี้แล้วพากลับหน้าเดิม
· API ตอบ 401 → หน้าเว็บพาทั้งหน้าไป `/auth/login?next=<path+query>` เอง (silent re-SSO · auth-contract ข้อ 7)
กันวน 30 วินาที และหน้าที่มีงานกรอกค้าง (แก้ไข/สร้างแบบทดสอบ) จะแสดงปุ่ม "เข้าสู่ระบบอีกครั้ง" แทนการ redirect ทับ
· ออกจากระบบ = `POST /auth/logout` (303 ไป `/logout` ของ Core Hub) · หน้า `/play` ของผู้เล่นที่สแกน QR ไม่เรียก `/me` และไม่พาไป SSO

ห้องเกมรับสถานะสดจาก backend ด้วย Server-Sent Events (`/api/v1/game-sessions/:id/events` · `/api/v1/guest-games/:id/events`)
ผ่าน proxy เดียวกัน (`compress: false` ใน `next.config.ts` เพื่อไม่ให้ gzip กัก stream)
เฟสและเวลาทั้งหมด server เป็นผู้ควบคุม — ปิดแท็บของ host เกมก็ยังเดินต่อ

## หน้าจอหลัก

| หน้า                                                                         | ใครเห็น               | ทำอะไร                                                                    |
| ---------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------- |
| `/`                                                                          | ทุกคน                 | ผู้เล่น: ช่องใส่รหัสเกม + เกมล่าสุด 3 เกม                                 |
| `/game/join`                                                                 | PLAYER · HOST         | เข้าร่วมเกมด้วยรหัส 6 หลัก                                                |
| `/history` · `/history/:sessionId`                                           | PLAYER · HOST · ADMIN | ประวัติการเล่นของฉัน + สถิติ · ทบทวนคำตอบรายข้อ (กรองเฉพาะข้อที่ควรทบทวน) |
| `/dashboard` · `/quiz` · `/question-bank` · `/game/create`                   | HOST                  | จัดการแบบทดสอบ คลังคำถาม เปิดห้อง                                         |
| `/reports` · `/reports/:sessionId` · `/reports/:sessionId/players/:playerId` | HOST                  | รายงานผลเกม · คำตอบรายข้อของผู้เล่นแต่ละคน                                |

ข้อมูลทุกหน้ามาจาก backend · เบราว์เซอร์เก็บแค่ชื่อเล่นและรูปโปรไฟล์ล่าสุด (ค่าความสะดวก ไม่ใช่ข้อมูลธุรกิจ)

## คำสั่ง

| คำสั่ง                      | ทำอะไร                                                   |
| --------------------------- | -------------------------------------------------------- |
| `pnpm dev`                  | dev server ที่พอร์ต 3102                                 |
| `pnpm build` · `pnpm start` | build แล้วรันแบบ production ที่พอร์ต 3102                |
| `pnpm lint`                 | ESLint + Prettier                                        |
| `pnpm typecheck`            | ตรวจ type                                                |
| `pnpm test`                 | vitest                                                   |
| `pnpm generate:api-types`   | สร้าง `src/types/api.d.ts` จาก `../backend/openapi.json` |
