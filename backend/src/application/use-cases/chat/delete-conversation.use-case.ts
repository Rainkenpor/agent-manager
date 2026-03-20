import type { IChatRepository } from '@domain/repositories/chat.repository.js'

export class DeleteConversationUseCase {
	constructor(private readonly chatRepository: IChatRepository) {}

	async execute(id: string): Promise<{ success: true } | { success: false; error: string }> {
		try {
			const conv = await this.chatRepository.findConversationById(id)
			if (!conv) return { success: false, error: 'Conversación no encontrada' }
			await this.chatRepository.deleteConversation(id)
			return { success: true }
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Error desconocido'
			return { success: false, error: `Error al eliminar conversación: ${message}` }
		}
	}
}
