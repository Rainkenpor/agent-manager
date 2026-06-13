# README-RAM — Investigación de fuga de memoria

> **Propósito de este archivo**: instrucciones para el agente que continúe esta investigación
> una vez recolectados los datos de monitoreo. Lee todo antes de tocar código.

**Fecha de la investigación inicial**: 2026-06-12
**Rama**: `QA`
**Síntoma reportado**: la RAM del proceso backend crece de forma sostenida con el tiempo.

---

## 1. Hipótesis principal (ya investigada)

**Las sesiones MCP del servidor propio (puerto 3201) nunca expiran y se acumulan en memoria.**

Evidencia en `backend/src/application/routes/mcp.route.ts`:

- Líneas ~21-24: `transports`, `sessionContexts` y `userSessionMap` son los **únicos
  almacenes mutables a nivel de módulo de todo el backend** (verificado por grep).
- La única limpieza es `transport.onclose`, que solo se dispara si el cliente envía
  `DELETE /mcp` o cierra el transporte de forma ordenada. Un cliente que se desconecta
  abruptamente (reinicio de Claude Code, Inspector, pérdida de red) hace un nuevo
  `initialize` → sesión nueva, **la anterior queda viva para siempre**. No hay TTL.
- Cada sesión retiene: un `McpServer` completo con todas las tools del usuario
  (esquemas Zod reconstruidos por sesión en `applyRoleBasedTools` /
  `jsonSchemaToZodShape` — el catálogo ronda las 150 tools), el
  `StreamableHTTPServerTransport`, y el último `HttpContext` (`{ req, res, next }`
  de Express completos, con body parseado y referencias al socket) que se sobreescribe
  en cada POST (`sessionContexts[sessionId] = ...`).
- `userSessionMap` es código muerto: nunca se escribe, solo se borra en `onclose`.

### Sospechosos descartados (no volver a investigar salvo que los datos lo contradigan)

| Componente | Por qué se descartó |
|---|---|
| SSE de logs (`stream-agent-logs.use-case.ts` + `logs.route.ts`) | limpia interval y `fs.watch` en `req.on('close')` |
| `ServiceScheduler` (`scheduler.service.ts`) | gestiona y limpia sus timers correctamente |
| Clientes stdio temporales (`mcp-external.ts`) | `cleanup()` en `finally`; el map `pending` se vacía en exit |
| Streaming de chat (`stream-message.use-case.ts`) | todo es estado local por request |
| Monitoreo de recursos (`get-system-metrics.use-case.ts`) | no retiene nada entre llamadas |
| `InternalAgentService` (`internal.ts`) | maps y arrays son locales por request |

---

## 2. Instrumentación ya instalada (2026-06-12)

Para confirmar la hipótesis se agregó el conteo de sesiones a las métricas:

- `getMcpSessionStats()` exportada desde `mcp.route.ts` → `{ sessions, contexts }`.
- `/api/system/metrics` ahora incluye `mcp: { sessions, contexts }`
  (`get-system-metrics.use-case.ts`).
- La vista **Recursos del servidor** (`SystemMetricsView.vue`) muestra la tarjeta
  "Sesiones MCP" en la sección "Proceso del backend", junto a RSS / heap.

---

## 3. Cómo interpretar los datos recolectados

Observa en paralelo **Sesiones MCP**, **contextos retenidos**, **Memoria RSS** y
**Heap usado** a lo largo de horas/días de uso normal:

| Observación | Conclusión | Acción |
|---|---|---|
| `sessions` sube con las reconexiones de clientes y **nunca baja**, RSS/heap crecen en paralelo | **Hipótesis confirmada** | Aplicar el fix de la sección 4 |
| `sessions` se mantiene estable (sube y baja) pero RSS sigue creciendo | Hipótesis descartada o parcial | Ir a la sección 5 (plan B) |
| `contexts` > `sessions` de forma sostenida | Fuga adicional: contextos huérfanos sin transporte | Incluir limpieza de `sessionContexts` en el fix |

