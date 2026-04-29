# Agent Manager — Instrucciones de sesión

## Gobernanza del proyecto

**INSTRUCCIÓN OBLIGATORIA:** Al inicio de cada sesión, usa la herramienta `get_governance`
con el tipo `typescript` para cargar las reglas de gobernanza activas del proyecto.
Aplica todas esas reglas durante toda la sesión antes de proponer o generar código.

- Si la llamada a la herramienta **se realiza correctamente**: aplica todas las reglas activas devueltas durante toda la sesión.
- Si la llamada a la herramienta **falla** o no está disponible: notifica al usuario inmediatamente con el mensaje _"No es posible continuar: no se pudo obtener la gobernanza del proyecto. Verifica que el servidor MCP esté disponible."_ y no procede con ninguna tarea.

## Comandos principales

```bash
npm run start        # Backend + frontend en modo watch
npm run server       # Solo backend
npm run ui           # Solo frontend Vite
npm run db:seed      # Inicializar base de datos
npx biome check --write .  # Lint y formato
```

## Convenciones de código

- Lenguaje: TypeScript (backend) / Vue 3 Composition API (frontend)
- Formato: tabs, comillas simples, 140 caracteres, sin comas finales (Biome)
- Sin comentarios salvo que el motivo no sea obvio
- Respuestas de handlers: `{ success: true, data }` o `{ success: false, error }`
