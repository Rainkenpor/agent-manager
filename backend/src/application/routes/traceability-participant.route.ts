/*
Archivo creado con gobernanza AB900
*/

import { registry } from '@applicationService/registry.service.js'
import { AppDataSource } from '@infra/db/database.js'
import { ConversationEntity, TraceabilityEntity, TraceabilityParticipantEntity } from '@infra/db/entities.js'
import { In } from 'typeorm'
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

	// Group info (traceabilityId + participants) for each chat the user can see
	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/chat/traceability-groups',
		inputSchema: {},
		requiresAuth: true,
		requiredPermission: { resource: 'chat', action: 'read' },
		handler: async ({ context: { req } }) => {
			const userId = (req as any).user?.id
			try {
				const convRepo = AppDataSource.getRepository(ConversationEntity)
				const tracRepo = AppDataSource.getRepository(TraceabilityEntity)
				const partRepo = AppDataSource.getRepository(TraceabilityParticipantEntity)

				const myConvs = await convRepo.findBy({ userId })
				if (myConvs.length === 0) return { success: true as const, data: {} }
				const myConvIds = myConvs.map((c) => c.id)

				const [ownedTracs, myPartRows] = await Promise.all([
					tracRepo.findBy({ chatId: In(myConvIds) }),
					partRepo.findBy({ chatId: In(myConvIds) })
				])

				const tracIds = new Set<string>([
					...ownedTracs.map((t) => t.id),
					...myPartRows.map((p) => p.traceabilityId)
				])
				if (tracIds.size === 0) return { success: true as const, data: {} }

				const idsArr = [...tracIds]
				const [allTracs, allParts] = await Promise.all([
					tracRepo.findBy({ id: In(idsArr) }),
					partRepo.findBy({ traceabilityId: In(idsArr) })
				])
				const tracById = new Map(allTracs.map((t) => [t.id, t]))
				const partsByTrac = new Map<string, TraceabilityParticipantEntity[]>()
				for (const p of allParts) {
					const list = partsByTrac.get(p.traceabilityId) ?? []
					list.push(p)
					partsByTrac.set(p.traceabilityId, list)
				}

				const result: Record<string, {
					traceabilityId: string
					title: string
					ownerUserId: string | null
					participants: Array<{ userId: string; chatId: string | null }>
				}> = {}

				for (const t of allTracs) {
					const parts = partsByTrac.get(t.id) ?? []
					const groupInfo = {
						traceabilityId: t.id,
						title: t.title,
						ownerUserId: t.createdBy,
						participants: parts.map((p) => ({ userId: p.userId, chatId: p.chatId ?? null }))
					}
					if (t.chatId && myConvIds.includes(t.chatId)) result[t.chatId] = groupInfo
					for (const p of parts) {
						if (p.chatId && myConvIds.includes(p.chatId)) result[p.chatId] = groupInfo
					}
				}

				return { success: true as const, data: result }
			} catch (error) {
				return { success: false as const, error: error instanceof Error ? error.message : 'Error desconocido' }
			}
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
