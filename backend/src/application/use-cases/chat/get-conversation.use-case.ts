import type { IChatRepository } from '@domain/repositories/chat.repository.js'
import type { ConversationWithMessages } from '@domain/entities/chat.entity.js'

export class GetConversationUseCase {
	constructor(private readonly chatRepository: IChatRepository) {}

	async execute(
		id: string,
	): Promise<{ success: true; data: ConversationWithMessages } | { success: false; error: string }> {
		try {
			const conv = await this.chatRepository.findConversationById(id)
			if (!conv) return { success: false, error: 'Conversación no encontrada' }
			return { success: true, data: conv }
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Error desconocido'
			return { success: false, error: `Error al obtener conversación: ${message}` }
		}
	}
}
