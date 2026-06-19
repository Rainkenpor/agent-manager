import type { ConversationRecord } from '@domain/entities/chat.entity.js'
import { isIntegrationConfigured } from '@domain/entities/integration.entity.js'
import type { IAgentRepository } from '@domain/repositories/agent.repository.js'
import type { IChatRepository } from '@domain/repositories/chat.repository.js'
import type { IIntegrationRepository } from '@domain/repositories/integration.repository.js'

export const INTEGRATION_CHAT_USER_ID = 'integration-anonymous'

type IntegrationConversationResult =
	| { success: true; data: { id: string; agentName: string; scope: string[] } }
	| { success: false; status: 'pending'; error: string }
	| { success: false; status: 'error'; error: string }

/** Deriva un nombre legible para un origen recién auto-registrado. */
function deriveName(origin: string): string {
	try {
		return new URL(origin).host || origin
	} catch {
		return origin
	}
}

export class CreateIntegrationConversationUseCase {
	constructor(
		private readonly integrationRepository: IIntegrationRepository,
		private readonly chatRepository: IChatRepository,
		private readonly agentRepository: IAgentRepository
	) {}

	async execute(origin: string): Promise<IntegrationConversationResult> {
		if (!origin) {
			return { success: false, status: 'error', error: 'No se pudo determinar el origen de la solicitud' }
		}

		let integration = await this.integrationRepository.findByOrigin(origin)

		// Auto-registro: el primer uso de un origen desconocido lo crea en estado pendiente.
		if (!integration) {
			try {
				integration = await this.integrationRepository.create({ name: deriveName(origin), origin, scope: [], active: false })
			} catch {
				// Posible carrera con el constraint único de origin: releer.
				integration = await this.integrationRepository.findByOrigin(origin)
			}
		}

		if (!integration || !isIntegrationConfigured(integration)) {
			return { success: false, status: 'pending', error: 'Integración pendiente de configuración' }
		}

		const agent = await this.agentRepository.findBySlug(integration.agentSlug as string)
		if (!agent || !agent.isActive) {
			return { success: false, status: 'pending', error: 'El asistente no está disponible en este momento' }
		}

		const conversation: ConversationRecord = await this.chatRepository.createConversation({
			title: integration.name,
			agentId: agent.id,
			userId: INTEGRATION_CHAT_USER_ID
		})

		return { success: true, data: { id: conversation.id, agentName: agent.name, scope: integration.scope } }
	}
}
