import { registry } from '@applicationService/registry.service.js'
import { container } from '../container.js'

export function registerLogsRoutes(): void {
	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/logs/stream',
		inputSchema: {},
		requiresAuth: true,
		requiredPermission: { resource: 'agents', action: 'read' },
		handler: async ({ context: { req, res } }) => {
			res.setHeader('Content-Type', 'text/event-stream')
			res.setHeader('Cache-Control', 'no-cache')
			res.setHeader('Connection', 'keep-alive')
			res.setHeader('X-Accel-Buffering', 'no')
			res.flushHeaders()

			const sendEvent = (data: Record<string, unknown>) => {
				try {
					res.write(`data: ${JSON.stringify(data)}\n\n`)
				} catch { /* cliente desconectado */ }
			}

			const stop = container.streamAgentLogsUseCase.execute(sendEvent)

			req.on('close', stop)
			req.on('error', stop)

			return null
		},
	})
}
