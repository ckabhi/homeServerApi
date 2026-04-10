# --- Build Stage ---
FROM node:25.9.0-alpine3.22 AS builder

# Install openssl for Prisma
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
COPY package*.json ./
# Use 'npm ci' for deterministic, faster, and more secure installs
RUN npm ci
COPY prisma ./prisma/
COPY prisma.config.ts ./ 

ENV DATABASE_URL="mysql://dummy:dummy@localhost:3306/db"
ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-arm64-openssl-3.0.x

RUN npx prisma generate --verbose

COPY . .
RUN npm run build

# --- Production Stage ---
FROM node:25.9.0-alpine3.22

# Install openssl for Prisma
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# 1. Update OS packages
RUN apk update && apk upgrade --no-cache

# 2. Copy only production artifacts
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./ 

# 3. Remove dev dependencies
RUN npm prune --omit=dev

RUN chown -R node:node /app
# 4. Run as non-root user
USER node

EXPOSE 3000
CMD npx prisma migrate deploy && node dist/src/main
