# CSMJU Quiz — หน้าเว็บ (Next.js standalone) · ตาม standards/templates/csmju-subsystem-web/Dockerfile
# deployment.md ข้อ 3 · build จากรากของ repo (lockfile ของ pnpm workspace อยู่ที่ราก):
#   docker build -f frontend/Dockerfile -t csmju-quiz-web .
#
# - BACKEND_URL ถูกฝังลง image ตอน build (rewrites ของ next.config.ts คำนวณตอน next build)
#   ค่าเริ่มต้น http://api:4000 คือ service "api" ใน compose ของระบบเดียวกัน (deployment.md ข้อ 3.1)
# - NEXT_PUBLIC_* ถูกฝังตอน build เช่นกัน (ไม่ใช่ความลับ) · ห้ามใส่ secret ใน ARG / ENV

# ---------- build stage ----------
FROM node:22-alpine AS builder

RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable pnpm

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY frontend/package.json frontend/
RUN pnpm install --frozen-lockfile --filter frontend...

COPY frontend/ frontend/
RUN mkdir -p frontend/public
ARG BACKEND_URL=http://api:4000
ARG NEXT_PUBLIC_CORE_HUB_WEB_URL=https://csmju2030.jowave.com
ARG NEXT_PUBLIC_SUBSYSTEM_NAME=csmju-quiz
ENV BACKEND_URL=$BACKEND_URL \
    NEXT_PUBLIC_CORE_HUB_WEB_URL=$NEXT_PUBLIC_CORE_HUB_WEB_URL \
    NEXT_PUBLIC_SUBSYSTEM_NAME=$NEXT_PUBLIC_SUBSYSTEM_NAME
RUN pnpm --filter frontend build

# ---------- runtime stage ----------
FROM node:22-alpine AS runner

WORKDIR /app
ARG BACKEND_URL=http://api:4000
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    BACKEND_URL=$BACKEND_URL

# standalone ของ pnpm workspace คงโครงของ workspace ไว้: /app/frontend/server.js
COPY --from=builder --chown=node:node /app/frontend/.next/standalone ./
COPY --from=builder --chown=node:node /app/frontend/.next/static ./frontend/.next/static
COPY --from=builder --chown=node:node /app/frontend/public ./frontend/public

USER node
EXPOSE 3000

# ตรวจแค่ว่า server รับการเชื่อมต่อ — ไม่ขึ้นกับ backend
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "require('net').connect(3000,'127.0.0.1').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))"

CMD ["node", "frontend/server.js"]
