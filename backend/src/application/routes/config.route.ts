import { registry } from '@applicationService/registry.service.js'
import { container } from '../container.js'
import { z } from 'zod'

const ExportResourceEnum = z.enum(['agents', 'skills', 'mcps', 'traceabilities', 'roles', 'users'])

const exportSchema = z.object({
	resources: z.array(ExportResourceEnum).min(1)
})

const importSchema = z.object({
	payload: z.record(z.string(), z.unknown())
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
}
