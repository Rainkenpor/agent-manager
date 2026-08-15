import { registry } from '@applicationService/registry.service.js'
import { z } from 'zod'
import { container } from '../container.js'

const stakeholderSchema = z.object({
	name: z.string().min(1),
	role: z.string().default(''),
	email: z.string().optional()
})

const createProyectoSchema = z.object({
	name: z.string().min(1),
	description: z.string().nullable().optional(),
	stakeholders: z.array(stakeholderSchema).optional(),
	status: z.string().optional(),
	chatAgentId: z.string().nullable().optional()
})

const updateProyectoSchema = z.object({
	id: z.string(),
	name: z.string().optional(),
	description: z.string().nullable().optional(),
	stakeholders: z.array(stakeholderSchema).optional(),
	status: z.string().optional(),
	chatAgentId: z.string().nullable().optional()
})

const sectionField = z
	.string()
	.min(1)
	.describe('Sección del JSON: historiasUsuario | arquitectura | proyectosRelacionados | metadatos (se admiten secciones propias)')

const pathField = z
	.string()
	.optional()
	.describe(
		'Ruta dentro de la sección en notación punto/corchete, relativa a la sección. Ej: "[0].status", "componentes[2].nombre", "owner". Omítela para operar sobre la sección completa.'
	)

const userIdOf = (req: unknown): string | undefined => (req as { user?: { id?: string } })?.user?.id

