import type { IChatRepository } from '@domain/repositories/chat.repository.js'
import type { IAgentRepository } from '@domain/repositories/agent.repository.js'
import { MCPAgentService } from '@infra/service/mcp-agent.service'
import type { IMcpServerRepository, IMcpUserCredentialRepository } from '@domain/repositories'

export type SseEvent =
	| { type: 'chunk'; content: string }
	| { type: 'tool'; name: string }
	| { type: 'draft_updated'; draft: string }
	| {
			type: 'done'
			message: { id: string; conversationId: string; role: string; content: string; createdAt: string }
			responseTime: number
	  }
	| { type: 'error'; error: string }

export class StreamMessageUseCase {
	constructor(
		private readonly chatRepository: IChatRepository,
		private readonly agentRepository: IAgentRepository,
		private readonly credentialRepository: IMcpUserCredentialRepository,
		private readonly mcpServerRepository: IMcpServerRepository
	) {}

	async execute(conversationId: string, userContent: string, sendEvent: (event: SseEvent) => void, signal?: AbortSignal): Promise<void> {
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

		const userId = conv.userId
		const toolsCallbacks = {
			onToolCall: async (toolName: string, args: any) => {
				sendEvent({ type: 'tool', name: toolName })
			},
			draftCallbacks: {
				onUpdate: async (draft: string) => {
					await this.chatRepository.updateDraft(conversationId, draft)
					sendEvent({ type: 'draft_updated', draft })
				},
				onRead: async () => {
					const current = await this.chatRepository.findConversationById(conversationId)
					return current?.draft ?? null
				}
			},
			credentialCallbacks: {
				getCredentials: async (mcpServerId: string): Promise<Record<string, string>> => {
					const creds = await this.credentialRepository.findByUserAndMcp(userId, mcpServerId)
					return Object.fromEntries(creds.map((c) => [c.key, c.value]))
				},
				setCredential: async (mcpServerId: string, key: string, value: string): Promise<void> => {
					// Si se envia el nombre por mcpServerId
					const server = await this.mcpServerRepository.findByName(mcpServerId)
					if (server) mcpServerId = server.id

          const serverValid = await this.mcpServerRepository.findById(mcpServerId)
          if (!serverValid) {
            throw new Error(`MCP Server not found: ${mcpServerId}`)
          }
          if (serverValid.credentialFields?.find((f) => f.key === key) === undefined) {
            throw new Error(`Credential key not valid for this MCP Server: ${key}, valid keys are: ${serverValid.credentialFields?.map((f) => f.key).join(', ')}`)
          }

					await this.credentialRepository.upsert({ userId, mcpServerId, key, value })
				},
				deleteCredential: async (mcpServerId: string, key: string): Promise<void> => {
					await this.credentialRepository.delete(userId, mcpServerId, key)
				},
				getListCredentials: async (): Promise<
					{ id: string; name: string; displayName: string; credentialFields: { key: string; description: string }[] }[]
				> => {
					const servers = await this.mcpServerRepository.findAll()
					if (!servers || servers.length === 0) return []
					const active = servers.filter((s) => s.active)
					return active.map((s) => ({
						id: s.id,
						name: s.name,
						displayName: s.displayName ?? s.name,
						credentialFields: s.credentialFields ?? []
					}))
				}
			}
		}

		const allChunks: string[] = []

		for await (const chunk of MCPAgentService.asyncCall(agent, {
			instruction: userContent,
			history,
			toolsCallbacks,
			userId,
			signal
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
		const cleanText = rawText.trim()

		const assistantMsg = await this.chatRepository.addMessage(conversationId, 'assistant', cleanText)
		await this.chatRepository.touchConversation(conversationId)

		sendEvent({ type: 'done', message: assistantMsg, responseTime: Date.now() - startTime })
	}
}
