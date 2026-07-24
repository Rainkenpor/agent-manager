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
	clarifyProjectId: z.string().nullable().optional(),
	architecture: z.string().nullable().optional(),
	programmingLanguage: z.string().nullable().optional(),
	stakeholders: z.array(stakeholderSchema).optional(),
	status: z.string().optional(),
	chatAgentId: z.string().nullable().optional()
})

const updateProyectoSchema = z.object({
	id: z.string(),
	name: z.string().optional(),
	description: z.string().nullable().optional(),
	clarifyProjectId: z.string().nullable().optional(),
	architecture: z.string().nullable().optional(),
	programmingLanguage: z.string().nullable().optional(),
	stakeholders: z.array(stakeholderSchema).optional(),
	status: z.string().optional(),
	chatAgentId: z.string().nullable().optional()
})

const createServicioSchema = z.object({
	proyectoId: z.string(),
	name: z.string().min(1),
	repoUrl: z.string().min(1),
	repoRef: z.string().nullable().optional(),
	governanceId: z.string().nullable().optional(),
	governanceType: z.string().nullable().optional()
})

const updateServicioSchema = z.object({
	id: z.string(),
	name: z.string().optional(),
	repoUrl: z.string().optional(),
	repoRef: z.string().nullable().optional(),
	governanceId: z.string().nullable().optional(),
	governanceType: z.string().nullable().optional()
})

const historiaStatusEnum = z.enum(['pending', 'in_progress', 'done', 'blocked'])

const createHistoriaSchema = z.object({
	proyectoId: z.string(),
	code: z.string().nullable().optional(),
	title: z.string().min(1),
	description: z.string().nullable().optional(),
	additionalInfo: z.record(z.string(), z.unknown()).nullable().optional(),
	status: historiaStatusEnum.optional()
})

