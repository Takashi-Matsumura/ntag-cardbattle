FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/

RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY apps/server ./apps/server

RUN pnpm --filter @nfc-card-battle/server db:push
RUN pnpm --filter @nfc-card-battle/server build

EXPOSE 3000

CMD ["pnpm", "--filter", "@nfc-card-battle/server", "start"]
