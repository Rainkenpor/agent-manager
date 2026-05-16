/*
Archivo creado con gobernanza AB900
*/

import type { IChatRepository } from '@domain/repositories/chat.repository.js'
import type { ITraceabilityRepository } from '@domain/repositories/traceability.repository.js'
import type { ITraceabilityParticipantRepository } from '@domain/repositories/traceability-participant.repository.js'

export class OpenOrCreateChatForTraceabilityUseCase {
	constructor(
		private readonly participantRepo: ITraceabilityParticipantRepository,
		private readonly traceabilityRepo: ITraceabilityRepository,
		private readonly chatRepo: IChatRepository
	) {}

	async execute(params: { traceabilityId: string; userId: string }) {
		try {
			const participant = await this.participantRepo.findOne(params.traceabilityId, params.userId)
			if (!participant) {
				return { success: false as const, error: 'No tienes invitación a esta trazabilidad' }
			}

			if (participant.chatId) {
				const existing = await this.chatRepo.findConversationById(participant.chatId)
				if (existing) return { success: true as const, data: existing }
			}

			const traceability = await this.traceabilityRepo.findById(params.traceabilityId)
			if (!traceability) return { success: false as const, error: 'Trazabilidad no encontrada' }

			if (!traceability.chatId) {
				return { success: false as const, error: 'La trazabilidad no tiene un chat origen para inferir el agente' }
			}

			const originChat = await this.chatRepo.findConversationById(traceability.chatId)
			if (!originChat) {
				return { success: false as const, error: 'El chat origen ya no existe' }
			}

			const newConversation = await this.chatRepo.createConversation({
				title: traceability.title,
				agentId: originChat.agentId,
				userId: params.userId
			})

			await this.participantRepo.setChatId(participant.id, newConversation.id)

			const withMessages = await this.chatRepo.findConversationById(newConversation.id)
			return { success: true as const, data: withMessages ?? newConversation }
		} catch (error) {
			return { success: false as const, error: error instanceof Error ? error.message : 'Error desconocido' }
		}
	}
}
