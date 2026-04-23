# Agent Manager — Developer Guide

## Project Overview

Full-stack application for managing AI agents, MCP servers, users, and RBAC.
- **Backend**: Express.js + TypeORM (SQLite) + MCP protocol server
- **Frontend**: Vue 3 + Pinia + Tailwind CSS
- **Auth**: JWT + Azure AD OAuth2 + MCP OAuth2/PKCE

**Dev ports**: API → 3200, MCP → 3201, Frontend (dev) → 5173

---

## Adding a New Route (Backend)

Follow these steps every time you add a new resource or endpoint.

### 1. Define DB Entities (if needed)

Edit `backend/src/infra/db/entities.ts` and add a new TypeORM entity class:

```typescript
import { Entity, PrimaryColumn, Column } from 'typeorm'

@Entity('my_table')
export class MyTableEntity {
  @PrimaryColumn({ type: 'text' })
  id!: string

  @Column({ type: 'text' })
  name!: string

  @Column({ name: 'created_at', type: 'text' })
  createdAt!: string
}
```

Then register the entity in `backend/src/infra/db/database.ts` inside the `entities` array of `AppDataSource`. TypeORM's `synchronize: true` will auto-create/update the table on startup.

To generate and run explicit migrations:

```bash
npm run db:generate   # generates a new TypeORM migration
npm run db:migrate    # applies pending migrations
```

### 2. Create Domain Entities

`backend/src/domain/entities/my-resource.entity.ts`:

```typescript
export interface MyRecord { id: string; name: string; createdAt: string }
export interface CreateMyDTO { name: string }
```

### 3. Create Repository Interface

`backend/src/domain/repositories/my-resource.repository.ts`:

```typescript
import type { MyRecord, CreateMyDTO } from '../entities/my-resource.entity.js'

export interface IMyRepository {
  findAll(): Promise<MyRecord[]>
  findById(id: string): Promise<MyRecord | null>
  create(data: CreateMyDTO): Promise<MyRecord>
  delete(id: string): Promise<void>
}
```

Export it from `backend/src/domain/repositories/index.ts`:
```typescript
export * from "@domain/repositories/my-resource.repository.js";
```

### 4. Implement the Repository

`backend/src/infra/repository/my-resource.repository.ts`:

```typescript
import { db } from '../db/database.js'
import { myTable } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import type { IMyRepository } from '../../domain/repositories/my-resource.repository.js'
import type { MyRecord, CreateMyDTO } from '../../domain/entities/my-resource.entity.js'

export class MyRepository implements IMyRepository {
  async findAll(): Promise<MyRecord[]> {
    return db.select().from(myTable) as Promise<MyRecord[]>
  }

  async findById(id: string): Promise<MyRecord | null> {
    const rows = await db.select().from(myTable).where(eq(myTable.id, id))
    return rows[0] ?? null
  }

  async create(data: CreateMyDTO): Promise<MyRecord> {
    const id = uuidv4()
    const createdAt = new Date().toISOString()
    await db.insert(myTable).values({ id, ...data, createdAt })
    return { id, ...data, createdAt }
  }

  async delete(id: string): Promise<void> {
    await db.delete(myTable).where(eq(myTable.id, id))
  }
}
```

Export from `backend/src/infra/repository/index.ts`:
```typescript
export * from "./my-resource.repository.js";
```

### 5. Write Use Cases

`backend/src/application/use-cases/my-resource/create-my.use-case.ts`:

```typescript
import type { IMyRepository } from '@domain/repositories/my-resource.repository.js'
import type { MyRecord, CreateMyDTO } from '@domain/entities/my-resource.entity.js'

export class CreateMyUseCase {
  constructor(private readonly repo: IMyRepository) {}

  async execute(data: CreateMyDTO): Promise<{ success: true; data: MyRecord } | { success: false; error: string }> {
    try {
      const record = await this.repo.create(data)
      return { success: true, data: record }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  }
}
```

Create `backend/src/application/use-cases/my-resource/index.ts` exporting all use cases.

