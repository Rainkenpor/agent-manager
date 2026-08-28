import { registry } from '@applicationService/registry.service.js'
import { codexModelsService } from '@infra/service/codex-models.service.js'
import { providerAuthService } from '@infra/service/provider-auth.service.js'
import { z } from 'zod'
import { envs } from '../../envs.js'
import { container } from '../container.js'

const ExportResourceEnum = z.enum(['agents', 'skills', 'mcps', 'traceabilities', 'roles', 'users'])

const exportSchema = z.object({
	resources: z.array(ExportResourceEnum).min(1)
})

const importSchema = z.object({
	payload: z.record(z.string(), z.unknown())
})

const providerStartAuthSchema = z.object({
	returnTo: z.string().url().optional()
})

// Mapa abierto: cada modelo expone sus propios parámetros de muestreo.
const samplingParamsSchema = z.record(z.string(), z.union([z.number(), z.string(), z.boolean()]))

const samplingSchema = z.object({
	defaultMode: z.enum(['thinking', 'instruct']).optional(),
	thinking: samplingParamsSchema.optional(),
	instruct: samplingParamsSchema.optional()
})

const saveApiProviderSchema = z.object({
	provider: z.string().min(1),
	label: z.string().min(1),
	baseURL: z.string().url(),
	apiKey: z.string().min(1).optional(),
	model: z.string().min(1),
	sampling: samplingSchema.optional()
})

const updateSamplingSchema = z.object({
	provider: z.string().min(1),
	defaultMode: z.enum(['thinking', 'instruct']).optional(),
	thinking: samplingParamsSchema.optional(),
	instruct: samplingParamsSchema.optional()
})

const providerParamSchema = z.object({
	provider: z.string().min(1)
})

const updateModelConfigSchema = z.object({
	provider: z.string().min(1),
	model: z.string().min(1),
	reasoningEffort: z.string().min(1).nullable().optional()
})

export function registerConfigRoutes(): void {
	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/config/export',
		inputSchema: exportSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'users', action: 'read' },
		handler: async ({ input }) => {
			return await container.exportConfigUseCase.execute({ resources: input.resources as any[] })
		}
	})

	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/config/import',
		inputSchema: importSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'users', action: 'create' },
		handler: async ({ input }) => {
			return await container.importConfigUseCase.execute(input.payload as Record<string, unknown>)
		}
	})

	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/config/providers',
		requiresAuth: true,
		requiredPermission: { resource: 'users', action: 'read' },
		handler: async () => {
			return { success: true, data: await providerAuthService.listProviders() }
		}
	})

	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/config/providers',
		inputSchema: saveApiProviderSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'users', action: 'update' },
		handler: async ({ input }) => {
			return { success: true, data: await providerAuthService.saveApiProvider(input as z.infer<typeof saveApiProviderSchema>) }
		}
	})

	// Parámetros de generación: viven en el provider, no en cada agente
	registry.register({
		useBy: ['server'],
		method: 'PUT',
		path: '/api/config/providers/:provider/sampling',
		inputSchema: updateSamplingSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'users', action: 'update' },
		handler: async ({ input }) => {
			const { provider, ...sampling } = input as z.infer<typeof updateSamplingSchema>
			return { success: true, data: await providerAuthService.updateSampling(provider, sampling) }
		}
	})

	// Modelo y esfuerzo de razonamiento del provider
	registry.register({
		useBy: ['server'],
		method: 'PUT',
		path: '/api/config/providers/:provider/model',
		inputSchema: updateModelConfigSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'users', action: 'update' },
		handler: async ({ input }) => {
			const { provider, ...modelConfig } = input as z.infer<typeof updateModelConfigSchema>
			return { success: true, data: await providerAuthService.updateModelConfig(provider, modelConfig) }
		}
	})

	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/config/providers/:provider/activate',
		inputSchema: providerParamSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'users', action: 'update' },
		handler: async ({ input }) => {
			return { success: true, data: await providerAuthService.setActiveProvider((input as { provider: string }).provider) }
		}
	})

	registry.register({
		useBy: ['server'],
		method: 'DELETE',
		path: '/api/config/providers/:provider',
		inputSchema: providerParamSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'users', action: 'update' },
		handler: async ({ input }) => {
			await providerAuthService.deleteProvider((input as { provider: string }).provider)
			return { success: true }
		}
	})

	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/config/providers/openai',
		requiresAuth: true,
		requiredPermission: { resource: 'users', action: 'read' },
		handler: async () => {
			return { success: true, data: await providerAuthService.getProviderSummary('openai') }
		}
	})

	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/config/providers/openai/models',
		requiresAuth: true,
		requiredPermission: { resource: 'users', action: 'read' },
		handler: async () => {
			return { success: true, data: await codexModelsService.listModels() }
		}
	})

	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/config/providers/openai/start-auth',
		inputSchema: providerStartAuthSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'users', action: 'update' },
		handler: async ({ input }) => {
			return { success: true, data: await providerAuthService.beginOpenAIAuth((input as { returnTo?: string }).returnTo) }
		}
	})

	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/config/providers/openai/refresh',
		requiresAuth: true,
		requiredPermission: { resource: 'users', action: 'update' },
		handler: async () => {
			return { success: true, data: await providerAuthService.refreshOpenAIIfNeeded(true) }
		}
	})

	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/config/providers/openai/callback',
		handler: async ({ context: { req, res } }) => {
			const code = String(req.query.code ?? '')
			const state = String(req.query.state ?? '')

			if (!code || !state) {
				return res.redirect(`${envs.SERVER_URL}/config?provider=openai&auth=error`)
			}

			try {
				const { returnTo } = await providerAuthService.completeOpenAIAuth(code, state)
				const separator = returnTo.includes('?') ? '&' : '?'
				return res.redirect(`${returnTo}${separator}provider=openai&auth=success`)
			} catch (error) {
				const message = error instanceof Error ? error.message : 'openai_auth_failed'
				return res.redirect(`${envs.SERVER_URL}/config?provider=openai&auth=error&message=${encodeURIComponent(message)}`)
			}
		}
	})
}
