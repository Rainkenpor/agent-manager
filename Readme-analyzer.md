# Clarify — Análisis de Arquitectura para Replicación

> Documento generado para replicar la estructura del proyecto en otro contexto.
> Fecha: 2026-03-18

---

## Índice

1. [Visión General](#1-visión-general)
2. [Estructura de Directorios](#2-estructura-de-directorios)
3. [Backend — Server](#3-backend--server)
   - 3.1 [Punto de entrada](#31-punto-de-entrada)
   - 3.2 [Arquitectura limpia (Clean Architecture)](#32-arquitectura-limpia-clean-architecture)
   - 3.3 [Base de datos](#33-base-de-datos)
   - 3.4 [Autenticación y autorización](#34-autenticación-y-autorización)
   - 3.5 [Registro dual REST + MCP](#35-registro-dual-rest--mcp)
   - 3.6 [Servicios de infraestructura](#36-servicios-de-infraestructura)
   - 3.7 [Servicios programados (Scheduler)](#37-servicios-programados-scheduler)
   - 3.8 [Dependencias del servidor](#38-dependencias-del-servidor)
4. [Frontend — UI](#4-frontend--ui)
   - 4.1 [Stack y herramientas](#41-stack-y-herramientas)
   - 4.2 [Estructura de directorios UI](#42-estructura-de-directorios-ui)
   - 4.3 [State Management (Pinia)](#43-state-management-pinia)
   - 4.4 [Routing y guards](#44-routing-y-guards)
   - 4.5 [Capa de API y Socket](#45-capa-de-api-y-socket)
   - 4.6 [Dependencias del frontend](#46-dependencias-del-frontend)
5. [Endpoints de la API](#5-endpoints-de-la-api)
6. [Esquema de Base de Datos](#6-esquema-de-base-de-datos)
7. [Configuración del entorno (.env)](#7-configuración-del-entorno-env)
8. [Scripts disponibles](#8-scripts-disponibles)
9. [Guía para replicar el proyecto](#9-guía-para-replicar-el-proyecto)

---

## 1. Visión General

**Clarify** es un sistema de gestión de documentación asistido por IA. Expone su funcionalidad de dos formas simultáneas:

- **REST API** (puerto `3001`): Consumida por la UI Vue 3 y clientes externos.
- **MCP Server** (puerto `3002`): Expone las mismas operaciones como herramientas del protocolo Model Context Protocol, permitiendo que agentes de IA (como Claude Desktop) interactúen directamente.

| Capa | Tecnología |
|---|---|
| Backend | Node.js + Express 5 + TypeScript |
| ORM | Drizzle ORM |
| Base de datos | SQLite (better-sqlite3) |
| Frontend | Vue 3 + Composition API |
| Estado | Pinia |
| Estilos | Tailwind CSS v4 |
| Build | Vite |
| Tiempo real | Socket.IO |
| Auth | Passport.js + JWT + RBAC |
| MCP | `@modelcontextprotocol/sdk` |

---

## 2. Estructura de Directorios

```
Clarify/                          # Raíz del monorepo
├── package.json                  # Workspace root (Yarn/npm workspaces)
├── .env / .env.example           # Variables de entorno
├── mcp.json                      # Configuración del servidor MCP
├── AUTH_SYSTEM.md                # Documentación del sistema de auth
├── MCP_OAUTH_SYSTEM.md           # Documentación OAuth 2.0
├── Server/                       # Workspace del backend
│   ├── src/
│   │   ├── index.ts              # Entry point: inicia ambos servidores
│   │   ├── application/          # Capa de aplicación (casos de uso + rutas)
│   │   ├── domain/               # Capa de dominio (entidades + interfaces)
│   │   ├── infra/                # Capa de infraestructura (DB, servicios externos)
│   │   ├── agent/                # Prompts de agentes en Markdown
│   │   └── shared/               # Utilidades compartidas, envs.ts
│   ├── drizzle/                  # Migraciones generadas por Drizzle Kit
│   ├── logs/                     # Archivos de log (Winston)
│   ├── drizzle.config.ts
│   ├── tsconfig.json
│   └── package.json
└── UI/                           # Workspace del frontend
    ├── src/
    │   ├── main.ts               # Entry point de Vue
    │   ├── App.vue
    │   ├── api/                  # Cliente HTTP + Socket.IO
    │   ├── views/                # Páginas (rutas)
    │   ├── components/           # Componentes reutilizables
    │   ├── store/                # Stores de Pinia
    │   ├── router/               # Vue Router con guards
    │   ├── composables/          # Lógica reutilizable (useDialog, useScreenLoader)
    │   ├── types/                # Interfaces TypeScript
    │   └── utils/                # Helpers (time.ts, encript.ts)
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── tsconfig.json
    └── package.json
```

---

## 3. Backend — Server

### 3.1 Punto de entrada

`Server/src/index.ts` realiza lo siguiente al arrancar:

1. Lee variables de entorno (`dotenv`)
2. Crea la instancia de la base de datos Drizzle y ejecuta migraciones
3. Ejecuta el seed de autenticación (roles y permisos base)
4. Inicializa Passport.js (estrategias local + JWT)
5. Levanta **servidor API** en el puerto `3001`:
   - Middleware: CORS, JSON body parser, logging, Passport
   - Monta rutas REST desde `server.router.ts`
   - Sirve la build de la UI en producción
   - Inicia Socket.IO
6. Levanta **servidor MCP** en el puerto `3002`:
   - Expone los mismos handlers como herramientas MCP
7. Inicia `SchedulerService` (tareas periódicas)
8. Configura shutdown graceful (`SIGTERM`, `SIGINT`)

### 3.2 Arquitectura limpia (Clean Architecture)

El código se divide en tres capas con dependencias unidireccionales:

```
Domain → Application → Infrastructure
```

#### Capa de Dominio (`src/domain/`)

Contiene las reglas de negocio puras. No depende de ningún framework.

```
domain/
├── entities/           # Interfaces/tipos de entidades de negocio
│   ├── project.entity.ts
│   ├── section.entity.ts
│   ├── user.entity.ts
│   ├── role.entity.ts
│   ├── permission.entity.ts
│   ├── chat.entity.ts
│   ├── pending-task.entity.ts
│   ├── comment.entity.ts
│   ├── deep-search.entity.ts
│   ├── db-analyzer.entity.ts
│   ├── oracle-object.entity.ts
│   └── McpToken.ts
├── repositories/       # Interfaces (contratos) que la infra debe implementar
│   ├── project.repository.interface.ts
│   ├── section.repository.interface.ts
│   ├── user.repository.ts
│   ├── role.repository.ts
│   ├── permission.repository.ts
│   ├── chat.repository.interface.ts
│   └── IMcpTokenRepository.ts
└── services/           # Servicios de dominio (sin efectos externos)
    ├── embedding-service.ts       # Embeddings locales con @xenova/transformers
    ├── chunking-service.ts        # División de texto para embeddings
    ├── mermaid-validator.ts       # Validación de diagramas Mermaid
    ├── keyword-extraction.service.ts
    ├── wikilink-service.ts
    └── ai-service.interface.ts
```

#### Capa de Aplicación (`src/application/`)

Orquesta los casos de uso. Conoce el dominio y la infra (a través de interfaces).

```
application/
├── container.ts                  # Inyección de dependencias manual
├── interfaces/
│   ├── route.interface.ts        # Contrato RouteToolRegistry
│   └── auth.middleware.ts
├── services/                     # Servicios de aplicación
│   ├── registry.service.ts       # ★ Registro dual REST + MCP
│   ├── chat.service.ts
│   ├── embedding-processor.service.ts
│   ├── pending-task-processing.service.ts
│   ├── scheduler.service.ts
│   └── agent-sync.service.ts
├── routes/                       # Definición de rutas Express
│   ├── index.ts                  # Inicialización del registro
│   ├── server.router.ts          # Router principal de Express
│   ├── project.route.ts
│   ├── section.route.ts
│   ├── auth.route.ts
│   ├── user.route.ts
│   ├── role.route.ts
│   ├── permission.route.ts
│   ├── agent.route.ts
│   ├── chat.route.ts
│   ├── search.route.ts
│   ├── deep-search.route.ts
│   ├── oracle.route.ts
│   ├── pending.route.ts
│   ├── mcp.route.ts
│   ├── mcp-oauth.route.ts
│   └── middlewares/              # Middlewares de autenticación aplicados por ruta
├── use-cases/                    # Lógica de negocio por dominio
│   ├── project/
│   │   ├── create-project.use-case.ts
│   │   ├── list-projects.use-case.ts
│   │   ├── get-project.use-case.ts
│   │   ├── get-project-by-slug.use-case.ts
│   │   ├── update-project.use-case.ts
│   │   ├── delete-project.use-case.ts
│   │   ├── generate-project-pdf.use-case.ts
│   │   ├── get-network-map.use-case.ts
│   │   ├── document-project-from-git.use-case.ts
│   │   └── scan-project.use-case.ts
│   ├── section/
│   │   ├── create-section.use-case.ts
│   │   ├── get-sections-by-project.use-case.ts
│   │   ├── update-section.use-case.ts
│   │   ├── delete-section.use-case.ts
│   │   ├── find-sections-by-files.use-case.ts
│   │   └── search-sections.use-case.ts
│   ├── chat/
│   │   ├── chat.use-case.ts
│   │   └── stream.use-case.ts
│   ├── auth/
│   │   ├── login.use-case.ts
│   │   └── check-permission.use-case.ts
│   ├── user/
│   ├── role/
│   ├── pending-task/
│   ├── deep-search/
│   ├── oracle/
│   ├── comment/
│   ├── mcp-token/
│   ├── agent/
│   ├── project-map/
│   └── search/
└── utils/
    ├── logging.middleware.ts
    └── text-cleaner.ts
```

#### Capa de Infraestructura (`src/infra/`)

Implementaciones concretas. Depende de la capa de dominio para los contratos.

```
infra/
├── db/
│   ├── database.ts               # Instancia Drizzle (better-sqlite3, WAL mode)
│   ├── schema.ts                 # Definición de tablas con Drizzle ORM
│   ├── run-migrations.ts
│   └── seed-auth.ts              # Seed inicial de roles y permisos
├── repository/                   # Implementaciones de los repositorios
│   ├── project.repository.ts
│   ├── section.repository.ts
│   ├── user.repository.ts
│   ├── chat.repository.ts
│   ├── comment.repository.ts
│   ├── embedding.repository.ts
│   ├── agent.repository.ts
│   └── index.ts                  # Exporta todas las implementaciones
├── service/
│   ├── logger.service.ts         # Winston logger
│   ├── passport.service.ts       # Configuración de Passport (local + JWT)
│   ├── oracle.service.ts         # Conexión opcional a Oracle DB
│   ├── git.service.ts            # Operaciones de repositorios git
│   ├── file-copy.service.ts
│   ├── repo-sync.service.ts      # Sincronización periódica de repos
│   ├── socket.service.ts         # Socket.IO server
│   ├── mcp-oauth.service.ts      # OAuth 2.0 completo
│   └── agents/utils/
│       └── mcp-external.js       # Manager de conexiones MCP externas
└── auth/
    └── auth.ts
```

### 3.3 Base de Datos

**Motor:** SQLite mediante `better-sqlite3` con WAL mode y foreign keys activadas.
**ORM:** Drizzle ORM (schema-first, type-safe).
**Ubicación:** `./data/clarify.db` (configurable con `SERVER_DB_PATH`).

#### Tablas principales

| Tabla | Descripción |
|---|---|
| `projects` | Proyectos de documentación. Campos: id, slug (único), title, description, repository, branch, icon, keywords (JSON), lastCommit, active, timestamps |
| `sections` | Secciones jerárquicas del contenido. Campos: id, projectId (FK), section, content, order, subElemento (FK nullable para padre), keywords (JSON), files (JSON), tuit (resumen), analyzed, analyzedEmbedding, type (`normal`/`commit`/`required_by_user`) |
| `sections_history` | Historial de versiones de secciones |
| `pending_tasks` | Tareas pendientes. status: `pending`/`in_progress`/`completed`/`cancelled` |
| `deep_searches` | Búsquedas avanzadas. status: `pending`/`processing`/`completed`/`failed`. Guarda result (JSON), proyectos analizados, tiempo total |
| `users` | Usuarios del sistema. Campos: id, email (único), username (único), password (bcrypt), firstName, lastName, active |
| `roles` | Roles de usuario |
| `permissions` | Permisos granulares. Formato: `"resource:action"` (ej. `"projects:create"`) |
| `user_roles` | Relación N:M usuarios-roles |
| `role_permissions` | Relación N:M roles-permisos |
| `mcp_tokens` | Tokens de autenticación para clientes MCP. Campos: id, token, name, userId (NOT NULL FK), isActive, expiresAt, lastUsedAt |
| `comments` | Comentarios sobre secciones |
| `embeddings` | Vectores de texto para búsqueda semántica |
| `project_maps` | Mapas de red de relaciones entre proyectos |
| `agents` | Configuración de agentes IA |
| `db_analyzer` | Caché del esquema de Oracle DB |

#### Convenciones del schema

```typescript
// Ejemplo de definición en schema.ts
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  repository: text("repository"),
  branch: text("branch"),
  keywords: text("keywords", { mode: "json" }).$type<string[]>(),
  active: integer("active", { mode: "boolean" }).default(true),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});
```

#### Comandos de DB

```bash
npm run db:generate    # Genera migraciones desde el schema
npm run db:migrate     # Aplica migraciones pendientes
```

### 3.4 Autenticación y Autorización

#### Estrategia de autenticación

| Mecanismo | Uso |
|---|---|
| **Passport Local** | Login con usuario/contraseña |
| **JWT Bearer** | Todas las rutas protegidas. Expiración: 7 días |
| **RBAC** | Control de acceso basado en roles y permisos |
| **MCP Tokens** | Auth para clientes MCP (headers o query params) |
| **OAuth 2.0** | Authorization Code Flow para clientes MCP |

#### Middlewares de auth

```typescript
// Middleware de autenticación JWT
requireAuth                          // Verifica Bearer token

// Middleware de permiso granular
requirePermission("projects", "create")  // Verifica recurso:acción

// Middleware para tokens MCP
mcpTokenAuthMiddleware               // Valida tokens desde header o query
```

#### Roles por defecto (seed)

| Rol | Permisos |
|---|---|
| **Admin** | Todos los permisos |
| **Editor** | create/read/update en projects y sections |
| **Viewer** | read en projects y sections |

#### OAuth 2.0 (para clientes MCP)

Flujo Authorization Code (RFC 6749, RFC 8414):

```
GET  /.well-known/oauth-authorization-server   → Metadata del servidor OAuth
GET  /oauth/authorize                          → Página de autorización
POST /oauth/token                              → Intercambio código → token
POST /oauth/revoke                             → Revocación de token
```

### 3.5 Registro dual REST + MCP

El patrón central del proyecto: **una sola definición, dos exposiciones**.

El `RouteToolRegistry` (`application/services/registry.service.ts`) registra cada operación como:
1. Ruta Express (REST API)
2. Herramienta MCP

```typescript
// Ejemplo de registro (una sola vez para ambas exposiciones)
registry.register({
  path: "/api/projects",
  method: "GET",
  toolName: "list_projects",
  toolDescription: "Lista todos los proyectos de documentación",
  inputSchema: z.object({ /* Zod schema */ }),
  handler: async (input, req) => {
    // Handler compartido
    return await listProjectsUseCase.execute();
  },
  useBy: ["server", "mcp"],        // "server" | "mcp" | ["server", "mcp"]
  requiresAuth: true,
  requiredPermission: { resource: "projects", action: "read" }
});
```

El registry automáticamente:
- Crea `app.get("/api/projects", authMiddleware, handler)` en Express
- Registra `list_projects` como tool en el servidor MCP
- Aplica validación Zod en ambas
- Aplica autenticación y verificación de permisos en ambas

### 3.6 Servicios de Infraestructura

| Servicio | Archivo | Descripción |
|---|---|---|
| **Logger** | `logger.service.ts` | Winston con transports a archivo y consola |
| **Passport** | `passport.service.ts` | Configura estrategias Local y JWT |
| **Socket.IO** | `socket.service.ts` | Servidor WebSocket, auth JWT, rooms |
| **Git** | `git.service.ts` | Clona, sincroniza y lee repos git |
| **Oracle** | `oracle.service.ts` | Conexión opcional a Oracle DB. Descubrimiento de objetos y DDL |
| **Repo Sync** | `repo-sync.service.ts` | Sincronización periódica de repositorios |
| **MCP OAuth** | `mcp-oauth.service.ts` | OAuth 2.0 completo con JWT access/refresh tokens |
| **MCP External** | `mcp-external.js` | Manager de conexiones a servidores MCP externos |

#### Servicio de Embeddings (Dominio)

```typescript
// Usa @xenova/transformers — sin llamadas externas, todo local
embeddingService.embed("texto a vectorizar")  // → Float32Array
```

### 3.7 Servicios Programados (Scheduler)

El `SchedulerService` ejecuta tareas periódicas en background:

| Tarea | Intervalo | Delay inicial | Descripción |
|---|---|---|---|
| **Repo Sync** | 20 minutos | 15 segundos | Sincroniza repositorios git registrados |
| **Oracle Sync** | 2 horas | 10 segundos | Actualiza caché de objetos Oracle |
| **Embedding Processor** | 1 hora | 30 segundos | Genera embeddings para secciones nuevas/modificadas |

### 3.8 Dependencias del servidor

```json
// Dependencias principales (Server/package.json)
{
  // Core
  "express": "^5.2.1",
  "@modelcontextprotocol/sdk": "^1.27.1",

  // Base de datos
  "drizzle-orm": "^0.45.1",
  "better-sqlite3": "^12.6.2",
  "drizzle-kit": "^0.31.9",

  // Autenticación
  "passport": "^0.7.0",
  "passport-local": "^1.0.0",
  "passport-jwt": "^4.0.1",
  "jsonwebtoken": "^9.0.3",
  "bcryptjs": "^3.0.3",

  // IA y Embeddings
  "@opencode-ai/sdk": "^1.2.22",
  "@google/generative-ai": "^0.24.1",
  "@xenova/transformers": "^2.17.2",
  "openai": "^6.27.0",

  // Utilidades
  "socket.io": "^4.8.3",
  "cors": "^2.8.6",
  "dotenv": "^17.2.3",
  "uuid": "^13.0.0",
  "zod": "^4.3.6",
  "winston": "^3.19.0",
  "mermaid": "^11.12.3",
  "markdown-it": "^14.1.1",
  "dompurify": "^3.3.1",
  "node-cache": "^5.1.2",

  // Opcionales
  "oracledb": "^6.10.0",
  "puppeteer": "^24.38.0"
}
```

---

## 4. Frontend — UI

### 4.1 Stack y Herramientas

| Herramienta | Versión | Rol |
|---|---|---|
| Vue 3 | ^3.5.29 | Framework UI (Composition API) |
| Pinia | ^3.0.4 | State management |
| Vue Router | ^5.0.3 | SPA routing con guards |
| Tailwind CSS | ^4.2.1 | Utilidad de estilos (plugin Vite) |
| Vite | ^7.3.1 | Dev server y bundler |
| Socket.IO Client | ^4.8.3 | Comunicación en tiempo real |
| markdown-it | ^14.1.1 | Renderizado de Markdown |
| Mermaid | ^11.12.3 | Diagramas en Markdown |
| highlight.js | ^11.11.1 | Sintaxis highlighting |
| v-network-graph | ^0.9.22 | Grafos de red interactivos |
| html2pdf.js | ^0.14.0 | Exportación PDF |
| vue-sonner | ^2.0.9 | Notificaciones toast |
| @mdi/js + @mdi/font | ^7.4.47 | Iconografía Material Design |

### 4.2 Estructura de Directorios UI

```
UI/src/
├── main.ts                        # Registra Vue app, plugins (Pinia, Router)
├── App.vue                        # Componente raíz: layout global, socket init
├── assets/
│   └── base.css                   # Imports de Tailwind CSS v4
│
├── api/
│   ├── api.ts                     # Cliente HTTP (fetch) con JWT automático
│   └── socket.ts                  # Instancia Socket.IO compartida
│
├── views/                         # Páginas (1 por ruta)
│   ├── DashboardView.vue          # Dashboard principal con stats y widgets
│   ├── LoginView.vue              # Formulario de autenticación
│   ├── McpAuthView.vue            # Flujo OAuth 2.0 para clientes MCP
│   ├── ChatView.vue               # Interfaz de chat con IA (streaming)
│   ├── ProjectsListView.vue       # Lista de proyectos
│   ├── ProjectView.vue            # Detalle del proyecto + secciones
│   ├── ProjectMapView.vue         # Visualización de red de relaciones
│   ├── SemanticSearchView.vue     # Búsqueda semántica
│   ├── DeepSearchView.vue         # Búsqueda avanzada multi-step
│   ├── SettingsView.vue           # Layout de settings (con sub-rutas)
│   ├── SettingsProjectsView.vue
│   ├── SettingsUsersAdmin.vue
│   ├── SettingsRolesAdminView.vue
│   ├── SettingsMcpTokensView.vue
│   └── SettingsAgentsView.vue
│
├── components/
│   ├── SidebarNav.vue             # Barra de navegación lateral principal
│   ├── ChatSidebar.vue            # Sidebar del chat
│   ├── ProjectHeader.vue          # Header del proyecto activo
│   ├── SectionItem.vue            # Ítem recursivo de sección
│   ├── MarkdownRenderer.vue       # Renderiza MD + Mermaid + highlight.js
│   ├── AgentForm.vue              # Formulario de configuración de agentes
│   ├── CommentModal.vue           # Modal de comentarios en secciones
│   ├── LoginModal.vue             # Modal de login
│   ├── RoleManagementModal.vue    # Gestión de roles
│   ├── PendingTasksWidget.vue     # Widget de tareas pendientes
│   ├── RecentActivity.vue         # Widget de actividad reciente
│   ├── StatsCard.vue              # Tarjeta de estadísticas
│   ├── ChartWidget.vue            # Gráfico de datos
│   ├── Card.vue                   # Tarjeta genérica
│   ├── Empty.vue                  # Estado vacío
│   ├── User.vue                   # Avatar/info de usuario
│   ├── Project/
│   │   ├── ProjectCreate.vue      # Formulario de creación de proyecto
│   │   └── ProjectEdit.vue        # Formulario de edición de proyecto
│   └── Utils/
│       ├── Dialog.vue             # Diálogo de confirmación
│       ├── Modal.vue              # Modal base reutilizable
│       ├── Tabs.vue               # Componente de tabs
│       └── ScreenLoader.vue       # Overlay de carga
│
├── store/
│   ├── useAuth.ts                 # Auth store: user, token, permisos, socket
│   ├── useProject.ts              # Project store: proyectos, secciones, tareas
│   └── useView.ts                 # UI store: modales, loaders
│
├── router/
│   └── index.ts                   # Rutas + navigation guards
│
├── composables/
│   ├── useDialog.ts               # Composable para diálogos de confirmación
│   └── useScreenLoader.ts         # Composable para pantalla de carga
│
├── types/
│   └── types.ts                   # Interfaces TypeScript compartidas
│
├── utils/
│   ├── time.ts                    # Formateo de fechas/tiempos
│   └── encript.ts                 # Utilidades de encriptación
│
└── template/
    └── primaryView.vue            # Template de layout para vistas principales
```

### 4.3 State Management (Pinia)

#### `useAuth` store

```typescript
// Estado
user: User | null
token: string | null
isAuthenticated: boolean
socket: Socket | null
viewerMode: boolean         // Modo solo-lectura

// Acciones
login(credentials)          // POST /api/auth/login → guarda JWT
logout()                    // Limpia estado + socket
fetchCurrentUser()          // GET /api/auth/me
hasPermission(resource, action): boolean
hasRole(roleName): boolean
initSocket()                // Conecta Socket.IO con JWT auth
```

#### `useProject` store

```typescript
// Estado
projects: Project[]
activeProject: Project | null
sections: Section[]
sectionsTree: SectionWithChildren[]
pendingTasks: PendingTask[]
comments: CommentWithUser[]

// Acciones
fetchProjects()
fetchProject(id)
fetchSections(projectId)
createSection(data)
updateSection(id, data)
deleteSection(id)
fetchPendingTasks(projectId)
```

#### `useView` store

```typescript
// Estado
showCreateProjectModal: boolean
showEditProjectModal: boolean
screenLoaderVisible: boolean
screenLoaderMessage: string

// Acciones
openCreateProjectModal()
openEditProjectModal()
showLoader(message?)
hideLoader()
```

### 4.4 Routing y Guards

```typescript
// Rutas principales (router/index.ts)
const routes = [
  { path: "/",               component: DashboardView,        meta: { requiresAuth: true } },
  { path: "/chat",           component: ChatView,             meta: { requiresAuth: true } },
  { path: "/projects",       component: ProjectsListView,     meta: { requiresAuth: true } },
  { path: "/project/:project", component: ProjectView,        meta: { requiresAuth: true } },
  { path: "/project-map",    component: ProjectMapView,       meta: { requiresAuth: true } },
  { path: "/search",         component: SemanticSearchView,   meta: { requiresAuth: true } },
  { path: "/deep-search",    component: DeepSearchView,       meta: { requiresAuth: true, permission: "deep-search:use" } },
  { path: "/mcp-auth",       component: McpAuthView,          meta: { requiresAuth: false } },
  {
    path: "/settings",
    component: SettingsView,
    children: [
      { path: "projects",    component: SettingsProjectsView },
      { path: "users",       component: SettingsUsersAdmin },
      { path: "roles",       component: SettingsRolesAdminView },
      { path: "mcp-tokens",  component: SettingsMcpTokensView },
      { path: "agents",      component: SettingsAgentsView },
    ]
  }
]

// Navigation guard global
router.beforeEach((to, from, next) => {
  const auth = useAuth()
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    next("/login")
  } else if (to.meta.permission && !auth.hasPermission(...)) {
    next("/")
  } else {
    next()
  }
})
```

### 4.5 Capa de API y Socket

#### Cliente HTTP (`api/api.ts`)

```typescript
// Patrón base — inyecta JWT automáticamente
async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("token")
  return fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    }
  })
}

// Funciones exportadas
export const getProjects = () => apiFetch("/api/projects")
export const createProject = (data) => apiFetch("/api/projects", { method: "POST", body: JSON.stringify(data) })
export const sendChatMessageStream = (data) => apiFetch("/api/chat/stream", { method: "POST", body: JSON.stringify(data) })
// ... etc
```

#### Socket.IO Client (`api/socket.ts`)

```typescript
// Conexión autenticada
const socket = io(SERVER_URL, {
  auth: { token: localStorage.getItem("token") }
})

// Eventos principales
socket.on("section:updated", handler)
socket.on("task:completed", handler)
socket.on("deep-search:progress", handler)
```

### 4.6 Dependencias del frontend

```json
// UI/package.json
{
  "dependencies": {
    "vue": "^3.5.29",
    "vue-router": "^5.0.3",
    "pinia": "^3.0.4",
    "@tailwindcss/vite": "^4.2.1",
    "tailwindcss": "^4.2.1",
    "@mdi/js": "^7.4.47",
    "@mdi/font": "^7.4.47",
    "markdown-it": "^14.1.1",
    "mermaid": "^11.12.3",
    "highlight.js": "^11.11.1",
    "md-editor-v3": "^6.4.0",
    "socket.io-client": "^4.8.3",
    "vue-sonner": "^2.0.9",
    "v-network-graph": "^0.9.22",
    "html2pdf.js": "^0.14.0"
  },
  "devDependencies": {
    "vite": "^7.3.1",
    "vue-tsc": "^3.2.5",
    "typescript": "^5.9.3"
  }
}
```

---

## 5. Endpoints de la API

### Autenticación

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/api/auth/login` | No | Login con usuario/contraseña |
| POST | `/api/auth/register` | No | Registro de usuario |
| GET | `/api/auth/me` | JWT | Obtener usuario actual |
| POST | `/api/auth/check-permission` | JWT | Verificar permiso |

### Proyectos

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/api/projects` | `projects:read` | Listar proyectos |
| POST | `/api/projects` | `projects:create` | Crear proyecto |
| GET | `/api/projects/:id` | `projects:read` | Obtener por ID |
| GET | `/api/projects/slug/:slug` | `projects:read` | Obtener por slug |
| PUT | `/api/projects/:id` | `projects:update` | Actualizar proyecto |
| DELETE | `/api/projects/:id` | `projects:delete` | Eliminar proyecto |
| GET | `/api/projects/:id/network-map` | `projects:read` | Mapa de relaciones |
| POST | `/api/projects/:id/pdf` | `projects:read` | Generar PDF |

### Secciones

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/api/projects/:projectId/sections` | `sections:read` | Listar secciones |
| POST | `/api/projects/:projectId/sections` | `sections:create` | Crear sección |
| PUT | `/api/projects/:projectId/sections/:sectionId` | `sections:update` | Actualizar |
| DELETE | `/api/projects/:projectId/sections/:sectionId` | `sections:delete` | Eliminar |
| GET | `/api/sections/search?q=` | `sections:read` | Búsqueda semántica |

### Chat

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/api/chat` | JWT | Mensaje a IA (respuesta completa) |
| POST | `/api/chat/stream` | JWT | Mensaje a IA (streaming SSE) |

### Búsqueda Avanzada

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| POST | `/api/deep-search` | `deep-search:use` | Crear búsqueda profunda |
| GET | `/api/deep-search/:id` | `deep-search:use` | Obtener resultados |
| PUT | `/api/deep-search/:id` | `deep-search:use` | Actualizar búsqueda |
| GET | `/api/deep-search` | `deep-search:use` | Listar búsquedas |

### Usuarios, Roles y Permisos

| Método | Ruta | Descripción |
|---|---|---|
| GET/POST | `/api/users` | Listar/crear usuarios |
| PUT/DELETE | `/api/users/:id` | Actualizar/eliminar usuario |
| POST | `/api/users/:userId/roles/:roleId` | Asignar rol a usuario |
| GET/POST | `/api/roles` | Listar/crear roles |
| POST | `/api/roles/:roleId/permissions/:permissionId` | Asignar permiso a rol |
| GET/POST/DELETE | `/api/permissions` | Gestión de permisos |

### Agentes y Tokens MCP

| Método | Ruta | Descripción |
|---|---|---|
| GET/POST/PUT/DELETE | `/api/agents` | Gestión de agentes IA |
| GET/POST/PUT/DELETE | `/api/mcp-tokens` | Gestión de tokens MCP |

### Tareas Pendientes

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/projects/:projectId/pending-tasks` | Listar tareas |
| PUT | `/api/projects/:projectId/pending-tasks/:taskId` | Actualizar tarea |
| DELETE | `/api/projects/:projectId/pending-tasks/:taskId` | Eliminar tarea |

### Oracle DB (Opcional)

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/oracle/search-objects` | Buscar objetos Oracle |
| GET | `/api/oracle/objects/:id/ddl` | Obtener DDL |

---

## 6. Esquema de Base de Datos

```
┌─────────────┐       ┌──────────────────┐
│   projects  │──────▶│    sections      │
│─────────────│  1:N  │──────────────────│
│ id (PK)     │       │ id (PK)          │
│ slug        │       │ projectId (FK)   │
│ title       │       │ section          │
│ repository  │       │ content          │
│ branch      │       │ order            │
│ keywords[]  │       │ subElemento (FK) │ ◀─┐ (jerarquía)
│ active      │       │ keywords[]       │   │
│ timestamps  │       │ files[]          │───┘
└─────────────┘       │ type             │
                      │ analyzed         │
                      │ timestamps       │
                      └──────────────────┘
                               │ 1:N
                               ▼
                      ┌──────────────────┐
                      │   comments       │
                      │──────────────────│
                      │ id (PK)          │
                      │ sectionId (FK)   │
                      │ userId (FK)      │
                      │ content          │
                      └──────────────────┘

┌─────────────┐       ┌──────────────────┐       ┌─────────────────┐
│    users    │──────▶│   user_roles     │◀──────│     roles       │
│─────────────│  N:M  │──────────────────│  N:M  │─────────────────│
│ id (PK)     │       │ userId (FK)      │       │ id (PK)         │
│ email       │       │ roleId (FK)      │       │ name            │
│ username    │       └──────────────────┘       │ description     │
│ password    │                                   └─────────────────┘
│ active      │                                          │ N:M
│ timestamps  │       ┌──────────────────┐               ▼
└─────────────┘       │   mcp_tokens     │       ┌─────────────────┐
       │              │──────────────────│       │ role_permissions│
       │ 1:N          │ id (PK)          │       │─────────────────│
       ▼              │ token            │       │ roleId (FK)     │
┌─────────────┐       │ userId (FK)      │       │ permissionId(FK)│
│deep_searches│       │ isActive         │       └─────────────────┘
│─────────────│       │ expiresAt        │               │
│ id (PK)     │       └──────────────────┘               ▼
│ userId (FK) │                                  ┌─────────────────┐
│ query       │                                  │   permissions   │
│ status      │                                  │─────────────────│
│ result JSON │                                  │ id (PK)         │
│ totalTime   │                                  │ resource        │
└─────────────┘                                  │ action          │
                                                 └─────────────────┘
```

---

## 7. Configuración del Entorno (.env)

```env
# ─── Servidor ─────────────────────────────────────────────
SERVER_URL=http://localhost:3001
SERVER_API_PATH=/api
SERVER_DATA_PATH=./data
# SERVER_DB_PATH=./data/clarify.db    # Opcional, tiene default

# ─── JWT ──────────────────────────────────────────────────
JWT_SECRET=cambiar-por-clave-aleatoria-segura

# ─── Servicio de Chat (IA) ────────────────────────────────
# Proveedor: openai o groq (compatible con API OpenAI)
CHAT_TYPE=openai
CHAT_BASE_URL=https://api.groq.com/openai/v1
CHAT_KEY=tu-api-key
CHAT_MODEL=moonshotai/kimi-k2-instruct-0905

# ─── Oracle DB (Opcional) ─────────────────────────────────
ORACLE_USER=
ORACLE_PASSWORD=
ORACLE_HOST=localhost
ORACLE_PORT=1521
ORACLE_SERVICE_NAME=
ORACLE_DBLINK=LOCAL
```

---

## 8. Scripts Disponibles

### Raíz del monorepo

```bash
# Inicia backend + frontend en paralelo
npm run dev

# Build de producción (ambos)
npm run build

# Solo servidor
npm run dev:server

# Solo UI
npm run dev:ui

# Gestión de base de datos
npm run db:generate    # Genera migraciones desde schema.ts
npm run db:migrate     # Aplica migraciones pendientes
```

### Server (`Server/`)

```bash
npm run dev            # ts-node/nodemon con hot reload
npm run build          # tsc
npm start              # node dist/index.js
```

### UI (`UI/`)

```bash
npm run dev            # Vite dev server
npm run build          # Build producción
npm run preview        # Preview del build
```

---

## 9. Guía para Replicar el Proyecto

### Paso 1 — Configurar el monorepo

```json
// package.json raíz
{
  "workspaces": ["Server", "UI"],
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:ui\"",
    "dev:server": "npm run dev --workspace=Server",
    "dev:ui": "npm run dev --workspace=UI",
    "build": "npm run build --workspace=Server && npm run build --workspace=UI",
    "db:generate": "npm run db:generate --workspace=Server",
    "db:migrate": "npm run db:migrate --workspace=Server"
  }
}
```

### Paso 2 — Crear el backend con Clean Architecture

```
Server/src/
├── index.ts              # Crear servidor Express + MCP
├── domain/
│   ├── entities/         # Definir interfaces de entidades
│   └── repositories/     # Definir interfaces de repositorios
├── application/
│   ├── container.ts      # Instanciar repositorios e inyectarlos en use-cases
│   ├── services/
│   │   └── registry.service.ts   # ★ Implementar el registro dual
│   ├── routes/           # Registrar rutas via registry
│   └── use-cases/        # Un archivo por operación de negocio
├── infra/
│   ├── db/
│   │   ├── database.ts   # Drizzle + better-sqlite3
│   │   └── schema.ts     # Tablas
│   ├── repository/       # Implementar interfaces del dominio
│   └── service/          # Logger, Passport, Socket, etc.
└── shared/
    └── utils/envs.ts     # Centralizar acceso a process.env
```

### Paso 3 — Configurar Drizzle ORM

```typescript
// drizzle.config.ts
export default {
  schema: "./src/infra/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: { url: process.env.SERVER_DB_PATH || "./data/app.db" }
}
```

```typescript
// infra/db/database.ts
import { drizzle } from "drizzle-orm/better-sqlite3"
import Database from "better-sqlite3"
import * as schema from "./schema"

const sqlite = new Database(process.env.SERVER_DB_PATH || "./data/app.db")
sqlite.pragma("journal_mode = WAL")
sqlite.pragma("foreign_keys = ON")
export const db = drizzle(sqlite, { schema })
```

### Paso 4 — Implementar el registro dual REST + MCP

```typescript
// application/services/registry.service.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { Express } from "express"
import { z } from "zod"

export class RouteToolRegistry {
  constructor(
    private app: Express,
    private mcpServer: McpServer
  ) {}

  register(config: RouteToolConfig) {
    // Registrar en Express
    if (config.useBy.includes("server")) {
      this.app[config.method](
        config.path,
        ...buildMiddlewares(config),
        async (req, res) => {
          const result = await config.handler(req.body, req)
          res.json(result)
        }
      )
    }

    // Registrar en MCP
    if (config.useBy.includes("mcp")) {
      this.mcpServer.tool(
        config.toolName,
        config.toolDescription,
        config.inputSchema.shape,
        async (input) => config.handler(input)
      )
    }
  }
}
```

### Paso 5 — Configurar el frontend Vue 3

```typescript
// main.ts
import { createApp } from "vue"
import { createPinia } from "pinia"
import router from "./router"
import App from "./App.vue"
import "./assets/base.css"  // Tailwind CSS

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount("#app")
```

### Paso 6 — Estructura mínima de un store Pinia

```typescript
// store/useAuth.ts
import { defineStore } from "pinia"
import { ref, computed } from "vue"

export const useAuth = defineStore("auth", () => {
  const user = ref(null)
  const token = ref(localStorage.getItem("token"))

  const isAuthenticated = computed(() => !!token.value)

  async function login(credentials) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
      headers: { "Content-Type": "application/json" }
    })
    const data = await res.json()
    token.value = data.token
    user.value = data.user
    localStorage.setItem("token", data.token)
  }

  function logout() {
    user.value = null
    token.value = null
    localStorage.removeItem("token")
  }

  return { user, token, isAuthenticated, login, logout }
})
```

### Paso 7 — Guard de navegación

```typescript
// router/index.ts
import { createRouter, createWebHistory } from "vue-router"
import { useAuth } from "@/store/useAuth"

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach((to) => {
  const auth = useAuth()
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return "/login"
  }
})
```

### Checklist de replicación

- [ ] Monorepo con workspaces (Server + UI)
- [ ] `.env` con variables obligatorias (`JWT_SECRET`, `CHAT_KEY`, `CHAT_MODEL`)
- [ ] Drizzle ORM con schema y migraciones
- [ ] Seed de roles/permisos iniciales (`seed-auth.ts`)
- [ ] `RouteToolRegistry` para registro dual
- [ ] Passport.js configurado (Local + JWT)
- [ ] Middleware `requireAuth` y `requirePermission`
- [ ] Socket.IO en servidor y cliente
- [ ] Pinia stores: auth, dominio principal, UI
- [ ] Vue Router con navigation guards
- [ ] Cliente HTTP con JWT automático (`api.ts`)
- [ ] `SchedulerService` para tareas periódicas
- [ ] Winston para logging estructurado
- [ ] Shutdown graceful en `index.ts`

---

*Este documento cubre la arquitectura completa del proyecto Clarify. Para dudas sobre patrones específicos, revisar los archivos fuente referenciados en cada sección.*
