ARG NODE_VERSION=20

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

# Manifests (solo los que el pipeline copia a publish/)
COPY --chown=nodejs:nodejs package.json package-lock.json ./

# node_modules ya preinstalado por el pipeline (npm ci --only=production)
COPY --chown=nodejs:nodejs node_modules ./node_modules

# Artefactos ya compilados por el CI
COPY --chown=nodejs:nodejs dist/backend ./backend/dist
COPY --chown=nodejs:nodejs dist/frontend ./frontend/dist
COPY --chown=nodejs:nodejs dist/doc ./doc

# tsc emite el backend como CommonJS (NodeNext + backend/package.json sin "type").
# La raíz tiene "type": "module", así que sin este marker Node confunde el formato.
RUN echo '{"type":"commonjs"}' > /app/backend/dist/package.json

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
