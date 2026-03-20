import type { IChatRepository } from '@domain/repositories/chat.repository.js'
import type { ConversationRecord, CreateConversationDTO } from '@domain/entities/chat.entity.js'

export class CreateConversationUseCase {
	constructor(private readonly chatRepository: IChatRepository) {}

	async execute(
		data: CreateConversationDTO,
	): Promise<{ success: true; data: ConversationRecord } | { success: false; error: string }> {
		try {
			const conversation = await this.chatRepository.createConversation(data)
			return { success: true, data: conversation }
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Error desconocido'
			return { success: false, error: `Error al crear conversación: ${message}` }
		}
	}
}
