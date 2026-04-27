ARG NODE_VERSION=20

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    SERVER_PORT=8080 \
    MCP_PORT=8081 \
    SERVER_DATA_PATH=/app/data

# Usuario no-root
RUN groupadd --system --gid 1001 nodejs \
 && useradd  --system --uid 1001 --gid nodejs nodejs

# workspaces
COPY --chown=nodejs:nodejs package.json package-lock.json ./
COPY --chown=nodejs:nodejs backend/package.json ./backend/
COPY --chown=nodejs:nodejs frontend/package.json ./frontend/

# Incluye devDependencies 
COPY --chown=nodejs:nodejs node_modules ./node_modules

# Artefactos ya compilados por el CI
COPY --chown=nodejs:nodejs backend/dist ./backend/dist
COPY --chown=nodejs:nodejs frontend/dist ./frontend/dist

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
