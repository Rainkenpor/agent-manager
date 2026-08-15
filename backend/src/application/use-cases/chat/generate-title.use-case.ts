import type { IChatRepository } from '@domain/repositories/chat.repository.js'
import { AgentService } from '@infra/service/agent.service.js'
import { agentLogger } from '@infra/service/logger.service.js'

const TITLE_PROMPT = `Nombras conversaciones. Devuelve únicamente un título de máximo 50 caracteres que resuma el tema.
Sin comillas, sin punto final, sin prefijos como "Título:". Usa el mismo idioma del mensaje del usuario.`

/** Los chats nacen sin nombre: tras el primer intercambio se les genera uno a partir de su contenido. */
export class GenerateTitleUseCase {
	constructor(private readonly chatRepository: IChatRepository) {}

	async execute(conversationId: string, userMessage: string, assistantMessage: string, userId?: string): Promise<string | null> {
		try {
			const raw = await new AgentService().executeAgent({
				systemPrompt: TITLE_PROMPT,
				agentSlug: 'chat-title',
				query: `Mensaje del usuario:\n${userMessage.slice(0, 2000)}\n\nRespuesta:\n${assistantMessage.slice(0, 2000)}`,
				allowedTools: new Set(),
				userId,
				auditSourceType: 'chat'
			})

			const title = String(raw ?? '')
				.replace(/["'`]/g, '')
				.trim()
				.split('\n')[0]
				.slice(0, 50)
				.trim()

			if (!title) return null

			await this.chatRepository.updateTitle(conversationId, title)
			return title
		} catch (error) {
			agentLogger.error(
				`[Chat] No se pudo generar el título de ${conversationId}: ${error instanceof Error ? error.message : String(error)}`
			)
			return null
		}
	}
}
