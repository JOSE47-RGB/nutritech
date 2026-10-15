FROM docker.io/library/node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npx prisma generate && npm run build && npm prune --omit=dev
FROM docker.io/library/node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates mariadb-client && rm -rf /var/lib/apt/lists/*
WORKDIR /app/backend
COPY --from=build --chown=node:node /app/backend/dist ./dist
COPY --from=build --chown=node:node /app/backend/node_modules ./node_modules
COPY --chown=node:node backend/package*.json ./
COPY --chown=node:node backend/scripts ./scripts
COPY --chown=node:node database ./../database
RUN mkdir -p /app/database/backups && chown node:node /app/database/backups
ENV NODE_ENV=production PORT=3017
USER node
EXPOSE 3017
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:3017/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
