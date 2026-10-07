# CSMJU Quiz — api (NestJS · Prisma 7) · deployment.md ข้อ 3
# build จากรากของ repo:  docker build -f backend/Dockerfile -t csmju-quiz-api .
# ห้ามใส่ secret ใน ARG / ENV — ค่าทุกอย่างมาจาก env ตอนรัน (deployment.md ข้อ 4.2)

# ---------- build stage ----------
FROM node:22-alpine AS build
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/prisma.config.ts ./backend/
COPY backend/prisma ./backend/prisma
# ติดตั้งเฉพาะ backend (postinstall = prisma generate) · ไม่ใส่ --ignore-scripts เพราะ prisma ต้องโหลด engine
# ลบ store ของ pnpm ใน RUN เดียวกัน ไม่งั้นติดไปใน layer อีกหลายร้อย MB
RUN pnpm install --frozen-lockfile --filter backend... \
 && rm -rf "$(pnpm store path)" /root/.cache /root/.local/share/pnpm
COPY backend ./backend
RUN pnpm --filter backend build

# ---------- runtime stage ----------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=4000
# ไม่ chown ทั้งโฟลเดอร์ (image จะโตเท่าตัว) — user node อ่านไฟล์ของ root ได้อยู่แล้ว
COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/package.json /app/backend/prisma.config.ts ./backend/
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/prisma ./backend/prisma
COPY backend/docker/entrypoint.sh /usr/local/bin/entrypoint.sh
WORKDIR /app/backend
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-4000}/api/health" > /dev/null || exit 1
# entrypoint: prisma migrate deploy แล้วเปิดแอป (ห้าม migrate dev / db push / seed ตอนสตาร์ต)
ENTRYPOINT ["sh", "/usr/local/bin/entrypoint.sh"]
