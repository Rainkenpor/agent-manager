import { registry } from '@applicationService/registry.service.js'
import { z } from 'zod'
import { container } from '../container.js'

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
		toolSource: 'Gobernanza',
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
		toolSource: 'Gobernanza',
		handler: async () => {
			const result = await container.listGovernanceUseCase.execute()
			if (!result.success) return result
			const data = [...new Set(result.data.filter((item) => item.isActive).map((item) => item.type))].sort((a, b) => a.localeCompare(b))
			return { success: true, data }
		}
	})

	registry.register({
		useBy: ['mcp'],
		method: 'GET',
		path: '/api/governance/traceability/by-code',
		inputSchema: z.object({
			code: z.string().min(1).describe('Código único de 4 caracteres de la trazabilidad (ej. "AB3K")'),
			view: z
				.enum(['summary', 'documents', 'links', 'full'])
				.optional()
				.describe(
					'Qué datos retornar: "summary" (resumen + etapas, por defecto), "documents" (documentos de las etapas), "links" (links de las etapas), "full" (todo)'
				),
			stageId: z.string().optional().describe('ID de una etapa específica para filtrar documentos o links solo de ese grupo (opcional)'),
			documentNames: z
				.array(z.string())
				.optional()
				.describe(
					'Lista de nombres de documentos a obtener con su contenido completo (solo aplica con view="documents"). ' +
						'Si se omite, retorna solo los nombres y metadatos de todos los documentos sin el contenido.'
				)
		}).shape,
		toolName: 'get_traceability_by_code',
		toolDescription:
			'Obtiene la información de una trazabilidad a partir de su código de 4 caracteres. ' +
			'Por defecto retorna un resumen (view="summary"). ' +
			'Usa view="documents" para listar los documentos; combínalo con documentNames=[...] para obtener el contenido completo de documentos específicos. ' +
			'Usa view="links" para obtener los links registrados, o view="full" para obtener todo el detalle. ' +
			'Opcionalmente filtra a una etapa con stageId.',
		toolSource: 'Gobernanza',
		toolAlwaysAvailable: true,
		handler: async ({ input }) => container.getTraceabilityByCodeUseCase.execute(input)
	})
}
