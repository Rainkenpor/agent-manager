import type { ConversationRecord } from '@domain/entities/chat.entity.js'
import type { IAgentRepository } from '@domain/repositories/agent.repository.js'
import type { IChatRepository } from '@domain/repositories/chat.repository.js'

export const PUBLIC_CHAT_AGENT_SLUG = 'conocimiento-distelsa'
export const PUBLIC_CHAT_USER_ID = 'public-anonymous'

export class CreatePublicConversationUseCase {
	constructor(
		private readonly chatRepository: IChatRepository,
		private readonly agentRepository: IAgentRepository
	) {}

	async execute(data: { title: string }): Promise<{ success: true; data: ConversationRecord } | { success: false; error: string }> {
		try {
			const agent = await this.agentRepository.findBySlug(PUBLIC_CHAT_AGENT_SLUG)
			if (!agent || !agent.isActive) {
				return { success: false, error: 'El asistente no está disponible en este momento' }
			}

			const conversation = await this.chatRepository.createConversation({
				title: data.title,
				agentId: agent.id,
				userId: PUBLIC_CHAT_USER_ID
			})
			return { success: true, data: conversation }
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Error desconocido'
			return { success: false, error: `Error al crear conversación: ${message}` }
		}
	}
}
