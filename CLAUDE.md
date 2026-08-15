# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## MANDATORY: Session Initialization

**At the start of every session**, before responding to any request, you MUST call the `get_governance` tool with type `"agentManager"` to load the project governance rules:

```
get_governance({ type: "agentManager" })
```

- If the tool call **succeeds**: apply all active rules returned for the rest of the session.
- If the tool call **fails** or is unavailable: notify the user immediately with the message _"No es posible continuar: no se pudo obtener la gobernanza del proyecto. Verifica que el servidor MCP esté disponible."_ and do not proceed with any task.

## Video de novedades por versión

Además del bump de versión y del `doc/<version>.md` que exige la gobernanza: **si la versión cambia algo que el usuario ve, hay que grabar un GIF del cambio** y dejarlo en `frontend/public/whats-new/<version>.gif`.

**Cuándo sí**: flujos nuevos o modificados en la UI, pantallas nuevas, cambios de interacción o de diseño visible.
**Cuándo no**: correcciones de backend, refactors, ajustes de rendimiento o de datos que no alteran lo que el usuario ve en pantalla. En ese caso basta con el `doc/<version>.md`.

### Cómo grabarlo

1. Levantar la app en local (`npm run start`) y confirmar que responde.
2. Instalar las herramientas de grabación **sin guardarlas** como dependencia:
   ```bash
   npm i --no-save playwright gifenc pngjs && npx playwright install chromium
   ```
3. Grabar el flujo. `record.cjs` autentica inyectando un JWT en `localStorage`, dibuja un cursor virtual y ejecuta la interacción real contra la app:
   ```bash
   DEMO_USER_ID=<uuid-de-un-usuario> DEMO_MESSAGE="..." node scripts/whats-new/record.cjs
   ```
   Si el flujo del release no es el del chat, ajustar el guion de `record.cjs` para esa pantalla.
4. Codificar a GIF (sin ffmpeg; escribe directo en `frontend/public/whats-new/`):
   ```bash
   VERSION=<version> node scripts/whats-new/encode.cjs
   ```
   Variables útiles: `TARGET_W` (ancho, default 860), `MAX_FRAMES` (default 130), `MAX_DELAY` (ms por frame, default 240). Objetivo: **20–30 s y menos de 5 MB**.
5. Apuntar el anuncio a la versión nueva: cambiar `WHATS_NEW_VERSION` en `frontend/src/components/AppLayout.vue`. Eso hace que el modal vuelva a mostrarse una vez a cada usuario.

### Reglas del guion

- Grabar **acciones reales contra la app**, nunca una simulación o un mockup.
- Elegir un caso de sólo lectura: evitar agentes con herramientas de escritura (Jira, Confluence) para no crear registros reales durante la grabación.
- Si el resultado grabado deja mala impresión (un "no encontré nada", un error), volver a grabar con otro caso en lugar de publicarlo.
