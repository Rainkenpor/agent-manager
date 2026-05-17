/*
Archivo creado con gobernanza AB900
*/

import { AppDataSource } from '@infra/db/database.js'
import {
	ConversationEntity,
	TraceabilityParticipantStageChatEntity,
	TraceabilityStageEntity
} from '@infra/db/entities.js'
import { v4 as uuidv4 } from 'uuid'
import type { IChatRepository } from '@domain/repositories/chat.repository.js'
import type { ITraceabilityRepository } from '@domain/repositories/traceability.repository.js'
import type { ITraceabilityParticipantRepository } from '@domain/repositories/traceability-participant.repository.js'
import type { IUserRepository } from '@domain/repositories/user.repository.js'

export interface EligibleStage {
	id: string
	name: string
	role: string | null
	agentId: string | null
}

export class OpenOrCreateChatForTraceabilityUseCase {
	constructor(
		private readonly participantRepo: ITraceabilityParticipantRepository,
		private readonly traceabilityRepo: ITraceabilityRepository,
		private readonly chatRepo: IChatRepository,
		private readonly userRepo: IUserRepository
	) {}

	async execute(params: { traceabilityId: string; userId: string; stageId?: string | null }) {
		try {
			const participant = await this.participantRepo.findOne(params.traceabilityId, params.userId)
			if (!participant) {
				return { success: false as const, error: 'No tienes invitación a esta trazabilidad' }
			}

			const traceability = await this.traceabilityRepo.findById(params.traceabilityId)
			if (!traceability) return { success: false as const, error: 'Trazabilidad no encontrada' }
			if (!traceability.chatId) {
				return { success: false as const, error: 'La trazabilidad no tiene un chat origen para inferir el agente' }
			}
			const originChat = await this.chatRepo.findConversationById(traceability.chatId)
			if (!originChat) return { success: false as const, error: 'El chat origen ya no existe' }

			const userRoles = await this.userRepo.getRoles(params.userId)
			const userRoleIds = new Set(userRoles.map((r) => r.id))
			const eligibleStages: EligibleStage[] = (traceability.stages ?? [])
				.filter((s: any) => s.role && userRoleIds.has(s.role))
				.map((s: any) => ({ id: s.id, name: s.name, role: s.role, agentId: s.agentId ?? null }))

			const stageChatRepo = AppDataSource.getRepository(TraceabilityParticipantStageChatEntity)

			if (params.stageId) {
				const stage = eligibleStages.find((s) => s.id === params.stageId)
				if (!stage) return { success: false as const, error: 'El stage seleccionado no está disponible para tu rol' }
				return await this.openOrCreateForStage({
					traceabilityId: params.traceabilityId,
					userId: params.userId,
					stage,
					traceabilityTitle: traceability.title,
					originAgentId: originChat.agentId
				})
			}

			if (eligibleStages.length === 0) {
				// fallback: open or create a single chat tied to the participant (no stage)
				if (participant.chatId) {
					const existing = await this.chatRepo.findConversationById(participant.chatId)
					if (existing) return { success: true as const, data: existing }
				}
				const newConversation = await this.chatRepo.createConversation({
					title: traceability.title,
					agentId: originChat.agentId,
					userId: params.userId
				})
				await this.participantRepo.setChatId(participant.id, newConversation.id)
				const withMessages = await this.chatRepo.findConversationById(newConversation.id)
				return { success: true as const, data: withMessages ?? newConversation }
			}

			if (eligibleStages.length === 1) {
				return await this.openOrCreateForStage({
					traceabilityId: params.traceabilityId,
					userId: params.userId,
					stage: eligibleStages[0],
					traceabilityTitle: traceability.title,
					originAgentId: originChat.agentId
				})
			}

			// Multiple — caller must choose. Include existing stage chats so frontend can mark them.
			const existing = await stageChatRepo.findBy({ traceabilityId: params.traceabilityId, userId: params.userId })
			const openedStageIds = new Set(existing.map((e) => e.stageId))
			return {
				success: true as const,
				requireStageSelection: true,
				stages: eligibleStages.map((s) => ({ ...s, hasChat: openedStageIds.has(s.id) }))
			}
		} catch (error) {
			return { success: false as const, error: error instanceof Error ? error.message : 'Error desconocido' }
		}
	}

	private async openOrCreateForStage(params: {
		traceabilityId: string
		userId: string
		stage: EligibleStage
		traceabilityTitle: string
		originAgentId: string
	}) {
		const stageChatRepo = AppDataSource.getRepository(TraceabilityParticipantStageChatEntity)
		const existingRow = await stageChatRepo.findOneBy({
			traceabilityId: params.traceabilityId,
			userId: params.userId,
			stageId: params.stage.id
		})
		if (existingRow) {
			const existing = await this.chatRepo.findConversationById(existingRow.chatId)
			if (existing) {
				const desiredAgentId = params.stage.agentId ?? params.originAgentId
				if (existing.agentId !== desiredAgentId) {
					const convRepo = AppDataSource.getRepository(ConversationEntity)
					await convRepo.update(existing.id, { agentId: desiredAgentId, updatedAt: new Date().toISOString() })
					existing.agentId = desiredAgentId
				}
				await this.maybeAutoAssign(params.stage.id, params.userId)
				return { success: true as const, data: existing, stageId: params.stage.id }
			}
			// chat disappeared; drop the stale row and recreate
			await stageChatRepo.delete(existingRow.id)
		}

		const newConversation = await this.chatRepo.createConversation({
			title: `${params.traceabilityTitle} — ${params.stage.name}`,
			agentId: params.stage.agentId ?? params.originAgentId,
			userId: params.userId
		})

		await stageChatRepo.save(
			stageChatRepo.create({
				id: uuidv4(),
				traceabilityId: params.traceabilityId,
				userId: params.userId,
				stageId: params.stage.id,
				chatId: newConversation.id,
				createdAt: new Date().toISOString()
			})
		)

		await this.maybeAutoAssign(params.stage.id, params.userId)

		const withMessages = await this.chatRepo.findConversationById(newConversation.id)
		return { success: true as const, data: withMessages ?? newConversation, stageId: params.stage.id }
	}

	private async maybeAutoAssign(stageId: string, userId: string) {
		try {
			const stageRepo = AppDataSource.getRepository(TraceabilityStageEntity)
			const stage = await stageRepo.findOneBy({ id: stageId })
			if (stage && !stage.assignedUserId) {
				await this.traceabilityRepo.assignUserToStage(stageId, userId)
			}
		} catch {
			// non-fatal: assignment is opportunistic
		}
	}
}
