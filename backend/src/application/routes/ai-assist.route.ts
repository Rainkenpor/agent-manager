import { registry } from '@applicationService/registry.service.js'
import { container } from '../container.js'
import { z } from 'zod'

const inputSchema = z.object({
	content: z.string().default(''),
	request: z.string().min(1),
	systemPrompt: z.string().optional()
})

export function registerAiAssistRoutes(): void {
	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/ai-assist/stream',
		inputSchema: inputSchema.shape,
		requiresAuth: true,
		handler: async ({ input, context: { res, signal } }) => {
			res.setHeader('Content-Type', 'text/event-stream')
			res.setHeader('Cache-Control', 'no-cache')
			res.setHeader('Connection', 'keep-alive')
			res.setHeader('X-Accel-Buffering', 'no')
			res.flushHeaders()

			const sendEvent = (data: Record<string, unknown>) => {
				res.write(`data: ${JSON.stringify(data)}\n\n`)
			}

			await container.streamAiAssistUseCase.execute(
				{ content: input.content, request: input.request, systemPrompt: input.systemPrompt },
				sendEvent,
				signal
			)

			res.end()
			return null
		}
	})
}
