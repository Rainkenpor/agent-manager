import { registry } from '@applicationService/registry.service.js'
import { container } from '../container.js'
import { z } from 'zod'

const governanceSectionSchema = z.object({
	title: z.string().min(1),
	content: z.string().default('')
})

const createSchema = z.object({
	name: z.string().min(1),
	type: z.string().min(1),
	description: z.string().optional(),
	content: z.string().default(''),
	sections: z.array(governanceSectionSchema).default([])
})

const updateSchema = z.object({
	id: z.string(),
	name: z.string().optional(),
	type: z.string().optional(),
	description: z.string().nullable().optional(),
	content: z.string().optional(),
	sections: z.array(governanceSectionSchema).optional(),
	isActive: z.boolean().optional()
})

export function registerGovernanceRoutes(): void {
	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/governance',
		inputSchema: {},
		requiresAuth: true,
		requiredPermission: { resource: 'governance', action: 'read' },
		handler: async () => container.listGovernanceUseCase.execute()
	})

	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/governance/:id',
		inputSchema: z.object({ id: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'governance', action: 'read' },
		handler: async ({ input }) => container.getGovernanceUseCase.execute(input.id)
	})

	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/governance',
		inputSchema: createSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'governance', action: 'create' },
		handler: async ({ input }) => container.createGovernanceUseCase.execute(input)
	})

	registry.register({
		useBy: ['server'],
		method: 'PUT',
		path: '/api/governance/:id',
		inputSchema: updateSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'governance', action: 'update' },
		handler: async ({ input }) => container.updateGovernanceUseCase.execute(input)
	})

	registry.register({
		useBy: ['server'],
		method: 'DELETE',
		path: '/api/governance/:id',
		inputSchema: z.object({ id: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'governance', action: 'delete' },
		handler: async ({ input }) => container.deleteGovernanceUseCase.execute(input.id)
	})

	registry.register({
		useBy: ['mcp'],
		method: 'GET',
		path: '/api/governance/type/:type',
		inputSchema: z.object({ type: z.string().min(1) }).shape,
		toolName: 'get_governance',
		toolDescription:
			'Obtiene todos los registros activos de gobernanza para un tipo dado, incluyendo nombre, descripción, contenido, secciones y metadatos.',
		toolSource:'Gobernanza',
    toolAlwaysAvailable: true,
      handler: async ({ input }) => {
			const data = await container.governanceRepository.findByType(input.type)
			return { success: true, data }
		}
	})

	registry.register({
		useBy: ['mcp'],
		method: 'GET',
		path: '/api/governance/types',
		inputSchema: {},
		toolName: 'list_governance_types',
		toolDescription: 'Lista todos los tipos de gobernanza que tienen registros activos disponibles.',
		toolSource:'Gobernanza',
    handler: async () => {
			const result = await container.listGovernanceUseCase.execute()
			if (!result.success) return result
			const data = [...new Set(result.data.filter((item) => item.isActive).map((item) => item.type))].sort()
			return { success: true, data }
		}
	})
}
