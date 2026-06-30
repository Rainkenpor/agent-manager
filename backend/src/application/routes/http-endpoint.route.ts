import { registry } from '@applicationService/registry.service.js'
import { CreateHttpEndpointSchema, UpdateHttpEndpointSchema } from '@domain/entities/http-endpoint.entity.js'
import { getNextCronRun } from '@infra/service/cron-parser.js'
import { z } from 'zod'
import { container } from '../container.js'

function validateSchedule(schedule: string | undefined): void {
	if (!schedule?.trim()) return
	getNextCronRun(schedule.trim()) // throws on invalid expression → mapped to HTTP 400
}

export function registerHttpEndpointRoutes(): void {
	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/http-endpoints',
		inputSchema: {},
		requiresAuth: true,
		requiredPermission: { resource: 'http_endpoints', action: 'read' },
		handler: async () => {
			const endpoints = await container.httpEndpointRepository.findAll()
			return { success: true, data: endpoints }
		}
	})

	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/http-endpoints/:id',
		inputSchema: z.object({ id: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'http_endpoints', action: 'read' },
		handler: async ({ input, context: { res } }) => {
			const endpoint = await container.httpEndpointRepository.findById(input.id)
			if (!endpoint) return res.status(404).json({ error: 'Endpoint not found' })
			return { success: true, data: endpoint }
		}
	})

	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/http-endpoints',
		inputSchema: CreateHttpEndpointSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'http_endpoints', action: 'create' },
		handler: async ({ input, context: { res } }) => {
			try {
				const existing = await container.httpEndpointRepository.findByName(input.name)
				if (existing) return res.status(400).json({ error: `Endpoint "${input.name}" already exists` })
				validateSchedule(input.schedule)
				const endpoint = await container.httpEndpointRepository.create(input)
				container.httpEndpointExecutor.scheduleEndpoint(endpoint)
				return res.status(201).json({ success: true, data: endpoint })
			} catch (error: any) {
				return res.status(400).json({ error: error.message })
			}
		}
	})

	registry.register({
		useBy: ['server'],
		method: 'PUT',
		path: '/api/http-endpoints/:id',
		inputSchema: { ...UpdateHttpEndpointSchema.shape, id: z.string() },
		requiresAuth: true,
		requiredPermission: { resource: 'http_endpoints', action: 'update' },
		handler: async ({ context: { req, res } }) => {
			try {
				validateSchedule(req.body.schedule)
				const endpoint = await container.httpEndpointRepository.update(req.params.id as string, req.body)
				container.httpEndpointExecutor.scheduleEndpoint(endpoint)
				return { success: true, data: endpoint }
			} catch (error: any) {
				return res.status(400).json({ error: error.message })
			}
		}
	})

	registry.register({
		useBy: ['server'],
		method: 'DELETE',
		path: '/api/http-endpoints/:id',
		inputSchema: z.object({ id: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'http_endpoints', action: 'delete' },
		handler: async ({ input, context: { res } }) => {
			try {
				container.httpEndpointExecutor.cancelEndpoint(input.id)
				await container.httpEndpointRepository.delete(input.id)
				return { success: true, message: 'Endpoint deleted' }
			} catch (error: any) {
				return res.status(400).json({ error: error.message })
			}
		}
	})

	// Manual execution: calls the endpoint now and returns the response.
	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/http-endpoints/:id/execute',
		inputSchema: z.object({ id: z.string(), overrideBody: z.string().optional() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'http_endpoints', action: 'update' },
		handler: async ({ input, context: { res } }) => {
			const endpoint = await container.httpEndpointRepository.findById(input.id)
			if (!endpoint) return res.status(404).json({ error: 'Endpoint not found' })
			const result = await container.httpEndpointExecutor.execute(endpoint, input.overrideBody)
			return { success: true, data: result }
		}
	})
}