Add to `backend/src/application/use-cases/index.ts`:
```typescript
export * from "./my-resource/index.js";
```

### 6. Register in the IoC Container

Edit `backend/src/application/container.ts`:

```typescript
// 1. Import types and implementations at the top
import type { IMyRepository } from "@domain/repositories/index.js";
import { MyRepository } from "@infra/repository/index.js";
import { CreateMyUseCase } from "./use-cases/index.js";

// 2. Add private fields in the class body
private _myRepository: IMyRepository;
private _createMyUseCase?: CreateMyUseCase;

// 3. Initialize in constructor
this._myRepository = new MyRepository();

// 4. Add lazy getters
get createMyUseCase(): CreateMyUseCase {
  if (!this._createMyUseCase) {
    this._createMyUseCase = new CreateMyUseCase(this._myRepository);
  }
  return this._createMyUseCase;
}
```

### 7. Create the Route File

`backend/src/application/routes/my-resource.route.ts`:

```typescript
import { registry } from '@applicationService/registry.service.js'
import { container } from '../container.js'
import { z } from 'zod'

const createSchema = z.object({ name: z.string().min(1) })

export function registerMyResourceRoutes(): void {
  // GET list
  registry.register({
    useBy: ['server'],          // 'server' = HTTP only, 'mcp' = MCP tool only, or both
    method: 'GET',
    path: '/api/my-resource',
    inputSchema: {},
    requiresAuth: true,
    requiredPermission: { resource: 'my_resource', action: 'read' },
    handler: async () => {
      return await container.listMyUseCase.execute()
    },
  })

  // POST create
  registry.register({
    useBy: ['server'],
    method: 'POST',
    path: '/api/my-resource',
    inputSchema: createSchema.shape,
    requiresAuth: true,
    requiredPermission: { resource: 'my_resource', action: 'create' },
    handler: async ({ input }) => {
      return await container.createMyUseCase.execute(input)
    },
  })

  // DELETE by ID (route params merge into input)
  registry.register({
    useBy: ['server'],
    method: 'DELETE',
    path: '/api/my-resource/:id',
    inputSchema: z.object({ id: z.string() }).shape,
    requiresAuth: true,
    requiredPermission: { resource: 'my_resource', action: 'delete' },
    handler: async ({ input }) => {
      return await container.deleteMyUseCase.execute(input.id)
    },
  })
}
```

**Route handler context:**
- `input` — merged body + route params (validated against `inputSchema`)
- `context.req` / `context.res` — raw Express request/response (use sparingly)
- `context.req.user` — authenticated user (set by JWT middleware when `requiresAuth: true`)

### 8. Register the Route File

Edit `backend/src/application/routes/index.ts`:

```typescript
import { registerMyResourceRoutes } from './my-resource.route.js'

export function initializeRegistry(): void {
  // ... existing registrations
  registerMyResourceRoutes()
}
```

### 9. Add Permissions to Seed

Edit `backend/src/infra/db/seed-auth.ts` — add entries to `defaultPermissions`:

```typescript
{ id: randomUUID(), resource: 'my_resource', action: 'create', description: 'Create items', createdAt: new Date().toISOString() },
{ id: randomUUID(), resource: 'my_resource', action: 'read',   description: 'Read items',   createdAt: new Date().toISOString() },
{ id: randomUUID(), resource: 'my_resource', action: 'delete', description: 'Delete items', createdAt: new Date().toISOString() },
```

Re-run the seed to apply:
```bash
npm run db:seed
```

---

## Adding a New Page (Frontend)

### 1. Add API Functions

Edit `frontend/src/api/api.ts`:

```typescript
export const getMyResources = () =>
  request<{ success: boolean; data: any[] }>('/my-resource')

export const createMyResource = (data: { name: string }) =>
  request<{ success: boolean; data: any }>('/my-resource', {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const deleteMyResource = (id: string) =>
  request<{ success: boolean }>(`/my-resource/${id}`, { method: 'DELETE' })
```

### 2. Add a Route

Edit `frontend/src/router/index.ts`:

