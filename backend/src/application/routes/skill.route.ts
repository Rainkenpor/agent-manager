import { registry } from '@applicationService/registry.service.js'
import { container } from '../container.js'
import { z } from 'zod'

const createSkillSchema = z.object({
	name: z.string().min(1),
	slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
	description: z.string().optional(),
	content: z.string().default(''),
})

const updateSkillSchema = z.object({
	id: z.string(),
	name: z.string().min(1).optional(),
	slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
	description: z.string().nullable().optional(),
	content: z.string().optional(),
	isActive: z.boolean().optional(),
})

export function registerSkillRoutes(): void {
	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/skills',
		inputSchema: {},
		requiresAuth: true,
		requiredPermission: { resource: 'skills', action: 'read' },
		handler: async () => {
			return await container.listSkillsUseCase.execute()
		},
	})

	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/skills/:id',
		inputSchema: z.object({ id: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'skills', action: 'read' },
		handler: async ({ input }) => {
			return await container.getSkillUseCase.execute(input.id)
		},
	})

	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/skills',
		inputSchema: createSkillSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'skills', action: 'create' },
		handler: async ({ input }) => {
			return await container.createSkillUseCase.execute(input)
		},
	})

	registry.register({
		useBy: ['server'],
		method: 'PUT',
		path: '/api/skills/:id',
		inputSchema: updateSkillSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'skills', action: 'update' },
		handler: async ({ input }) => {
			return await container.updateSkillUseCase.execute(input)
		},
	})

	registry.register({
		useBy: ['server'],
		method: 'DELETE',
		path: '/api/skills/:id',
		inputSchema: z.object({ id: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'skills', action: 'delete' },
		handler: async ({ input }) => {
			return await container.deleteSkillUseCase.execute(input.id)
		},
	})

	// ── Role ↔ Skill assignment ─────────────────────────────────────────────────

	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/roles/:roleId/skills',
		inputSchema: z.object({ roleId: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'skills', action: 'read' },
		handler: async ({ input }) => {
			const skills = await container.skillRepository.getByRole(input.roleId)
			return { success: true, data: skills }
		},
	})

	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/roles/:roleId/skills/:skillId',
		inputSchema: z.object({ roleId: z.string(), skillId: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'skills', action: 'update' },
		handler: async ({ input }) => {
			await container.skillRepository.assignToRole(input.roleId, input.skillId)
			return { success: true }
		},
	})

	registry.register({
		useBy: ['server'],
		method: 'DELETE',
		path: '/api/roles/:roleId/skills/:skillId',
		inputSchema: z.object({ roleId: z.string(), skillId: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'skills', action: 'update' },
		handler: async ({ input }) => {
			await container.skillRepository.removeFromRole(input.roleId, input.skillId)
			return { success: true }
		},
	})
}