export function registerProyectoRoutes(): void {
	// ============================ PROYECTOS (REST) ============================
	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/proyectos',
		inputSchema: {},
		requiresAuth: true,
		requiredPermission: { resource: 'proyectos', action: 'read' },
		handler: async () => container.listProyectosUseCase.execute()
	})

	// "Mis proyectos" para el chat (cualquier usuario con acceso a chat). Debe ir antes de /:id.
	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/proyectos/mine',
		inputSchema: {},
		requiresAuth: true,
		requiredPermission: { resource: 'chat', action: 'read' },
		handler: async ({ context: { req } }) => {
			const userId = userIdOf(req)
			if (!userId) return { success: false, error: 'Usuario no autenticado' }
			return container.listMisProyectosUseCase.execute(userId)
		}
	})

	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/proyectos/:id',
		inputSchema: z.object({ id: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'proyectos', action: 'read' },
		handler: async ({ input }) => container.getProyectoUseCase.execute(input.id)
	})

	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/proyectos',
		inputSchema: createProyectoSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'proyectos', action: 'create' },
		handler: async ({ input, context: { req } }) => container.createProyectoUseCase.execute({ ...input, createdBy: userIdOf(req) ?? null })
	})

	registry.register({
		useBy: ['server'],
		method: 'PUT',
		path: '/api/proyectos/:id',
		inputSchema: updateProyectoSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'proyectos', action: 'update' },
		handler: async ({ input }) => container.updateProyectoUseCase.execute(input)
	})

	registry.register({
		useBy: ['server'],
		method: 'DELETE',
		path: '/api/proyectos/:id',
		inputSchema: z.object({ id: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'proyectos', action: 'delete' },
		handler: async ({ input }) => container.deleteProyectoUseCase.execute(input.id)
	})

	// ===================== JSON DE INFORMACIÓN (REST) =========================
	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/proyectos/:id/data',
		inputSchema: z.object({ id: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'proyectos', action: 'read' },
		handler: async ({ input }) => container.readProyectoDataUseCase.execute({ proyectoId: input.id })
	})

	registry.register({
		useBy: ['server'],
		method: 'PUT',
		path: '/api/proyectos/:id/data',
		inputSchema: z.object({ id: z.string(), data: z.record(z.string(), z.unknown()) }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'proyectos', action: 'update' },
		handler: async ({ input }) => container.replaceProyectoDataUseCase.execute({ proyectoId: input.id, data: input.data })
	})

	registry.register({
		useBy: ['server'],
		method: 'PUT',
		path: '/api/proyectos/:id/data/:section',
		inputSchema: z.object({ id: z.string(), section: z.string().min(1), value: z.unknown() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'proyectos', action: 'update' },
		handler: async ({ input }) =>
			container.replaceProyectoDataSectionUseCase.execute({ proyectoId: input.id, section: input.section, value: input.value })
	})

	// ======================= INTERESADOS (PARTICIPANTES) ======================
	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/proyectos/:id/participantes',
		inputSchema: z.object({ id: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'proyectos', action: 'read' },
		handler: async ({ input }) => container.listParticipantesUseCase.execute(input.id)
	})

	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/proyectos/:id/participantes',
		inputSchema: z.object({ id: z.string(), userId: z.string(), role: z.string().nullable().optional() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'proyectos', action: 'update' },
		handler: async ({ input, context: { req } }) =>
			container.addParticipanteUseCase.execute({
				proyectoId: input.id,
				userId: input.userId,
				role: input.role,
				invitedBy: userIdOf(req) ?? null
			})
	})

	registry.register({
		useBy: ['server'],
		method: 'DELETE',
		path: '/api/proyectos/:id/participantes/:userId',
		inputSchema: z.object({ id: z.string(), userId: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'proyectos', action: 'update' },
		handler: async ({ input }) => container.removeParticipanteUseCase.execute(input.id, input.userId)
	})

	// ============================ CHAT DEL PROYECTO ===========================
	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/proyectos/:id/chat',
		inputSchema: z.object({ id: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'proyectos', action: 'read' },
		handler: async ({ input, context: { req } }) => {
			const userId = userIdOf(req)
			if (!userId) return { success: false, error: 'Usuario no autenticado' }
			return container.getOrCreateProyectoChatUseCase.execute(input.id, userId)
		}
	})

	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/proyectos/:id/participantes/:userId/chat',
		inputSchema: z.object({ id: z.string(), userId: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'chat', action: 'create' },
		handler: async ({ input }) => container.openParticipanteChatUseCase.execute(input.id, input.userId)
	})

	// ============================ HERRAMIENTAS MCP ============================
	registry.register({
		useBy: ['mcp'],
		method: 'GET',
		path: '/api/proyectos/mcp/info',
		inputSchema: z.object({ proyectoId: z.string().describe('ID del proyecto en Agent Manager') }).shape,
		toolName: 'get_proyecto_info',
		toolDescription:
			'Obtiene la configuración de un proyecto (nombre, descripción, estado, interesados) junto con todo su JSON de información: historias de usuario, arquitectura, proyectos relacionados y metadatos.',
		toolSource: 'Proyectos',
		toolAlwaysAvailable: true,
		handler: async ({ input }) => container.getProyectoContextUseCase.execute(input)
	})

	registry.register({
		useBy: ['mcp'],
		method: 'GET',
		path: '/api/proyectos/mcp/data',
		inputSchema: z.object({
			proyectoId: z.string(),
			section: sectionField.optional(),
			path: pathField
		}).shape,
		toolName: 'read_proyecto_data',
		toolDescription:
			'Lee el JSON de información de un proyecto. Sin section devuelve el documento completo; con section devuelve esa sección; con path devuelve el valor exacto dentro de la sección.',
		toolSource: 'Proyectos',
		toolAlwaysAvailable: true,
		handler: async ({ input }) => container.readProyectoDataUseCase.execute(input)
	})

	registry.register({
		useBy: ['mcp'],
		method: 'POST',
		path: '/api/proyectos/mcp/data',
		inputSchema: z.object({
			proyectoId: z.string(),
			section: sectionField,
			path: pathField,
			value: z.unknown().describe('Valor JSON a insertar')
		}).shape,
		toolName: 'create_proyecto_data',
		toolDescription:
			'Crea un segmento nuevo en el JSON del proyecto. Si el destino es una lista, agrega el valor al final; si no existe, lo crea (el contenedor padre debe existir). Falla si ya hay un valor: usa update_proyecto_data para reemplazarlo.',
		toolSource: 'Proyectos',
		toolAvailableViaChat: true,
		handler: async ({ input }) => container.createProyectoDataUseCase.execute(input)
	})

	registry.register({
		useBy: ['mcp'],
		method: 'PUT',
		path: '/api/proyectos/mcp/data',
		inputSchema: z.object({
			proyectoId: z.string(),
			section: sectionField,
			path: pathField,
			value: z.unknown().describe('Nuevo valor JSON'),
			merge: z.boolean().optional().describe('Si es true y ambos valores son objetos, combina claves en lugar de reemplazar')
		}).shape,
		toolName: 'update_proyecto_data',
		toolDescription:
			'Actualiza un segmento existente del JSON del proyecto. Sin path reemplaza la sección completa; con path reemplaza el valor en esa ruta, que debe existir.',
		toolSource: 'Proyectos',
		toolAvailableViaChat: true,
		handler: async ({ input }) => container.updateProyectoDataUseCase.execute(input)
	})

	registry.register({
		useBy: ['mcp'],
		method: 'DELETE',
		path: '/api/proyectos/mcp/data',
		inputSchema: z.object({ proyectoId: z.string(), section: sectionField, path: pathField }).shape,
		toolName: 'delete_proyecto_data',
		toolDescription:
			'Elimina un segmento del JSON del proyecto. Con path borra ese elemento (los índices de una lista se recorren al eliminar); sin path vacía la sección completa.',
		toolSource: 'Proyectos',
		toolAvailableViaChat: true,
		handler: async ({ input }) => container.deleteProyectoDataUseCase.execute(input)
	})

	registry.register({
		useBy: ['mcp'],
		method: 'PUT',
		path: '/api/proyectos/mcp/config',
		inputSchema: z.object({
			proyectoId: z.string(),
			name: z.string().optional(),
			description: z.string().nullable().optional(),
			status: z.string().optional(),
			stakeholders: z.array(stakeholderSchema).optional()
		}).shape,
		toolName: 'update_proyecto',
		toolDescription: 'Actualiza la configuración del proyecto: nombre, descripción, estado e interesados.',
		toolSource: 'Proyectos',
		toolAvailableViaChat: true,
		handler: async ({ input }) => {
			const { proyectoId, ...changes } = input
			return container.updateProyectoUseCase.execute({ id: proyectoId, ...changes })
		}
	})
}
