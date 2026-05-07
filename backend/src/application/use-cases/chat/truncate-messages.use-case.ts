import type { IChatRepository } from '@domain/repositories/chat.repository.js'

export class TruncateMessagesUseCase {
	constructor(private readonly chatRepository: IChatRepository) {}

	async execute(conversationId: string, fromMessageId: string): Promise<{ success: true } | { success: false; error: string }> {
		try {
			const conv = await this.chatRepository.findConversationById(conversationId)
			if (!conv) return { success: false, error: 'Conversación no encontrada' }
			await this.chatRepository.deleteMessagesFrom(conversationId, fromMessageId)
			return { success: true }
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Error desconocido'
			return { success: false, error: `Error al truncar mensajes: ${message}` }
		}
	}
}
