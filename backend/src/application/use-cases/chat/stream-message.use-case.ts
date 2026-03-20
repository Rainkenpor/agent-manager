import type { IChatRepository } from '@domain/repositories/chat.repository.js'
import type { IAgentRepository } from '@domain/repositories/agent.repository.js'
import { AgentService } from '@infra/service/agent.service.js'

export type SseEvent =
	| { type: 'chunk'; content: string }
	| { type: 'tool'; name: string }
	| {
			type: 'done'
			message: { id: string; conversationId: string; role: string; content: string; createdAt: string }
			responseTime: number
	  }
	| { type: 'error'; error: string }

export class StreamMessageUseCase {
	constructor(
		private readonly chatRepository: IChatRepository,
		private readonly agentRepository: IAgentRepository
	) {}

	async execute(conversationId: string, userContent: string, sendEvent: (event: SseEvent) => void): Promise<void> {
		const startTime = Date.now()

		const conv = await this.chatRepository.findConversationById(conversationId)
		if (!conv) {
			sendEvent({ type: 'error', error: 'Conversación no encontrada' })
			return
		}

		const agent = await this.agentRepository.findById(conv.agentId)
		if (!agent) {
			sendEvent({ type: 'error', error: 'Agente no encontrado' })
			return
		}

		// Persist user message
		await this.chatRepository.addMessage(conversationId, 'user', userContent)

		// Build history from messages already in DB before this turn
		const history = conv.messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

		// Stream agent response
		const agentService = new AgentService()
		const allChunks: string[] = []

		for await (const chunk of agentService.initAgentStream({
			agentSlug: agent.slug,
			query: userContent,
			systemPrompt: agent.content || undefined,
			history
		})) {
			allChunks.push(chunk)
			if (chunk.startsWith('<<')) {
				// Tool invocation marker: <<id::toolName>>{args}<<\id>>
				const match = chunk.match(/^<<[^:]+::([^>]+)>>/)
				if (match) sendEvent({ type: 'tool', name: match[1] })
				// Tool result markers are silently dropped
			} else {
				sendEvent({ type: 'chunk', content: chunk })
			}
		}

		// Strip tool markers before persisting
		const rawText = allChunks.join('')
		const cleanText = rawText.replace(/<<[^>]+>>[^<]*<<\\[^>]+>>/g, '').trim() || rawText.trim()

		const assistantMsg = await this.chatRepository.addMessage(conversationId, 'assistant', cleanText)
		await this.chatRepository.touchConversation(conversationId)

		sendEvent({ type: 'done', message: assistantMsg, responseTime: Date.now() - startTime })
	}
}
