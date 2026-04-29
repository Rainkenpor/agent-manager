import { registry } from '@applicationService/registry.service.js'
import { container } from '../container.js'
import { z } from 'zod'
import { providerAuthService } from '@infra/service/provider-auth.service.js'
import { envs } from '../../envs.js'

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
		path: '/api/config/providers/openai',
		requiresAuth: true,
		requiredPermission: { resource: 'users', action: 'read' },
		handler: async () => {
			return { success: true, data: await providerAuthService.getProviderSummary('openai') }
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
		method: 'DELETE',
		path: '/api/config/providers/openai',
		requiresAuth: true,
		requiredPermission: { resource: 'users', action: 'update' },
		handler: async () => {
			await providerAuthService.deleteProvider('openai')
			return { success: true }
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
