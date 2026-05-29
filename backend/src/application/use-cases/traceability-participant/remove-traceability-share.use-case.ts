/*
Archivo creado con gobernanza AB900
*/

import type { IChatRepository } from '@domain/repositories/chat.repository.js'
import type { ITraceabilityParticipantRepository } from '@domain/repositories/traceability-participant.repository.js'
import { AppDataSource } from '@infra/db/database.js'
import { MessageEntity, TraceabilityParticipantStageChatEntity } from '@infra/db/entities.js'
import { In } from 'typeorm'

export class RemoveTraceabilityShareUseCase {
	constructor(
		private readonly participantRepo: ITraceabilityParticipantRepository,
		private readonly chatRepo: IChatRepository
	) {}

	async execute(traceabilityId: string, userId: string) {
		try {
			const participant = await this.participantRepo.findOne(traceabilityId, userId)

			const stageChatRepo = AppDataSource.getRepository(TraceabilityParticipantStageChatEntity)
			const stageChatRows = await stageChatRepo.findBy({ traceabilityId, userId })
			const chatIds = stageChatRows.map((r) => r.chatId)
			if (participant?.chatId) chatIds.push(participant.chatId)

			if (stageChatRows.length > 0) {
				await stageChatRepo.delete(stageChatRows.map((r) => r.id))
			}

			await this.participantRepo.removeByUser(traceabilityId, userId)

			if (chatIds.length > 0) {
				const msgRepo = AppDataSource.getRepository(MessageEntity)
				await msgRepo.delete({ conversationId: In(chatIds) })
				for (const chatId of chatIds) {
					await this.chatRepo.deleteConversation(chatId)
				}
			}

			return { success: true as const, data: { traceabilityId, userId, deletedChats: chatIds.length } }
		} catch (error) {
			return { success: false as const, error: error instanceof Error ? error.message : 'Error desconocido' }
		}
	}
}
