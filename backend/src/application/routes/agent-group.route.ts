/*
Archivo creado con gobernanza AB900
*/

import { registry } from '@applicationService/registry.service.js'
import { z } from 'zod'
import { container } from '../container.js'

const createGroupSchema = z.object({
	name: z.string().min(1),
	slug: z
		.string()
		.min(1)
		.regex(/^[a-z0-9-]+$/),
	description: z.string().nullable().optional(),
	icon: z.string().nullable().optional(),
	color: z.string().nullable().optional()
})

const updateGroupSchema = z.object({
	id: z.string(),
	name: z.string().min(1).optional(),
	slug: z
		.string()
		.min(1)
		.regex(/^[a-z0-9-]+$/)
		.optional(),
	description: z.string().nullable().optional(),
	icon: z.string().nullable().optional(),
	color: z.string().nullable().optional()
})

export function registerAgentGroupRoutes(): void {
	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/agent-groups',
		inputSchema: {},
		requiresAuth: true,
		requiredPermission: { resource: 'agents', action: 'read' },
		handler: async () => container.listAgentGroupsUseCase.execute()
	})

	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/agent-groups',
		inputSchema: createGroupSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'agents', action: 'create' },
		handler: async ({ input }) => container.createAgentGroupUseCase.execute(input)
	})

	registry.register({
		useBy: ['server'],
		method: 'PUT',
		path: '/api/agent-groups/:id',
		inputSchema: updateGroupSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'agents', action: 'update' },
		handler: async ({ input }) => container.updateAgentGroupUseCase.execute(input)
	})

	registry.register({
		useBy: ['server'],
		method: 'DELETE',
		path: '/api/agent-groups/:id',
		inputSchema: z.object({ id: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'agents', action: 'delete' },
		handler: async ({ input }) => container.deleteAgentGroupUseCase.execute(input.id)
	})
}
