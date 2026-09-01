import { registry } from '@applicationService/registry.service.js'
import { z } from 'zod'
import { container } from '../container.js'

const idSchema = z.object({ id: z.string() })

export function registerPresetQnaRoutes(): void {
	// Listar grupos de preguntas/respuestas preestablecidas
	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/preset-qna',
		inputSchema: { agentSlug: z.string().optional() },
		requiresAuth: true,
		requiredPermission: { resource: 'preset_qna', action: 'read' },
		handler: async ({ input }) => {
			return await container.listPresetQnaUseCase.execute(input.agentSlug)
		}
	})

	// Actualizar (dispara al agente para regenerar la respuesta y sus variantes)
	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/preset-qna/:id/refresh',
		inputSchema: idSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'preset_qna', action: 'update' },
		handler: async ({ input }) => {
			return await container.refreshPresetQnaUseCase.execute(input.id)
		}
	})

	// Eliminar un grupo
	registry.register({
		useBy: ['server'],
		method: 'DELETE',
		path: '/api/preset-qna/:id',
		inputSchema: idSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'preset_qna', action: 'delete' },
		handler: async ({ input }) => {
			return await container.deletePresetQnaUseCase.execute(input.id)
		}
	})
}
