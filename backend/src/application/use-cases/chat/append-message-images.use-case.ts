import type { PersistedImage } from '@domain/entities/chat.entity.js'
import type { IChatRepository } from '@domain/repositories/chat.repository.js'

export class AppendMessageImagesUseCase {
	constructor(private readonly chatRepository: IChatRepository) {}

	async execute(
		messageId: string,
		userId: string,
		images: PersistedImage[]
	): Promise<{ success: true } | { success: false; error: string }> {
		try {
			if (!images.length) return { success: true }

			const message = await this.chatRepository.findMessageById(messageId)
			if (!message) return { success: false, error: 'Mensaje no encontrado' }

			const conv = await this.chatRepository.findConversationById(message.conversationId)
			if (!conv || conv.userId !== userId) return { success: false, error: 'Conversación no encontrada' }

			await this.chatRepository.appendMessageImages(messageId, images)
			return { success: true }
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Error desconocido'
			return { success: false, error: `Error al adjuntar imágenes: ${message}` }
		}
	}
}
