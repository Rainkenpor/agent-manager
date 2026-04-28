import { AgentService } from '@infra/service/agent.service.js'
import type { AiAssistInput, AiAssistSseEvent } from '@domain/entities/ai-assist.entity.js'

const DEFAULT_SYSTEM_PROMPT = `You are a text editing assistant. The user will give you a textarea content and a request.

Analyze the request and respond with a JSON object — no markdown, no code blocks, just raw JSON:

- If the user asks a question or wants an explanation: { "type": "answer", "content": "your response here" }
- If the user wants to modify, improve, rewrite, translate, or change the text: { "type": "change", "modified": "the complete modified text", "explanation": "brief explanation of what you changed" }

When the textarea is empty and the user asks to generate or write something, produce a "change" response with the generated text as "modified".

Always respond with ONLY valid JSON. No extra text before or after.`

export class StreamAiAssistUseCase {
	async execute(input: AiAssistInput, sendEvent: (event: AiAssistSseEvent) => void, signal?: AbortSignal): Promise<void> {
		const agentService = new AgentService()
		let fullContent = ''

		const userMessage = input.content
			? `## Current textarea content:\n${input.content}\n\n## User request:\n${input.request}`
			: `## User request:\n${input.request}`

		try {
			for await (const chunk of agentService.initAgentStream({
				agentSlug: 'ai-assist',
				query: userMessage,
				systemPrompt: input.systemPrompt || DEFAULT_SYSTEM_PROMPT,
				signal
			})) {
				if (signal?.aborted) break
				if (!chunk.startsWith('<<')) {
					fullContent += chunk
					sendEvent({ type: 'chunk', content: chunk })
				}
			}

			sendEvent({ type: 'done', content: fullContent })
		} catch (error) {
			if ((error as Error).name !== 'AbortError') {
				sendEvent({ type: 'error', error: (error as Error).message })
			}
		}
	}
}
