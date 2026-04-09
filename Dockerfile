# --- Build Stage ---
FROM node:25.9.0-alpine3.22 AS builder
WORKDIR /app
COPY package*.json ./
# Use 'npm ci' for deterministic, faster, and more secure installs
RUN npm ci 
COPY . .
RUN npx prisma generate
RUN npm run build

# --- Production Stage ---
FROM node:25.9.0-alpine3.22
WORKDIR /app

# 1. Update OS packages
RUN apk update && apk upgrade --no-cache

# 2. Copy only production artifacts
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma

# 3. Remove dev dependencies
RUN npm prune --production

# 4. Run as non-root user
USER node

EXPOSE 3000
CMD ["npm", "run", "start:prod"]