const updateHistoriaSchema = z.object({
	id: z.string(),
	code: z.string().nullable().optional(),
	title: z.string().optional(),
	description: z.string().nullable().optional(),
	additionalInfo: z.record(z.string(), z.unknown()).nullable().optional(),
	status: historiaStatusEnum.optional()
})

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

	// ============================ SERVICIOS (REST) ============================
	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/proyectos/:proyectoId/servicios',
		inputSchema: z.object({ proyectoId: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'proyectos', action: 'read' },
		handler: async ({ input }) => container.listServiciosUseCase.execute(input.proyectoId)
	})

	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/proyectos/:proyectoId/servicios',
		inputSchema: createServicioSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'proyectos', action: 'update' },
		handler: async ({ input }) => container.addServicioUseCase.execute(input)
	})

	registry.register({
		useBy: ['server'],
		method: 'PUT',
		path: '/api/proyectos/servicios/:id',
		inputSchema: updateServicioSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'proyectos', action: 'update' },
		handler: async ({ input }) => container.updateServicioUseCase.execute(input)
	})

	registry.register({
		useBy: ['server'],
		method: 'DELETE',
		path: '/api/proyectos/servicios/:id',
		inputSchema: z.object({ id: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'proyectos', action: 'update' },
		handler: async ({ input }) => container.deleteServicioUseCase.execute(input.id)
	})

	// ======================= HISTORIAS DE USUARIO (REST) ======================
	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/proyectos/:proyectoId/historias',
		inputSchema: z.object({ proyectoId: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'proyectos', action: 'read' },
		handler: async ({ input }) => container.listHistoriasUseCase.execute(input.proyectoId)
	})

	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/proyectos/:proyectoId/historias',
		inputSchema: createHistoriaSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'proyectos', action: 'update' },
		handler: async ({ input }) => container.createHistoriaUseCase.execute(input)
	})

	registry.register({
		useBy: ['server'],
		method: 'PUT',
		path: '/api/proyectos/historias/:id',
		inputSchema: updateHistoriaSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'proyectos', action: 'update' },
		handler: async ({ input }) => container.updateHistoriaUseCase.execute(input)
	})

	registry.register({
		useBy: ['server'],
		method: 'DELETE',
		path: '/api/proyectos/historias/:id',
		inputSchema: z.object({ id: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'proyectos', action: 'update' },
		handler: async ({ input }) => container.deleteHistoriaUseCase.execute(input.id)
	})

	// ======================= COMENTARIOS DE HU (REST) =========================
	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/proyectos/historias/:id/comentarios',
		inputSchema: z.object({ id: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'proyectos', action: 'read' },
		handler: async ({ input }) => container.listComentariosUseCase.execute(input.id)
	})

	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/proyectos/historias/:id/comentarios',
		inputSchema: z.object({ id: z.string(), content: z.string().min(1) }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'proyectos', action: 'update' },
		handler: async ({ input, context: { req } }) =>
			container.addComentarioUseCase.execute({ historiaId: input.id, author: userIdOf(req) ?? 'usuario', content: input.content })
	})

	// ======================= VERIFICACIÓN / ESCRITURA DE REPOS ================
	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/proyectos/:id/verify-repos',
		inputSchema: z.object({ id: z.string(), servicioId: z.string().optional() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'proyectos', action: 'read' },
		handler: async ({ input, context: { req } }) =>
			container.verifyRepoFilesUseCase.execute({ proyectoId: input.id, servicioId: input.servicioId, userId: userIdOf(req) })
	})

	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/proyectos/:id/apply-repos',
		inputSchema: z.object({ id: z.string(), servicioId: z.string().optional() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'proyectos', action: 'update' },
		handler: async ({ input, context: { req } }) =>
			container.applyRepoFilesUseCase.execute({ proyectoId: input.id, servicioId: input.servicioId, userId: userIdOf(req) })
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
		inputSchema: z.object({
			proyectoId: z.string().optional().describe('ID del proyecto en Agent Manager'),
			clarifyProjectId: z.string().optional().describe('ID del proyecto en Clarify (alternativa a proyectoId)')
		}).shape,
		toolName: 'get_proyecto_info',
		toolDescription:
			'Obtiene toda la información de un proyecto: metadatos (arquitectura, lenguaje, interesados), servicios/repos con su gobernanza, e historias de usuario con estado y comentarios. Provee proyectoId o clarifyProjectId.',
		toolSource: 'Proyectos',
		toolAlwaysAvailable: true,
		handler: async ({ input }) => container.getProyectoContextUseCase.execute(input)
	})

	registry.register({
		useBy: ['mcp'],
		method: 'GET',
		path: '/api/proyectos/mcp/historias',
		inputSchema: z.object({ proyectoId: z.string() }).shape,
		toolName: 'list_historias_usuario',
		toolDescription: 'Lista las historias de usuario de un proyecto con su estado.',
		toolSource: 'Proyectos',
		toolAlwaysAvailable: true,
		handler: async ({ input }) => container.listHistoriasUseCase.execute(input.proyectoId)
	})

	registry.register({
		useBy: ['mcp'],
		method: 'POST',
		path: '/api/proyectos/mcp/hu-comment',
		inputSchema: z.object({ historiaId: z.string(), content: z.string().min(1) }).shape,
		toolName: 'add_hu_comment',
		toolDescription: 'Agrega un comentario a una historia de usuario.',
		toolSource: 'Proyectos',
		toolAlwaysAvailable: true,
		handler: async ({ input, context }) =>
			container.addComentarioUseCase.execute({
				historiaId: input.historiaId,
				author: userIdOf(context?.req) ?? 'agente',
				content: input.content
			})
	})

	registry.register({
		useBy: ['mcp'],
		method: 'POST',
		path: '/api/proyectos/mcp/hu-status',
		inputSchema: z.object({ historiaId: z.string(), status: historiaStatusEnum }).shape,
		toolName: 'update_hu_status',
		toolDescription: 'Cambia el estado de una historia de usuario (pending | in_progress | done | blocked).',
		toolSource: 'Proyectos',
		toolAlwaysAvailable: true,
		handler: async ({ input }) => container.updateHistoriaStatusUseCase.execute(input.historiaId, input.status)
	})

	// ============ CRUD DE HU VÍA CHAT (persistido en BD) ============
	registry.register({
		useBy: ['mcp'],
		method: 'POST',
		path: '/api/proyectos/mcp/hu',
		inputSchema: createHistoriaSchema.shape,
		toolName: 'create_historia_usuario',
		toolDescription: 'Crea una historia de usuario en el proyecto. Úsalo cuando el usuario pida agregar una HU desde el chat.',
		toolSource: 'Proyectos',
		toolAvailableViaChat: true,
		toolShowAssignment: false,
		handler: async ({ input }) => container.createHistoriaUseCase.execute(input)
	})

	registry.register({
		useBy: ['mcp'],
		method: 'PUT',
		path: '/api/proyectos/mcp/hu',
		inputSchema: updateHistoriaSchema.shape,
		toolName: 'update_historia_usuario',
		toolDescription: 'Actualiza una historia de usuario existente (título, descripción, información adicional o estado).',
		toolSource: 'Proyectos',
		toolAvailableViaChat: true,
		toolShowAssignment: false,
		handler: async ({ input }) => container.updateHistoriaUseCase.execute(input)
	})

	registry.register({
		useBy: ['mcp'],
		method: 'DELETE',
		path: '/api/proyectos/mcp/hu',
		inputSchema: z.object({ id: z.string() }).shape,
		toolName: 'delete_historia_usuario',
		toolDescription: 'Elimina una historia de usuario del proyecto.',
		toolSource: 'Proyectos',
		toolAvailableViaChat: true,
		toolShowAssignment: false,
		handler: async ({ input }) => container.deleteHistoriaUseCase.execute(input.id)
	})
}
