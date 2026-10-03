# CSMJU Quiz frontend — Next.js · pnpm workspace
# ค่า NEXT_PUBLIC_* ถูกฝังตอน build จึงส่งเป็น build args (ไม่ใช่ความลับ)
# BACKEND_URL = ปลายทางของ proxy /api/* · /auth/* (next.config.ts rewrites ถูกเขียนลง .next ตอน build)
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
ARG BACKEND_URL=http://127.0.0.1:3002
ARG NEXT_PUBLIC_CORE_HUB_WEB_URL=https://csmju2030.jowave.com
ARG NEXT_PUBLIC_SUBSYSTEM_NAME=csmju-quiz
ENV BACKEND_URL=$BACKEND_URL \
    NEXT_PUBLIC_CORE_HUB_WEB_URL=$NEXT_PUBLIC_CORE_HUB_WEB_URL \
    NEXT_PUBLIC_SUBSYSTEM_NAME=$NEXT_PUBLIC_SUBSYSTEM_NAME \
    NEXT_TELEMETRY_DISABLED=1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json ./frontend/
RUN pnpm install --frozen-lockfile --filter frontend...
COPY frontend ./frontend
RUN pnpm --filter frontend build

FROM node:22-alpine AS runtime
WORKDIR /app
ARG BACKEND_URL=http://127.0.0.1:3002
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 BACKEND_URL=$BACKEND_URL
RUN corepack enable && addgroup -S app && adduser -S app -G app
COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/frontend/package.json /app/frontend/next.config.ts ./frontend/
COPY --from=build /app/frontend/node_modules ./frontend/node_modules
COPY --from=build /app/frontend/.next ./frontend/.next
COPY --from=build /app/frontend/public ./frontend/public
WORKDIR /app/frontend
USER app
EXPOSE 3102
CMD ["node_modules/.bin/next", "start", "-p", "3102"]
