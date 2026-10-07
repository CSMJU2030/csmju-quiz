#!/bin/sh
# api ของ CSMJU Quiz — รัน migration ที่ commit ไว้ แล้วเปิดแอป (deployment.md ข้อ 3.1 · 4.1)
# ใช้ prisma migrate deploy เท่านั้น — ห้าม migrate dev · db push · seed
set -e
cd /app/backend
node_modules/.bin/prisma migrate deploy
exec node dist/main.js