---

## 4. Fix a aplicar si se confirma la hipótesis

Todo en `backend/src/application/routes/mcp.route.ts`:

1. **Desalojo por inactividad**: registrar `lastActivity` por sesión en cada request
   (POST/GET/DELETE) y un `setInterval` que recorra las sesiones y llame a
   `transport.close()` en las inactivas más de N minutos (sugerido: 30). Cerrar el
   transporte dispara el `transport.onclose` ya existente, que limpia `transports`,
   `sessionContexts` y `userSessionMap` — reutilizar esa limpieza, no duplicarla.
2. **No retener `req`/`res` completos**: `sessionContexts` guarda el `HttpContext`
   entero solo para que las tools locales lean `req.user` (ver `registerLocalTool`,
   que lee `globalThis.__mcpSessionContexts[sessionId]`). Reducir lo almacenado a lo
   que las tools realmente usan (el usuario/userId), o al menos limpiar la entrada al
   terminar cada request.
3. **Eliminar `userSessionMap`** (código muerto).

Reglas de gobernanza a respetar al implementar (resumen; la fuente es la tool MCP
`get_governance` tipo `agentManager`, llamarla al inicio de la sesión):

- Rama propia con PR hacia `QA`; no mergear sin `npx biome check .` limpio y tests verdes.
- Al cerrar el fix: bump **patch** en `package.json` (es corrección de bug) y crear
  `doc/<version>.md` orientado al usuario final, en español.
- No introducir abstracciones no pedidas; el fix debe ser local a `mcp.route.ts`.
- Verificación: `npx tsc --noEmit -p backend/tsconfig.json` y
  `npx vue-tsc --noEmit -p frontend/tsconfig.json` (así se validó la instrumentación).

### Cómo probar el fix

1. Levantar con `npm run start`, conectar un cliente MCP (Inspector o Claude Code) al
   puerto 3201 y matarlo sin cerrar sesión; repetir varias veces.
2. Confirmar en "Recursos del servidor" que `sessions` sube con cada reconexión y
   **baja a su valor base** pasado el TTL de inactividad.
3. Confirmar que una sesión activa (haciendo tool calls) **no** es desalojada.

---

## 5. Plan B si los datos descartan la hipótesis

Si `sessions` se mantiene estable pero la RAM sigue creciendo:

1. Tomar dos heap snapshots separados por horas (`node --inspect` sobre el proceso del
   backend) y comparar los retenedores dominantes en Chrome DevTools.
2. Revisar lo que la instrumentación actual no mide:
   - procesos stdio hijos de MCPs externos (medir RSS del árbol de procesos, no solo
     del proceso Node: `Get-Process node | Select-Object Id, WS`),
   - crecimiento del lado de TypeORM/SQLite (caché de queries),
   - buffers de sockets de conexiones SSE de chat/logs que nunca se cierran del lado
     del cliente.
3. Si el dominante en el snapshot es otro, documentar el hallazgo en este archivo
   antes de aplicar cambios.

---

## 6. Estado al cierre de la sesión del 2026-06-12

- Instrumentación implementada y verificada (tsc backend y vue-tsc frontend sin errores),
  **sin commitear** — los cambios están en el working tree de la rama `QA`.
- Nota: `get-system-metrics.use-case.ts` importa `getMcpSessionStats` con import
  estático desde `mcp.route.ts`; existe un ciclo de imports latente
  (container → use-cases → mcp.route → container) que hoy no rompe en runtime porque
  `mcp.route` solo usa `container` dentro de funciones. Si aparece un error de
  inicialización ESM al arrancar, cambiar a import dinámico dentro de `execute()`.
- Warnings preexistentes (no introducidos por esta investigación): non-null assertions
  en `mcp.route.ts` y formato CRLF en `frontend/src/api/api.ts`.
