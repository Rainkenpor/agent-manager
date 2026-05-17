ARG NODE_VERSION=20

# ─── Stage 1: build backend + frontend (el CI no garantiza los artefactos,
#     así que los generamos dentro de la imagen) ────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS builder
WORKDIR /build

# Manifiestos y lockfile para instalar workspaces
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Instala TODAS las deps (incluye dev) para poder ejecutar tsc, vue-tsc y vite
RUN npm ci

# Fuentes
COPY backend ./backend
COPY frontend ./frontend

# Compila ambos workspaces (genera backend/dist y frontend/dist)
RUN npm run build

# ─── Stage 2: runtime ─────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    SERVER_PORT=8080 \
    MCP_PORT=8081 \
    SERVER_DATA_PATH=/app/data \
    UI_BASE_PATH=/agent-manager

# Usuario no-root
RUN groupadd --system --gid 1001 nodejs \
 && useradd  --system --uid 1001 --gid nodejs nodejs

# workspaces
COPY --chown=nodejs:nodejs package.json package-lock.json ./
COPY --chown=nodejs:nodejs backend/package.json ./backend/
COPY --chown=nodejs:nodejs frontend/package.json ./frontend/

# Deps de runtime — reinstaladas en limpio para no depender de node_modules del CI
RUN npm ci --omit=dev --ignore-scripts \
 && npm cache clean --force \
 && chown -R nodejs:nodejs node_modules

# Artefactos compilados en la stage `builder`
COPY --from=builder --chown=nodejs:nodejs /build/backend/dist ./backend/dist
COPY --from=builder --chown=nodejs:nodejs /build/frontend/dist ./frontend/dist

# Cambiar permisos
RUN chown -R nodejs:nodejs /app

# Directorio persistente
RUN mkdir -p /app/data && chown -R nodejs:nodejs /app/data
VOLUME ["/app/data"]

USER nodejs

EXPOSE 8080 8081

CMD ["node", "./backend/dist/src/index.js", "--ui", "--api"]
