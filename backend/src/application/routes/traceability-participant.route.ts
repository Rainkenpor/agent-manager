/*
Archivo creado con gobernanza AB900
*/

import { registry } from '@applicationService/registry.service.js'
import { z } from 'zod'
import { container } from '../container.js'

const shareSchema = z.object({
	id: z.string(),
	userId: z.string().min(1)
})

const removeShareSchema = z.object({
	id: z.string(),
	userId: z.string()
})

const openInvitationSchema = z.object({
	traceabilityId: z.string()
})

export function registerTraceabilityParticipantRoutes(): void {
	// List participants of a traceability
	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/traceability/:id/participants',
		inputSchema: z.object({ id: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'traceability', action: 'read' },
		handler: async ({ input }) => {
			return await container.listTraceabilityParticipantsUseCase.execute(input.id)
		}
	})

	// Share a traceability with a user
	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/traceability/:id/participants',
		inputSchema: shareSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'traceability', action: 'update' },
		handler: async ({ input, context: { req } }) => {
			const invitedBy = (req as any).user?.id
			return await container.shareTraceabilityUseCase.execute({
				traceabilityId: input.id,
				userId: input.userId,
				invitedBy
			})
		}
	})

	// Remove a share
	registry.register({
		useBy: ['server'],
		method: 'DELETE',
		path: '/api/traceability/:id/participants/:userId',
		inputSchema: removeShareSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'traceability', action: 'update' },
		handler: async ({ input }) => {
			return await container.removeTraceabilityShareUseCase.execute(input.id, input.userId)
		}
	})

	// List invitations for the current user
	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/chat/traceability-invitations',
		inputSchema: {},
		requiresAuth: true,
		requiredPermission: { resource: 'chat', action: 'read' },
		handler: async ({ context: { req } }) => {
			const userId = (req as any).user?.id
			return await container.listMyTraceabilityInvitationsUseCase.execute(userId)
		}
	})

	// Open or create the current user's chat for a traceability invitation
	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/chat/traceability-invitations/:traceabilityId/open',
		inputSchema: openInvitationSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'chat', action: 'create' },
		handler: async ({ input, context: { req } }) => {
			const userId = (req as any).user?.id
			return await container.openOrCreateChatForTraceabilityUseCase.execute({
				traceabilityId: input.traceabilityId,
				userId
			})
		}
	})
}
