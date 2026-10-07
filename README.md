# csmju-quiz — CSMJU Quiz

ระบบย่อยเกมตอบคำถามของโครงการ CSMJU2030 · แบบทดสอบ · คลังคำถาม · ห้องเกมแบบสด · รายงานผล

| ส่วน | stack | รายละเอียด |
|---|---|---|
| `backend/` | NestJS 11 · Prisma 7.9.1 · PostgreSQL 16 | [`backend/README.md`](backend/README.md) — API · ลงทะเบียนกับ Core Hub · role mapping |
| `frontend/` | Next.js 16 (App Router) · React 19 · Tailwind v4 | [`frontend/README.md`](frontend/README.md) |
| `standards/` | submodule `csmju2030-standards` (อ่านอย่างเดียว) | เวอร์ชันใน [`.standards-version`](.standards-version) = **1.8.4** |

ผู้ใช้เข้าผ่าน **Core Hub SSO** เท่านั้น — ไม่มีหน้า login และไม่มีตาราง users ของตัวเอง

## ติดตั้งและรัน (Node 22 · pnpm 12.3.4 ผ่าน corepack)

```bash
corepack enable pnpm
git submodule update --init standards/          # ให้ standards/ ตรงกับ .standards-version
pnpm install                                    # workspace เดียว lockfile เดียวที่ราก

cp backend/.env.example backend/.env            # แก้ DATABASE_URL (ฐาน quiz_db ของระบบนี้เท่านั้น)
cp frontend/.env.example frontend/.env.local
pnpm --filter backend prisma:deploy             # สร้างตาราง

pnpm dev:backend                                # http://localhost:3002
pnpm dev:frontend                               # http://localhost:3102
```

ต้องมี Core Hub รันอยู่ที่ `http://localhost:3000` (API · JWKS) และ `http://127.0.0.1:3100` (หน้าเว็บ)
ขั้นตอนลงทะเบียนระบบย่อยอยู่ใน [`backend/README.md`](backend/README.md)

ทางเลือก: `docker compose up -d --build` (ตั้ง `POSTGRES_PASSWORD` ใน `.env` ที่รากก่อน)

## ตรวจก่อนเปิด PR (ผลเหมือน CI)

```bash
./standards/scripts/run-all-checks.sh .         # static — 19 ข้อเหมือน CI
rm -rf frontend/.next && pnpm lint && pnpm typecheck && pnpm test && pnpm build
node standards/conformance/run.js               # runtime — ต้องรัน Core Hub + ระบบนี้ไว้ก่อน
```

- branch: `feature/quiz/<เรื่อง>` ตัวพิมพ์เล็กกับขีดกลางเท่านั้น
- commit: `feat|fix|chore|refactor|docs|test|ci(quiz): …`
- ห้ามแก้ `.github/` (ci.yml · CODEOWNERS) และห้ามแก้ไฟล์ใน `standards/`
- เลื่อนเวอร์ชัน standards: PR แยกที่แก้แค่ `.standards-version` กับ submodule `standards`
  (ตาม `standards/docs/standards-versioning.md` ข้อ 2)

## โครงสร้าง

```text
csmju-quiz/
├── .github/            ci.yml · CODEOWNERS — มาจาก new-subsystem.sh (DevOps เท่านั้น)
├── .standards-version  1.8.4
├── standards/          submodule
├── subsystem.yaml      manifest ที่ CI และ conformance อ่าน
├── pnpm-workspace.yaml · package.json · pnpm-lock.yaml
├── docker-compose.yml
├── backend/            NestJS (ARC-04)
└── frontend/           Next.js — ข้อมูลทุกอย่างผ่าน backend (ARC-01)
```

ผลตรวจล่าสุดอยู่ใน [`REPORT.md`](REPORT.md)
