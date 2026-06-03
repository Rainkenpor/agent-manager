import { registry } from '@applicationService/registry.service.js'
import { container } from '../container.js'

export function registerSystemRoutes(): void {
	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/system/metrics',
		inputSchema: {},
		requiresAuth: true,
		requiredPermission: { resource: 'system_metrics', action: 'read' },
		handler: async () => container.getSystemMetricsUseCase.execute()
	})
}
