/*
Archivo creado con gobernanza AB900
*/

import { registry } from '@applicationService/registry.service.js'
import { AppDataSource } from '@infra/db/database.js'
import {
	ConversationEntity,
	TraceabilityEntity,
	TraceabilityParticipantEntity,
	TraceabilityParticipantStageChatEntity,
	TraceabilityStageEntity,
	UserRoleEntity
} from '@infra/db/entities.js'
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
	traceabilityId: z.string(),
	stageId: z.string().nullable().optional()
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
				const stageChatRepo = AppDataSource.getRepository(TraceabilityParticipantStageChatEntity)
				const stageRepo = AppDataSource.getRepository(TraceabilityStageEntity)
				const userRoleRepo = AppDataSource.getRepository(UserRoleEntity)

				const myConvs = await convRepo.findBy({ userId })
				if (myConvs.length === 0) return { success: true as const, data: {} }
				const myConvIds = myConvs.map((c) => c.id)

				const [ownedTracs, myPartRows, myStageChatRows] = await Promise.all([
					tracRepo.findBy({ chatId: In(myConvIds) }),
					partRepo.findBy({ chatId: In(myConvIds) }),
					stageChatRepo.findBy({ chatId: In(myConvIds) })
				])

				const tracIds = new Set<string>([
					...ownedTracs.map((t) => t.id),
					...myPartRows.map((p) => p.traceabilityId),
					...myStageChatRows.map((s) => s.traceabilityId)
				])
				if (tracIds.size === 0) return { success: true as const, data: {} }

				const idsArr = [...tracIds]
				const [allTracs, allParts, allStages, allStageChats, myRoles] = await Promise.all([
					tracRepo.findBy({ id: In(idsArr) }),
					partRepo.findBy({ traceabilityId: In(idsArr) }),
					stageRepo.findBy({ traceabilityId: In(idsArr) }),
					stageChatRepo.findBy({ traceabilityId: In(idsArr) }),
					userRoleRepo.findBy({ userId })
				])
				const myRoleIds = new Set(myRoles.map((r) => r.roleId))

				const partsByTrac = new Map<string, TraceabilityParticipantEntity[]>()
				for (const p of allParts) {
					const list = partsByTrac.get(p.traceabilityId) ?? []
					list.push(p)
					partsByTrac.set(p.traceabilityId, list)
				}

				const stagesByTrac = new Map<string, TraceabilityStageEntity[]>()
				for (const s of allStages) {
					const list = stagesByTrac.get(s.traceabilityId) ?? []
					list.push(s)
					stagesByTrac.set(s.traceabilityId, list)
				}

				const stageChatsByTrac = new Map<string, TraceabilityParticipantStageChatEntity[]>()
				for (const sc of allStageChats) {
					const list = stageChatsByTrac.get(sc.traceabilityId) ?? []
					list.push(sc)
					stageChatsByTrac.set(sc.traceabilityId, list)
				}

				const stageById = new Map(allStages.map((s) => [s.id, s]))

				interface StageOption {
					stageId: string
					stageName: string
					chatId: string | null
				}

				const result: Record<string, {
					traceabilityId: string
					title: string
					ownerUserId: string | null
					participants: Array<{ userId: string; chatId: string | null }>
					stageId: string | null
					stageName: string | null
					myEligibleStages: StageOption[]
				}> = {}

				for (const t of allTracs) {
					const parts = partsByTrac.get(t.id) ?? []
					const myStageChats = (stageChatsByTrac.get(t.id) ?? []).filter((sc) => sc.userId === userId)
					const isOwner = t.createdBy === userId

					// Eligible stages: owner sees nothing (their chat is the origin chat), participants see all their role matches
					const stages = stagesByTrac.get(t.id) ?? []
					const eligible = isOwner
						? []
						: stages.filter((s) => s.role && myRoleIds.has(s.role))
					const chatByStageId = new Map(myStageChats.map((sc) => [sc.stageId, sc.chatId]))
					const myEligibleStages: StageOption[] = eligible.map((s) => ({
						stageId: s.id,
						stageName: s.name,
						chatId: chatByStageId.get(s.id) ?? null
					}))

					const baseInfo = {
						traceabilityId: t.id,
						title: t.title,
						ownerUserId: t.createdBy,
						participants: parts.map((p) => ({ userId: p.userId, chatId: p.chatId ?? null })),
						myEligibleStages
					}

					if (t.chatId && myConvIds.includes(t.chatId)) {
						result[t.chatId] = { ...baseInfo, stageId: null, stageName: null }
					}
					for (const p of parts) {
						if (p.chatId && myConvIds.includes(p.chatId)) {
							result[p.chatId] = { ...baseInfo, stageId: null, stageName: null }
						}
					}
					for (const sc of myStageChats) {
						if (myConvIds.includes(sc.chatId)) {
							const stage = stageById.get(sc.stageId)
							result[sc.chatId] = {
								...baseInfo,
								stageId: sc.stageId,
								stageName: stage?.name ?? null
							}
						}
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
				userId,
				stageId: input.stageId ?? null
			})
		}
	})
}
