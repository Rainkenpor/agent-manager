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
  type: z.enum(['manual', 'agent']).optional(),
  agentId: z.string().nullable().optional(),
  predecessors: z.array(z.string()).optional(),
})

const updateTemplateStageSchema = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  order: z.number().int().min(0).optional(),
  parallelGroup: z.string().nullable().optional(),
  type: z.enum(['manual', 'agent']).optional(),
  agentId: z.string().nullable().optional(),
  predecessors: z.array(z.string()).optional(),
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
  // ─── Templates (HTTP only) ───────────────────────────────────────────────────

  registry.register({
    useBy: ['server', 'mcp'],
    method: 'GET',
    path: '/api/traceability/templates',
    toolName: 'list_traceability_templates',
    toolDescription:
      'Lista todos los templates de trazabilidad disponibles. Cada template define las etapas y el flujo base que se usará al crear una nueva trazabilidad.',
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

  // ─── Template Stages (HTTP only) ─────────────────────────────────────────────

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
    toolName: 'list_traceabilities',
    toolDescription:
      'Lista todas las trazabilidades existentes con su estado, progreso de etapas y template de origen. Úsala para obtener el listado general antes de consultar el detalle de una trazabilidad específica.',
    inputSchema: {},
    requiresAuth: true,
    requiredPermission: { resource: 'traceability', action: 'read' },
    handler: async () => container.listTraceabilitiesUseCase.execute(),
  })

  registry.register({
    useBy: ['server', 'mcp'],
    method: 'GET',
    path: '/api/traceability/:id',
    toolName: 'get_traceability',
    toolDescription:
      'Obtiene el detalle completo de una trazabilidad por su ID: etapas, estado de cada etapa, tareas (con tipo y estado) y links asociados a cada etapa.',
    inputSchema: z.object({ id: z.string().describe('ID de la trazabilidad') }).shape,
    requiresAuth: true,
    requiredPermission: { resource: 'traceability', action: 'read' },
    handler: async ({ input }) => container.getTraceabilityUseCase.execute(input.id),
  })

  registry.register({
    useBy: ['server', 'mcp'],
    method: 'POST',
    path: '/api/traceability',
    toolName: 'create_traceability',
    toolDescription:
      'Crea una nueva trazabilidad a partir de un template. Las etapas del template se copian como instancias independientes. Usa list_traceability_templates para obtener los IDs de templates disponibles.',
    inputSchema: createTraceabilitySchema.shape,
    requiresAuth: true,
    requiredPermission: { resource: 'traceability', action: 'create' },
    handler: async ({ input }) => container.createTraceabilityUseCase.execute(input),
  })

  registry.register({
    useBy: ['server', 'mcp'],
    method: 'PUT',
    path: '/api/traceability/:id',
    toolName: 'update_traceability',
    toolDescription:
      'Actualiza el título, descripción o estado global de una trazabilidad. El estado puede ser: active (en curso), completed (finalizada) o archived (archivada).',
    inputSchema: updateTraceabilitySchema.shape,
    requiresAuth: true,
    requiredPermission: { resource: 'traceability', action: 'update' },
    handler: async ({ input }) => container.updateTraceabilityUseCase.execute(input),
  })

  registry.register({
    useBy: ['server', 'mcp'],
    method: 'DELETE',
    path: '/api/traceability/:id',
    toolName: 'delete_traceability',
    toolDescription:
      'Elimina permanentemente una trazabilidad junto con todas sus etapas, tareas y links. Esta acción no se puede deshacer.',
    inputSchema: z.object({ id: z.string().describe('ID de la trazabilidad a eliminar') }).shape,
    requiresAuth: true,
    requiredPermission: { resource: 'traceability', action: 'delete' },
    handler: async ({ input }) => container.deleteTraceabilityUseCase.execute(input.id),
  })

  // ─── Tasks (HTTP + MCP) ──────────────────────────────────────────────────────

  registry.register({
    useBy: ['server', 'mcp'],
    method: 'POST',
    path: '/api/traceability/tasks',
    toolName: 'create_traceability_task',
    toolDescription:
      'Crea una tarea dentro de una etapa de trazabilidad. Usa get_traceability para obtener el stageId de la etapa destino. El estado de la etapa se recalcula automáticamente al crear la tarea.',
    inputSchema: createTaskSchema.shape,
    requiresAuth: true,
    requiredPermission: { resource: 'traceability', action: 'update' },
    handler: async ({ input }) => container.createTaskUseCase.execute(input),
  })

  registry.register({
    useBy: ['server', 'mcp'],
    method: 'PUT',
    path: '/api/traceability/tasks/:id',
    toolName: 'update_traceability_task',
    toolDescription:
      'Actualiza una tarea de trazabilidad: título, descripción, tipo (task/bug) o estado (todo/in-progress/done/blocked). El estado de la etapa padre se recalcula automáticamente.',
    inputSchema: updateTaskSchema.shape,
    requiresAuth: true,
    requiredPermission: { resource: 'traceability', action: 'update' },
    handler: async ({ input }) => container.updateTaskUseCase.execute(input),
  })

  registry.register({
    useBy: ['server', 'mcp'],
    method: 'DELETE',
    path: '/api/traceability/tasks/:id',
    toolName: 'delete_traceability_task',
    toolDescription:
      'Elimina una tarea de una etapa de trazabilidad. Requiere el ID de la tarea y el stageId de la etapa a la que pertenece. El estado de la etapa se recalcula automáticamente.',
    inputSchema: z.object({
      id: z.string().describe('ID de la tarea a eliminar'),
      stageId: z.string().describe('ID de la etapa a la que pertenece la tarea'),
    }).shape,
    requiresAuth: true,
    requiredPermission: { resource: 'traceability', action: 'update' },
    handler: async ({ input }) => container.deleteTaskUseCase.execute(input.id, input.stageId),
  })

  // ─── Links (HTTP + MCP) ──────────────────────────────────────────────────────

  registry.register({
    useBy: ['server', 'mcp'],
    method: 'POST',
    path: '/api/traceability/links',
    toolName: 'create_traceability_link',
    toolDescription:
      'Añade un link a una etapa de trazabilidad. Los links permiten referenciar tickets de Jira, páginas de Confluence, PRs de GitHub/GitLab u otros recursos relacionados con la etapa.',
    inputSchema: createLinkSchema.shape,
    requiresAuth: true,
    requiredPermission: { resource: 'traceability', action: 'update' },
    handler: async ({ input }) => container.createLinkUseCase.execute(input),
  })

  registry.register({
    useBy: ['server', 'mcp'],
    method: 'DELETE',
    path: '/api/traceability/links/:id',
    toolName: 'delete_traceability_link',
    toolDescription: 'Elimina un link de una etapa de trazabilidad por su ID.',
    inputSchema: z.object({ id: z.string().describe('ID del link a eliminar') }).shape,
    requiresAuth: true,
    requiredPermission: { resource: 'traceability', action: 'update' },
    handler: async ({ input }) => container.deleteLinkUseCase.execute(input.id),
  })
}
