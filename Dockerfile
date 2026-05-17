ARG NODE_VERSION=20

# ─── Stage 1: build frontend (el CI solo compila backend; el frontend se
#     compila aquí para no depender de artefactos externos) ────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS frontend-builder
WORKDIR /build

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Instala TODAS las deps (incluye dev) para poder ejecutar vue-tsc y vite build
RUN npm ci

# Copia fuentes del frontend + archivos compartidos que vite necesita
COPY frontend ./frontend

RUN npm run ui:build

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

# Incluye devDependencies (el CI deja node_modules en la raíz tras `npm ci`)
COPY --chown=nodejs:nodejs node_modules ./node_modules

# Artefacto del backend compilado por el CI
COPY --chown=nodejs:nodejs backend/dist ./backend/dist

# Artefacto del frontend compilado en la stage anterior
COPY --from=frontend-builder --chown=nodejs:nodejs /build/frontend/dist ./frontend/dist

# Poda devDependencies. --ignore-scripts
#RUN npm prune --omit=dev --ignore-scripts \
# && npm cache clean --force

# Cambiar permisos
RUN chown -R nodejs:nodejs /app

# Directorio persistente
RUN mkdir -p /app/data && chown -R nodejs:nodejs /app/data
VOLUME ["/app/data"]

USER nodejs

EXPOSE 8080 8081

CMD ["node", "./backend/dist/src/index.js", "--ui", "--api"]
