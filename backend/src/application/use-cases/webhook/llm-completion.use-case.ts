import { randomUUID } from 'node:crypto'
import type { IAgentServiceExecute, ToolCallbacks } from '@domain/entities/agent.entity.js'
import type { WebhookEntity } from '@domain/entities/webhook.entity.js'
import { AgentService } from '@infra/service/agent.service.js'
import { systemPromptChat as basePrompt } from '../../../const.js'

/**
 * Webhook con destino `llm`: expone el LLM del proveedor activo con contrato
 * compatible con OpenAI Chat Completions. El webhook actúa como un "agente inline":
 * su system prompt y su set de tools viven en la configuración (`extraData`), y
 * agent-manager ejecuta esas tools en su loop agéntico, igual que un agente.
 *
 * El `model` del request se ignora (siempre proveedor activo; sólo se hace echo).
 */

interface OpenAiMessage {
	role: 'system' | 'user' | 'assistant' | 'tool'
	content: string | null
}

export interface OpenAiChatRequest {
	model?: string
	messages?: OpenAiMessage[]
	max_tokens?: number
	stream?: boolean
}

const NOOP_TOOL_CALLBACKS: ToolCallbacks = {
	onToolCall: async () => {},
	credentialCallbacks: {
		getCredentials: async () => ({}),
		setCredential: async () => {},
		deleteCredential: async () => {},
		getListCredentials: async () => []
	}
}

export class WebhookLlmCompletionUseCase {
	private readonly agentService = new AgentService()

	private parseTools(webhook: WebhookEntity): Set<string> {
		const raw = webhook.extraData?.tools
		if (!raw) return new Set()
		try {
			const map = JSON.parse(raw) as Record<string, boolean>
			return new Set(
				Object.entries(map)
					.filter(([, enabled]) => enabled)
					.map(([toolName]) => toolName)
			)
		} catch {
			return new Set()
		}
	}

	private buildParams(webhook: WebhookEntity, body: OpenAiChatRequest, signal?: AbortSignal): IAgentServiceExecute {
		const messages = Array.isArray(body.messages) ? body.messages : []

		const requestSystem = messages
			.filter((m) => m.role === 'system' && m.content)
			.map((m) => m.content as string)
			.join('\n')
		const configuredPrompt = webhook.extraData?.systemPrompt ?? ''
		const systemPrompt = [basePrompt, configuredPrompt, requestSystem].filter(Boolean).join('\n')

		const convo = messages.filter((m) => m.role === 'user' || m.role === 'assistant')
		const lastUserPos = convo.map((m) => m.role).lastIndexOf('user')
		if (lastUserPos < 0) {
			throw new Error('El request debe incluir al menos un mensaje con role "user".')
		}
		const query = convo[lastUserPos].content ?? ''
		const history = convo.slice(0, lastUserPos).map((m) => ({
			role: m.role as 'user' | 'assistant',
			content: m.content ?? ''
		}))

		return {
			systemPrompt,
			agentSlug: `webhook:${webhook.name}`,
			query,
			history,
			allowedTools: this.parseTools(webhook),
			maxOutputTokens: typeof body.max_tokens === 'number' ? body.max_tokens : undefined,
			signal,
			toolsCallbacks: NOOP_TOOL_CALLBACKS,
			auditSourceType: 'tool',
			auditAgentName: `webhook:${webhook.name}`
		}
	}

	private buildBase(body: OpenAiChatRequest) {
		return {
			id: `chatcmpl-${randomUUID()}`,
			created: Math.floor(Date.now() / 1000),
			model: body.model || 'agent-manager'
		}
	}

	/** stream:false — devuelve un objeto OpenAI ChatCompletion completo. */
	async completeJson(webhook: WebhookEntity, body: OpenAiChatRequest, signal?: AbortSignal): Promise<Record<string, unknown>> {
		const params = this.buildParams(webhook, body, signal)
		const result = await this.agentService.executeAgent(params)
		const content = typeof result === 'string' ? result : String(result ?? '')
		const { id, created, model } = this.buildBase(body)
		return {
			id,
			object: 'chat.completion',
			created,
			model,
			choices: [
				{
					index: 0,
					message: { role: 'assistant', content },
					finish_reason: 'stop'
				}
			]
		}
	}

	/** stream:true — genera objetos `chat.completion.chunk` estilo OpenAI (sin el terminador [DONE]). */
	async *completeStream(webhook: WebhookEntity, body: OpenAiChatRequest, signal?: AbortSignal): AsyncGenerator<Record<string, unknown>> {
		const params = this.buildParams(webhook, body, signal)
		const { id, created, model } = this.buildBase(body)
		const base = { id, object: 'chat.completion.chunk', created, model }

		for await (const delta of this.agentService.initAgentStream(params)) {
			if (signal?.aborted) return
			if (!delta) continue
			yield { ...base, choices: [{ index: 0, delta: { content: delta }, finish_reason: null }] }
		}

		yield { ...base, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] }
	}
}
