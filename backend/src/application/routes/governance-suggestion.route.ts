import { registry } from '@applicationService/registry.service.js'
import { z } from 'zod'
import { container } from '../container.js'

const suggestSchema = z.object({
	type: z.string().min(1).describe('Tipo de gobernanza al que aplica la sugerencia (mismo formato que get_governance).'),
	title: z.string().min(1).describe('Título corto que describe la sugerencia.'),
	content: z.string().min(1).describe('Contenido propuesto a incluir en la gobernanza (puede ser markdown).'),
	reason: z.string().optional().describe('Motivo o justificación de por qué se propone esta sugerencia.')
})

export function registerGovernanceSuggestionRoutes(): void {
	// MCP tool — agentes proponen nuevas reglas de gobernanza
	registry.register({
		useBy: ['mcp'],
		method: 'POST',
		path: '/api/governance-suggestions',
		inputSchema: suggestSchema.shape,
		toolName: 'suggest_governance',
		toolDescription:
			'Registra una sugerencia de gobernanza para un `type` dado cuando detectes una regla, lineamiento o criterio relevante que no exista todavía en la gobernanza actual. Persiste título, contenido propuesto y motivo, asociándolo al usuario autenticado para revisión humana posterior.',
		toolSource: 'Gobernanza',
		toolAlwaysAvailable: true,
		requiresAuth: true,
		handler: async ({ input, context }) => {
			const user = context.req.user as Record<string, unknown> | undefined
			const userId = (user?.id as string | undefined) ?? (user?.userId as string | undefined) ?? null

			let userEmail: string | null = (user?.email as string | undefined) ?? null
			if (!userEmail && userId) {
				try {
					const found = await container.userRepository.findById(userId)
					userEmail = found?.email ?? null
				} catch {
					userEmail = null
				}
			}

			return container.createGovernanceSuggestionUseCase.execute({
				type: input.type,
				title: input.title,
				content: input.content,
				reason: input.reason ?? null,
				agentSlug: null,
				userId,
				userEmail
			})
		}
	})

	// REST — listado, detalle y eliminación desde el frontend
	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/governance-suggestions',
		inputSchema: {},
		requiresAuth: true,
		requiredPermission: { resource: 'governance_suggestion', action: 'read' },
		handler: async () => container.listGovernanceSuggestionsUseCase.execute()
	})

	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/governance-suggestions/:id',
		inputSchema: z.object({ id: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'governance_suggestion', action: 'read' },
		handler: async ({ input }) => container.getGovernanceSuggestionUseCase.execute(input.id)
	})

	registry.register({
		useBy: ['server'],
		method: 'DELETE',
		path: '/api/governance-suggestions/:id',
		inputSchema: z.object({ id: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'governance_suggestion', action: 'delete' },
		handler: async ({ input }) => container.deleteGovernanceSuggestionUseCase.execute(input.id)
	})
}