```typescript
{
  path: '/my-resource',
  name: 'my-resource',
  component: () => import('@/views/MyResourceView.vue'),
  meta: { requiresAuth: true, resource: 'my_resource' },
},
```

The `resource` in `meta` must match the permission resource name. The router guard automatically redirects users who lack any permission on that resource.

### 3. Add to Sidebar Navigation

Edit `frontend/src/components/SidebarNav.vue` — add to `allNavLinks`:

```typescript
{ to: '/my-resource', label: 'My Resource', icon: 'X', resource: 'my_resource' },
```

### 4. Add a Card to the Home Dashboard

Edit `frontend/src/views/HomeView.vue` — add to `allSections`:

```typescript
{
  to: '/my-resource',
  resource: 'my_resource',
  label: 'My Resource',
  description: 'Short description shown on the card.',
  gradient: 'from-pink-500 to-rose-600',
  glow: 'shadow-pink-500/20',
  badge: 'bg-pink-500/10 text-pink-400 ring-1 ring-pink-500/20',
  icon: `<path stroke-linecap="round" ... />`,
},
```

### 5. Create the View Component

`frontend/src/views/MyResourceView.vue` — follow the Vue 3 Composition API pattern:

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import * as api from '@/api/api'

const items = ref<any[]>([])
const error = ref('')

async function fetchItems() {
  try {
    const res = await api.getMyResources()
    items.value = res.data ?? []
  } catch (e: any) {
    error.value = e.message
  }
}

onMounted(fetchItems)
</script>

<template>
  <div class="p-6 bg-slate-950 text-white min-h-full">
    <!-- your UI here -->
  </div>
</template>
```

**Checking permissions in templates:**
```vue
<script setup>
import { useAuthStore } from '@/store/useAuth'
const auth = useAuthStore()
</script>

<template>
  <!-- Show only if user can create -->
  <button v-if="auth.hasPermission('my_resource', 'create')">Add item</button>
</template>
```

---

## Architecture Reference

```
backend/src/
├── domain/           # Entities + repository interfaces (no framework deps)
├── infra/
│   ├── db/           # Drizzle schema, migrations, seed
│   └── repository/   # Concrete repository implementations
└── application/
    ├── use-cases/    # Business logic, one class per operation
    ├── routes/       # Route definitions (HTTP + MCP tool)
    ├── container.ts  # IoC singleton
    └── services/     # Cross-cutting services (registry, agent-tools, scheduler)

frontend/src/
├── api/api.ts        # All fetch calls, JWT auto-injected
├── store/            # Pinia stores (useAuth, useToast)
├── router/index.ts   # Vue Router with auth+permission guards
├── views/            # Full-page components
└── components/       # Reusable UI (AppLayout, SidebarNav, etc.)
```

---

## LLM / Agent Interactions

**Always use `AgentService`** (`backend/src/infra/service/agent.service.ts`) for any interaction with a language model. Never make direct `fetch` calls to LLM APIs in use cases or routes.

`AgentService` delegates to `InternalAgentService` which handles:
- Provider routing: GitHub Copilot (`copilot/model`), OpenAI via stored token (`openai/model`), or direct API with `AGENT_BASE_URL` + `AGENT_KEY` env vars
- Agentic tool-calling loop (up to 60 iterations)
- Context pruning when history grows too large
- Both blocking and streaming execution

### Non-streaming (fire-and-forget)

```typescript
import { AgentService } from '@infra/service/agent.service.js'

const agentService = new AgentService()
const result = await agentService.executeAgent({
  agentSlug: agent.slug,     // used for logging / tool context
  query: 'What is 2 + 2?',
  systemPrompt: agent.content || undefined,
})
// result is a string with the final answer
```

### Streaming (multi-turn chat with history)

```typescript
import { AgentService } from '@infra/service/agent.service.js'

const agentService = new AgentService()
const chunks: string[] = []

for await (const chunk of agentService.initAgentStream({
  agentSlug: agent.slug,
  query: userMessage,
  systemPrompt: agent.content || undefined,
  history: previousMessages,   // Array<{ role: 'user'|'assistant', content: string }>
})) {
  chunks.push(chunk)
}

