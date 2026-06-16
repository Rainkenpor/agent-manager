import type { IChatRepository } from '@domain/repositories/chat.repository.js'
import type { StreamMessageUseCase } from '../chat/stream-message.use-case.js'
import type { GeneratePresetQnaUseCase } from './generate-preset-qna.use-case.js'
import type { MatchPresetQnaUseCase } from './match-preset-qna.use-case.js'

type SendEvent = (event: Record<string, unknown>) => void

/** Trocea un texto en fragmentos cortos para simular streaming en respuestas preestablecidas. */
function chunkText(text: string): string[] {
	const words = text.split(/(\s+)/)
	const chunks: string[] = []
	let buf = ''
	for (const w of words) {
		buf += w
		if (buf.length >= 8) {
			chunks.push(buf)
			buf = ''
		}
	}
	if (buf) chunks.push(buf)
	return chunks
}

export class PublicChatAnswerUseCase {
	constructor(
		private readonly chatRepository: IChatRepository,
		private readonly matchUseCase: MatchPresetQnaUseCase,
		private readonly streamMessageUseCase: StreamMessageUseCase,
		private readonly generateUseCase: GeneratePresetQnaUseCase
	) {}

	async execute(conversationId: string, content: string, sendEvent: SendEvent, signal?: AbortSignal): Promise<void> {
		const start = Date.now()
		const match = await this.matchUseCase.execute(content)

		if (match) {
			// Respuesta preestablecida: persistimos y emitimos sin invocar al agente.
			await this.chatRepository.addMessage(conversationId, 'user', content)
			for (const piece of chunkText(match.answer)) {
				if (signal?.aborted) return
				sendEvent({ type: 'chunk', content: piece })
			}
			const assistantMsg = await this.chatRepository.addMessage(conversationId, 'assistant', match.answer)
			await this.chatRepository.touchConversation(conversationId)
			sendEvent({ type: 'done', message: assistantMsg, responseTime: Date.now() - start })
			return
		}

		// Sin coincidencia: respondemos con el agente y capturamos el texto para generar la FAQ.
		let answer = ''
		const capturing: SendEvent = (event) => {
			if (event.type === 'chunk' && typeof event.content === 'string') answer += event.content
			sendEvent(event)
		}
		await this.streamMessageUseCase.execute(conversationId, content, capturing as never, signal)

		if (!signal?.aborted && answer.trim()) {
			void this.generateUseCase.execute({ question: content, answer: answer.trim() }).catch(() => {})
		}
	}
}
