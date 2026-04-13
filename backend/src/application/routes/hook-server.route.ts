import { z } from 'zod'
import { registry } from '@applicationService/registry.service.js'
import { CreateHookServerSchema, UpdateHookServerSchema, CreateHookAssignmentSchema } from '@domain/entities/hook-server.entity.js'
import { container } from '../container.js'

export function registerHookServerRoutes(): void {
	// ── CRUD ──────────────────────────────────────────────────────────────────────

	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/hook-servers',
		inputSchema: {},
		requiresAuth: true,
		requiredPermission: { resource: 'hook_servers', action: 'read' },
		handler: async () => {
			const servers = await container.hookServerRepository.findAll()
			return { success: true, data: servers }
		}
	})

	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/hook-servers/:id',
		inputSchema: z.object({ id: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'hook_servers', action: 'read' },
		handler: async ({ input, context: { res } }) => {
			const server = await container.hookServerRepository.findById(input.id)
			if (!server) return res.status(404).json({ error: 'Hook server not found' })
			return { success: true, data: server }
		}
	})

	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/hook-servers',
		inputSchema: CreateHookServerSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'hook_servers', action: 'create' },
		handler: async ({ context: { req, res } }) => {
			try {
				const server = await container.hookServerRepository.create(req.body)
				if (server.active) {
					container.hookDispatcher.subscribeToServer(server)
				}
				return res.status(201).json({ success: true, data: server })
			} catch (error: any) {
				return res.status(400).json({ error: error.message })
			}
		}
	})

	registry.register({
		useBy: ['server'],
		method: 'PUT',
		path: '/api/hook-servers/:id',
		inputSchema: { ...UpdateHookServerSchema.shape, id: z.string() },
		requiresAuth: true,
		requiredPermission: { resource: 'hook_servers', action: 'update' },
		handler: async ({ context: { req, res } }) => {
			try {
				const server = await container.hookServerRepository.update(req.params.id as string, req.body)
				if (server.active) {
					container.hookDispatcher.subscribeToServer(server)
				} else {
					container.hookDispatcher.unsubscribeFromServer(server.id)
				}
				return { success: true, data: server }
			} catch (error: any) {
				return res.status(400).json({ error: error.message })
			}
		}
	})

	registry.register({
		useBy: ['server'],
		method: 'DELETE',
		path: '/api/hook-servers/:id',
		inputSchema: z.object({ id: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'hook_servers', action: 'delete' },
		handler: async ({ input, context: { res } }) => {
			try {
				container.hookDispatcher.unsubscribeFromServer(input.id)
				await container.hookServerRepository.delete(input.id)
				return { success: true, message: 'Hook server deleted' }
			} catch (error: any) {
				return res.status(400).json({ error: error.message })
			}
		}
	})

	// ── Hook Discovery ────────────────────────────────────────────────────────────

	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/hook-servers/:id/hooks',
		inputSchema: z.object({ id: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'hook_servers', action: 'read' },
		handler: async ({ input, context: { res } }) => {
			const server = await container.hookServerRepository.findById(input.id)
			if (!server) return res.status(404).json({ error: 'Hook server not found' })

			try {
				const response = await fetch(server.url.replace(/\/$/, '') + '/hooks', {
					headers: { Accept: 'application/json' }
				})
				if (!response.ok) {
					return res.status(502).json({ error: `Hook server returned ${response.status}` })
				}
				const hooks = await response.json()
				return { success: true, data: hooks }
			} catch (error: any) {
				return res.status(502).json({ error: `Could not reach hook server: ${error.message}` })
			}
		}
	})

	// ── Assignments ───────────────────────────────────────────────────────────────

	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/hook-servers/:id/assignments',
		inputSchema: z.object({ id: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'hook_servers', action: 'read' },
		handler: async ({ input }) => {
			const assignments = await container.hookServerRepository.getAssignments(input.id)
			return { success: true, data: assignments }
		}
	})

	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/hook-servers/:id/assignments',
		inputSchema: { ...CreateHookAssignmentSchema.shape, id: z.string() },
		requiresAuth: true,
		requiredPermission: { resource: 'hook_servers', action: 'update' },
		handler: async ({ context: { req, res } }) => {
			try {
				const assignment = await container.hookServerRepository.createAssignment({
					...req.body,
					hookServerId: req.params.id as string
				})
				return res.status(201).json({ success: true, data: assignment })
			} catch (error: any) {
				return res.status(400).json({ error: error.message })
			}
		}
	})

	registry.register({
		useBy: ['server'],
		method: 'DELETE',
		path: '/api/hook-servers/:id/assignments/:assignmentId',
		inputSchema: z.object({ id: z.string(), assignmentId: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'hook_servers', action: 'update' },
		handler: async ({ input, context: { res } }) => {
			try {
				await container.hookServerRepository.deleteAssignment(input.assignmentId)
				return { success: true, message: 'Assignment removed' }
			} catch (error: any) {
				return res.status(400).json({ error: error.message })
			}
		}
	})
}
