# Guía de integración — Asistente de chat embebible

Esta guía explica cómo incrustar el asistente de chat de Agent Manager en cualquier sitio web externo. El asistente aparece como un **botón flotante** en la esquina inferior derecha; al presionarlo se abre una ventana de chat que funciona igual que el asistente público de conocimiento (respuestas en tiempo real, preguntas frecuentes y sugerencias mientras escribes).

---

## 1. Requisitos

- La URL donde está desplegado Agent Manager (la llamaremos `https://agent-manager`).
- Acceso de administración a Agent Manager para **activar** el sitio (paso 3).
- Que tu sitio se sirva desde un origen real (`http://` o `https://`), **no** desde `file://`.

---

## 2. Instalación: una línea de código

Pega este `<script>` en tu página, justo antes de cerrar `</body>`:

```html
<script src="https://agent-manager/integration-embed.js" async></script>
```

Ejemplos según el entorno:

```html
<!-- Producción -->
<script src="https://agent.distelsa.com/integration-embed.js" async></script>

<!-- Desarrollo local -->
<script src="http://localhost:3200/integration-embed.js" async></script>
```

> El snippet exacto, ya con tu URL, puedes copiarlo desde **Configuración → Integraciones** en Agent Manager (botón de copiar en cada tarjeta).

### Ejemplo de página completa

```html
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>Mi sitio</title>
  </head>
  <body>
    <h1>Bienvenido a mi sitio</h1>
    <!-- ... tu contenido ... -->

    <!-- Asistente de chat: botón flotante abajo a la derecha -->
    <script src="https://agent-manager/integration-embed.js" async></script>
  </body>
</html>
```

No necesitas configurar nada más en el HTML: el script detecta automáticamente el origen de tu sitio (`window.location.origin`) y se lo comunica al asistente.

---

## 3. Activación (obligatorio la primera vez)

El sistema usa **auto-registro por origen**. La primera vez que tu sitio carga el widget:

1. **Cargas tu página** → tu sitio se registra automáticamente en Agent Manager con estado **"Pendiente"**. El chat mostrará un aviso de _"pendiente de configuración"_ y todavía no responde.
2. En Agent Manager, ve a **Configuración → Integraciones**, localiza el origen de tu sitio (p. ej. `https://miweb.com`) y:
   - **Asigna un agente** que atenderá las conversaciones.
   - Define el **scope** (qué datos acompañan la conversación: nombre, correo, teléfono, estar logueado).
   - Marca la integración como **Activa**.
3. **Recarga** tu página → el asistente ya responde.

---

## 4. Conceptos clave

### Origen

Cada sitio se identifica por su **origen** = esquema + dominio + puerto. Son orígenes **distintos** (y se registran por separado):

- `https://miweb.com`
- `http://www.miweb.com`
- `http://localhost:5500`

### Scope

El `scope` es **declarativo**: indica qué datos deben acompañar a la conversación y se entrega como contexto al agente. Se configura por integración (puede variar por sitio). Hoy no recolecta datos del usuario por sí mismo; declara qué espera el agente.

### Estado Pendiente / Configurada

- **Pendiente**: el origen está registrado pero sin agente asignado o desactivado → el chat no responde.
- **Configurada**: tiene agente asignado y está activa → el chat funciona.

---

## 5. Cómo funciona por dentro

1. `integration-embed.js` se ejecuta en tu sitio e inyecta un `<iframe>` flotante que carga `https://agent-manager/integration`.
2. El loader envía al iframe, por `postMessage`, el **origen de tu sitio**.
3. El widget abre una conversación contra el backend; este resuelve la integración **por ese origen** para saber qué agente y scope usar.
4. El widget notifica al loader cuando se abre/cierra para **redimensionar** el iframe (botón pequeño cuando está cerrado, ventana de chat cuando está abierto).

---

## 6. Pruebas en local

Sirve tu HTML desde un servidor (no con `file://`, cuyo origen es `null` y no funciona):

```bash
# Cualquiera de estas opciones
npx serve .
# o la extensión "Live Server" de VS Code
```

Apunta el snippet a tu Agent Manager local:

```html
<script src="http://localhost:3200/integration-embed.js" async></script>
```

Recuerda activar el origen resultante (p. ej. `http://localhost:3000`) en **Configuración → Integraciones**.

---

## 7. Solución de problemas

| Síntoma                                   | Causa probable                                 | Solución                                                                                 |
| ----------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------- |
| El chat dice "pendiente de configuración" | El origen aún no tiene agente o no está activo | Asígnale agente y actívalo en Configuración → Integraciones                              |
| No aparece el botón flotante              | El `<script>` no carga o la URL es incorrecta  | Verifica `https://agent-manager/integration-embed.js` en la consola del navegador        |
| No funciona abriendo el HTML directo      | Estás usando `file://` (origen `null`)         | Sírvelo desde un servidor `http(s)`                                                      |
| El sitio no se registra                   | El origen real no coincide con el esperado     | Revisa el origen en Configuración → Integraciones; cada `www`/puerto/esquema es distinto |
| Errores de CORS                           | —                                              | El backend permite peticiones cross-origin; si persiste, valida la URL del script        |

---

## 8. Personalización opcional

- **Forzar un origen específico**: si necesitas registrar un origen distinto al detectado automáticamente, agrega `data-origin`:

  ```html
  <script
    src="https://agent-manager/integration-embed.js"
    data-origin="https://miweb.com"
    async
  ></script>
  ```

  Útil cuando el sitio se sirve desde varios subdominios y quieres consolidarlos en una sola integración.

---

## 9. Tema (claro / oscuro)

El widget soporta los temas `am-light` y `am-dark` (y cualquier tema daisyUI personalizado). Puedes definirlo de dos formas:

### a) Estático, al cargar el script

Por query string en la URL del script, o con el atributo `data-theme` (equivalente):

```html
<script src="https://agent-manager/integration-embed.js?theme=am-dark" async></script>

<script src="https://agent-manager/integration-embed.js" data-theme="am-dark" async></script>
```

Si no defines tema, se usa la **preferencia del sistema** del visitante (claro u oscuro).

### b) Dinámico, en tiempo de ejecución

El loader expone una API global; cámbialo cuando quieras:

```js
window.IntegrationWidget.setTheme('am-dark')
window.IntegrationWidget.setTheme('am-light')
```

Ejemplo: sincronizar el asistente con el botón de tema de tu propio sitio:

```js
miBotonDeTema.addEventListener('click', () => {
  const oscuro = document.documentElement.classList.toggle('dark')
  window.IntegrationWidget.setTheme(oscuro ? 'am-dark' : 'am-light')
})
```

---

## 10. Referencia rápida

| Recurso                            | Valor                                             |
| ---------------------------------- | ------------------------------------------------- |
| Script de embebido                 | `https://agent-manager/integration-embed.js`      |
| Página del widget (iframe)         | `https://agent-manager/integration`               |
| Administración                     | Agent Manager → **Configuración → Integraciones** |
| Permiso requerido para administrar | `integrations` (create / read / update / delete)  |