// Strip tool-progress markers before storing/displaying
const rawText = chunks.join('')
const cleanText = rawText.replace(/<<[^>]+>>[^<]*<<\\[^>]+>>/g, '').trim()
```

Tool-progress markers emitted during tool calls have the format:
- `<<id::toolName>>{args}<<\id>>` — tool invocation
- `<<id>>$result<<\id>>` — tool result

These can be filtered out with the regex above when you only need the final text answer.

### IAgentServiceExecute interface

| Field | Type | Description |
|-------|------|-------------|
| `agentSlug` | `string` | Agent identifier (used for logging) |
| `query` | `string` | The user's message / task |
| `systemPrompt` | `string?` | Override system prompt (use `agent.content`) |
| `history` | `Array<{role,content}>?` | Prior conversation turns (streaming only) |
| `allowedTools` | `Set<string>?` | Restrict which tools the agent can call; `undefined` = all tools |
| `artifacts` | `Array<{name,content}>?` | Extra context injected before the query |
| `stream` | `boolean?` | Not used by the public API (use `initAgentStream` instead) |

---

---

## Streaming SSE responses

When a route needs to stream data to the client (e.g. LLM token deltas), return `null` from the handler and write directly to `res` using Server-Sent Events:

```typescript
registry.register({
  useBy: ['server'],
  method: 'POST',
  path: '/api/my-resource/stream',
  inputSchema: mySchema.shape,
  requiresAuth: true,
  handler: async ({ input, context: { res } }) => {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')  // disable nginx buffering
    res.flushHeaders()

    const sendEvent = (data: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`)
    }

    try {
      for await (const chunk of someAsyncGenerator()) {
        sendEvent({ type: 'chunk', content: chunk })
      }
      sendEvent({ type: 'done', result: finalValue })
    } catch (error) {
      sendEvent({ type: 'error', error: (error as Error).message })
    }

    res.end()
    return null  // prevents registry from calling res.json() again
  },
})
```

**Frontend consumption** — use `fetch` + `ReadableStream` (not `EventSource`, which doesn't support POST):

```typescript
const response = await fetch('/api/my-resource/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify(data),
})
const reader = response.body!.getReader()
const decoder = new TextDecoder()
let buffer = ''

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  buffer += decoder.decode(value, { stream: true })
  const parts = buffer.split('\n\n')
  buffer = parts.pop() ?? ''
  for (const part of parts) {
    const line = part.trim()
    if (!line.startsWith('data: ')) continue
    const event = JSON.parse(line.slice(6))
    if (event.type === 'chunk') { /* append */ }
    else if (event.type === 'done') { /* finalize */ }
    else if (event.type === 'error') { /* handle */ }
  }
}
```

---

### Response format

All backend handlers should return:
- **Success**: `{ success: true, data: T }`
- **Error**: `{ success: false, error: string }`

The registry middleware maps `success: false` responses to HTTP 400 automatically, or you can call `res.status(N).json(...)` directly for specific status codes.

### Path aliases (backend tsconfig)

| Alias | Resolves to |
|-------|-------------|
| `@application` | `backend/src/application` |
| `@applicationService` | `backend/src/application/services` |
| `@domain` | `backend/src/domain` |
| `@infra` | `backend/src/infra` |

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `AGENT_BASE_URL` | LLM API base URL (OpenAI-compatible, e.g. `https://api.openai.com/v1`) |
| `AGENT_KEY` | LLM API key |
| `AGENT_MODEL` | Default model identifier |
| `SERVER_PORT` | API server port (default: 3001) |
| `MCP_PORT` | MCP server port (default: 3002) |
| `JWT_SECRET` | Secret for signing JWT tokens |

---

## Common Commands

```bash
npm run dev           # Start backend + frontend in watch mode
npm run db:generate   # Generate Drizzle migration from schema changes
npm run db:migrate    # Apply pending migrations
npm run db:seed       # Seed default permissions, roles, and admin user
npm run build         # Build backend + frontend for production
```
