import { z } from 'zod'
import { registry } from '@applicationService/registry.service.js'
import { container } from '../container.js'

const sourceSchema = z.object({
	function_name: z
		.string()
		.min(1)
		.describe('Nombre del tool MCP a ejecutar como fuente. Formato: mcp__{serverName}__{toolName}, e.g. "mcp__jira__get_issues"'),
	params: z.record(z.string(), z.unknown()).default({}).describe('Parámetros para el tool fuente')
})

const conditionSchema = z.object({
	field: z
		.string()
		.min(1)
		.describe('Ruta del campo a evaluar, e.g. "element.status.name"'),
	operator: z
		.enum(['==', '===', '!=', '!==', '>', '<', '>=', '<=', 'contains', 'startsWith', 'endsWith'])
		.describe('Operador de comparación'),
	value: z.unknown().describe('Valor esperado')
})

const actionSchema = z.object({
	function_name: z
		.string()
		.min(1)
		.describe('Nombre del tool MCP a ejecutar como acción. Formato: mcp__{serverName}__{toolName}, e.g. "mcp__slack__send_message"'),
	params: z.record(z.string(), z.unknown()).default({}).describe('Parámetros para el tool de acción')
})

const createSchema = z.object({
	name: z.string().min(1).describe('Nombre descriptivo del listener'),
	schedule: z
		.string()
		.min(1)
		.describe('Expresión cron de 5 campos, e.g. "*/15 * * * *"'),
	source: sourceSchema.describe('Tool que se ejecuta para obtener los datos'),
	condition: conditionSchema.describe('Condición que debe cumplirse para disparar las acciones'),
	action: z.array(actionSchema).min(1).describe('Lista de tools a ejecutar cuando la condición es verdadera'),
	enabled: z.boolean().default(true).describe('Si el listener está activo')
})

const updateSchema = z.object({
	id: z.string().describe('ID del listener a actualizar'),
	name: z.string().min(1).optional(),
	schedule: z.string().min(1).optional(),
	source: sourceSchema.optional(),
	condition: conditionSchema.optional(),
	action: z.array(actionSchema).min(1).optional(),
	enabled: z.boolean().optional()
})

export function registerEventListenerRoutes(): void {
	// List all
	registry.register({
		useBy: ['server', 'mcp'],
		method: 'GET',
		path: '/api/event-listeners',
		toolName: 'list_event_listeners',
		toolDescription:
			'Lista todos los event listeners registrados. Estos listeners ejecutan un tool periódicamente y disparan acciones cuando la condición se cumple.',
		inputSchema: {},
		requiresAuth: true,
		requiredPermission: { resource: 'event_listeners', action: 'read' },
		handler: async () => container.listEventListenersUseCase.execute()
	})

	// Get by ID
	registry.register({
		useBy: ['server', 'mcp'],
		method: 'GET',
		path: '/api/event-listeners/:id',
		toolName: 'get_event_listener',
		toolDescription: 'Obtiene el detalle completo de un event listener por su ID.',
		inputSchema: z.object({ id: z.string().describe('ID del event listener') }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'event_listeners', action: 'read' },
		handler: async ({ input }) => container.getEventListenerUseCase.execute((input as any).id)
	})

	// Create
	registry.register({
		useBy: ['server', 'mcp'],
		method: 'POST',
		path: '/api/event-listeners',
		toolName: 'create_event_listener',
		toolDescription: `Crea un nuevo event listener que ejecuta un tool MCP periódicamente según una expresión cron.
Cuando la condición definida se cumple, ejecuta los tools de acción y se auto-elimina.

Los function_name son tools del registro con el formato mcp__{serverName}__{toolName}.

Ejemplo:
{
  "name": "Verificador de pedidos completados",
  "schedule": "*/15 * * * *",
  "source": { "function_name": "mcp__erp__get_orders", "params": { "limit": 50 } },
  "condition": { "field": "element.status.name", "operator": "==", "value": "Completado" },
  "action": [{ "function_name": "mcp__slack__send_message", "params": { "channel": "#shipping" } }]
}`,
		inputSchema: createSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'event_listeners', action: 'create' },
		handler: async ({ input }) => {
			const result = await container.createEventListenerUseCase.execute(input as any)
			if (result.success) {
				// Schedule it immediately after creation
				container.eventListenerExecutor.scheduleListener(result.data)
			}
			return result
		}
	})

	// Update
	registry.register({
		useBy: ['server', 'mcp'],
		method: 'PUT',
		path: '/api/event-listeners/:id',
		toolName: 'update_event_listener',
		toolDescription: 'Actualiza un event listener existente (nombre, schedule, fuente, condición, acciones o estado habilitado).',
		inputSchema: updateSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'event_listeners', action: 'update' },
		handler: async ({ input }) => {
			const result = await container.updateEventListenerUseCase.execute(input as any)
			if (result.success) {
				// Re-schedule with updated config
				container.eventListenerExecutor.cancelListener(result.data.id)
				if (result.data.enabled) {
					container.eventListenerExecutor.scheduleListener(result.data)
				}
			}
			return result
		}
	})

	// Delete
	registry.register({
		useBy: ['server', 'mcp'],
		method: 'DELETE',
		path: '/api/event-listeners/:id',
		toolName: 'delete_event_listener',
		toolDescription: 'Elimina un event listener y cancela su programación.',
		inputSchema: z.object({ id: z.string().describe('ID del event listener a eliminar') }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'event_listeners', action: 'delete' },
		handler: async ({ input }) => {
			const id = (input as any).id
			container.eventListenerExecutor.cancelListener(id)
			return container.deleteEventListenerUseCase.execute(id)
		}
	})

	// Trigger manually
	registry.register({
		useBy: ['server', 'mcp'],
		method: 'POST',
		path: '/api/event-listeners/:id/trigger',
		toolName: 'trigger_event_listener',
		toolDescription: 'Dispara manualmente un event listener (ejecuta fuente → evalúa condición → ejecuta acciones si aplica).',
		inputSchema: z.object({ id: z.string().describe('ID del event listener a disparar') }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'event_listeners', action: 'update' },
		handler: async ({ input }) => {
			const id = (input as any).id
			const result = await container.eventListenerExecutor.executeListener(id)
			return { success: true, data: result }
		}
	})
}
