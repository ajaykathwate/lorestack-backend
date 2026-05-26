# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS base
WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV DOCKER_BUILD=1
ENV HUSKY=0
RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
COPY scripts ./scripts
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

FROM deps AS builder
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN pnpm prisma:generate
RUN pnpm build
RUN pnpm prune --prod

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml* ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY prisma ./prisma
EXPOSE 3000
CMD ["node", "dist/main"]
