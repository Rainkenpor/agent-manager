import type { IChatRepository } from '@domain/repositories/chat.repository.js'
import type { ConversationRecord } from '@domain/entities/chat.entity.js'

export class ListConversationsUseCase {
	constructor(private readonly chatRepository: IChatRepository) {}

	async execute(
		userId: string,
	): Promise<{ success: true; data: ConversationRecord[] } | { success: false; error: string }> {
		try {
			const convs = await this.chatRepository.findConversationsByUser(userId)
			return { success: true, data: convs }
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Error desconocido'
			return { success: false, error: `Error al listar conversaciones: ${message}` }
		}
	}
}
