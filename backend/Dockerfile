# CSMJU Quiz backend — Node 22 · pnpm workspace · Prisma 7
# build จากราก repo:  docker compose build backend   (หรือ docker build -f backend/Dockerfile .)
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/prisma.config.ts ./backend/
COPY backend/prisma ./backend/prisma
# ติดตั้งเฉพาะ backend (postinstall = prisma generate)
RUN pnpm install --frozen-lockfile --filter backend...
COPY backend ./backend
RUN pnpm --filter backend build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && addgroup -S app && adduser -S app -G app
COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/package.json /app/backend/prisma.config.ts ./backend/
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/prisma ./backend/prisma
WORKDIR /app/backend
USER app
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT:-3002}/api/health || exit 1
# ใช้ migration ที่ commit ไว้ แล้วค่อยเปิดแอป
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
