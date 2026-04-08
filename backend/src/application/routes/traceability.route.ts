import { registry } from '@applicationService/registry.service.js'
import { container } from '../container.js'
import { z } from 'zod'

const createTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
})

const updateTemplateSchema = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
})

const createTemplateStageSchema = z.object({
  templateId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  role: z.string().optional(),
  order: z.number().int().min(0),
  parallelGroup: z.string().optional(),
})

const updateTemplateStageSchema = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  order: z.number().int().min(0).optional(),
  parallelGroup: z.string().nullable().optional(),
})

const createTraceabilitySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  templateId: z.string(),
})

const updateTraceabilitySchema = z.object({
  id: z.string(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(['active', 'completed', 'archived']).optional(),
})

const createTaskSchema = z.object({
  stageId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['task', 'bug']).optional(),
  status: z.enum(['todo', 'in-progress', 'done', 'blocked']).optional(),
})

const updateTaskSchema = z.object({
  id: z.string(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  type: z.enum(['task', 'bug']).optional(),
  status: z.enum(['todo', 'in-progress', 'done', 'blocked']).optional(),
})

const createLinkSchema = z.object({
  stageId: z.string(),
  label: z.string().min(1),
  url: z.string().url(),
  platform: z.enum(['jira', 'confluence', 'github', 'gitlab', 'generic']).optional(),
})

export function registerTraceabilityRoutes(): void {
  // ─── Templates (HTTP + MCP) ─────────────────────────────────────────────────

  registry.register({
    useBy: ['server', 'mcp'],
    method: 'GET',
    path: '/api/traceability/templates',
    inputSchema: {},
    requiresAuth: true,
    requiredPermission: { resource: 'traceability', action: 'read' },
    handler: async () => container.listTemplatesUseCase.execute(),
  })

  registry.register({
    useBy: ['server'],
    method: 'GET',
    path: '/api/traceability/templates/:id',
    inputSchema: z.object({ id: z.string() }).shape,
    requiresAuth: true,
    requiredPermission: { resource: 'traceability', action: 'read' },
    handler: async ({ input }) => container.getTemplateUseCase.execute(input.id),
  })

  registry.register({
    useBy: ['server'],
    method: 'POST',
    path: '/api/traceability/templates',
    inputSchema: createTemplateSchema.shape,
    requiresAuth: true,
    requiredPermission: { resource: 'traceability', action: 'create' },
    handler: async ({ input }) => container.createTemplateUseCase.execute(input),
  })

  registry.register({
    useBy: ['server'],
    method: 'PUT',
    path: '/api/traceability/templates/:id',
    inputSchema: updateTemplateSchema.shape,
    requiresAuth: true,
    requiredPermission: { resource: 'traceability', action: 'update' },
    handler: async ({ input }) => container.updateTemplateUseCase.execute(input),
  })

  registry.register({
    useBy: ['server'],
    method: 'DELETE',
    path: '/api/traceability/templates/:id',
    inputSchema: z.object({ id: z.string() }).shape,
    requiresAuth: true,
    requiredPermission: { resource: 'traceability', action: 'delete' },
    handler: async ({ input }) => container.deleteTemplateUseCase.execute(input.id),
  })

  // ─── Template Stages ─────────────────────────────────────────────────────────

  registry.register({
    useBy: ['server'],
    method: 'POST',
    path: '/api/traceability/templates/:templateId/stages',
    inputSchema: createTemplateStageSchema.shape,
    requiresAuth: true,
    requiredPermission: { resource: 'traceability', action: 'update' },
    handler: async ({ input }) => container.createTemplateStageUseCase.execute(input),
  })

  registry.register({
    useBy: ['server'],
    method: 'PUT',
    path: '/api/traceability/template-stages/:id',
    inputSchema: updateTemplateStageSchema.shape,
    requiresAuth: true,
    requiredPermission: { resource: 'traceability', action: 'update' },
    handler: async ({ input }) => container.updateTemplateStageUseCase.execute(input),
  })

  registry.register({
    useBy: ['server'],
    method: 'DELETE',
    path: '/api/traceability/template-stages/:id',
    inputSchema: z.object({ id: z.string() }).shape,
    requiresAuth: true,
    requiredPermission: { resource: 'traceability', action: 'delete' },
    handler: async ({ input }) => container.deleteTemplateStageUseCase.execute(input.id),
  })

  // ─── Traceabilities (HTTP + MCP) ─────────────────────────────────────────────

  registry.register({
    useBy: ['server', 'mcp'],
    method: 'GET',
    path: '/api/traceability',
    inputSchema: {},
    requiresAuth: true,
    requiredPermission: { resource: 'traceability', action: 'read' },
    handler: async () => container.listTraceabilitiesUseCase.execute(),
  })

  registry.register({
    useBy: ['server'],
    method: 'GET',
    path: '/api/traceability/:id',
    inputSchema: z.object({ id: z.string() }).shape,
    requiresAuth: true,
    requiredPermission: { resource: 'traceability', action: 'read' },
    handler: async ({ input }) => container.getTraceabilityUseCase.execute(input.id),
  })

  registry.register({
    useBy: ['server', 'mcp'],
    method: 'POST',
    path: '/api/traceability',
    inputSchema: createTraceabilitySchema.shape,
    requiresAuth: true,
    requiredPermission: { resource: 'traceability', action: 'create' },
    handler: async ({ input }) => container.createTraceabilityUseCase.execute(input),
  })

  registry.register({
    useBy: ['server'],
    method: 'PUT',
    path: '/api/traceability/:id',
    inputSchema: updateTraceabilitySchema.shape,
    requiresAuth: true,
    requiredPermission: { resource: 'traceability', action: 'update' },
    handler: async ({ input }) => container.updateTraceabilityUseCase.execute(input),
  })

  registry.register({
    useBy: ['server'],
    method: 'DELETE',
    path: '/api/traceability/:id',
    inputSchema: z.object({ id: z.string() }).shape,
    requiresAuth: true,
    requiredPermission: { resource: 'traceability', action: 'delete' },
    handler: async ({ input }) => container.deleteTraceabilityUseCase.execute(input.id),
  })

  // ─── Tasks ───────────────────────────────────────────────────────────────────

  registry.register({
    useBy: ['server', 'mcp'],
    method: 'POST',
    path: '/api/traceability/tasks',
    inputSchema: createTaskSchema.shape,
    requiresAuth: true,
    requiredPermission: { resource: 'traceability', action: 'update' },
    handler: async ({ input }) => container.createTaskUseCase.execute(input),
  })

  registry.register({
    useBy: ['server', 'mcp'],
    method: 'PUT',
    path: '/api/traceability/tasks/:id',
    inputSchema: updateTaskSchema.shape,
    requiresAuth: true,
    requiredPermission: { resource: 'traceability', action: 'update' },
    handler: async ({ input }) => container.updateTaskUseCase.execute(input),
  })

  registry.register({
    useBy: ['server'],
    method: 'DELETE',
    path: '/api/traceability/tasks/:id',
    inputSchema: z.object({ id: z.string(), stageId: z.string() }).shape,
    requiresAuth: true,
    requiredPermission: { resource: 'traceability', action: 'update' },
    handler: async ({ input }) => container.deleteTaskUseCase.execute(input.id, input.stageId),
  })

  // ─── Links ───────────────────────────────────────────────────────────────────

  registry.register({
    useBy: ['server'],
    method: 'POST',
    path: '/api/traceability/links',
    inputSchema: createLinkSchema.shape,
    requiresAuth: true,
    requiredPermission: { resource: 'traceability', action: 'update' },
    handler: async ({ input }) => container.createLinkUseCase.execute(input),
  })

  registry.register({
    useBy: ['server'],
    method: 'DELETE',
    path: '/api/traceability/links/:id',
    inputSchema: z.object({ id: z.string() }).shape,
    requiresAuth: true,
    requiredPermission: { resource: 'traceability', action: 'update' },
    handler: async ({ input }) => container.deleteLinkUseCase.execute(input.id),
  })
}
