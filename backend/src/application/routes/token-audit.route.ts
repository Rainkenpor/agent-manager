import { registry } from '@applicationService/registry.service.js'
import { container } from '../container.js'

export function registerTokenAuditRoutes(): void {
	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/token-audit/metrics',
		inputSchema: {},
		requiresAuth: true,
		requiredPermission: { resource: 'llm_tokens', action: 'read' },
		handler: async () => container.getTokenMetricsUseCase.execute(),
	})
}
