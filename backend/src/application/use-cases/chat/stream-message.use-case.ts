import { listChatAgentsForUser } from '@applicationService/user-agents.service.js'
import type { DelegatableAgent, ToolCallMeta, ToolImageInfo } from '@domain/entities/agent.entity.js'
import { emptyProyectoData } from '@domain/entities/proyecto.entity.js'
import type { IMcpServerRepository, IMcpUserCredentialRepository } from '@domain/repositories'
import type { IAgentRepository } from '@domain/repositories/agent.repository.js'
import type { IChatRepository } from '@domain/repositories/chat.repository.js'
import { AppDataSource } from '@infra/db/database.js'
import {
	ConversationEntity,
	ProyectoEntity,
	TraceabilityEntity,
	TraceabilityParticipantEntity,
	TraceabilityParticipantStageChatEntity
} from '@infra/db/entities.js'
import { MCPAgentService } from '@infra/service/mcp-agent.service'
import { stripImageMarker } from '@infra/utils/image-marker.js'
import { envs } from '../../../envs.js'
import type { GenerateTitleUseCase } from './generate-title.use-case.js'

/** Si la conversación pertenece a un proyecto, arma un resumen para inyectarlo al contexto del agente. */
async function resolveProyectoContext(conversationId: string): Promise<string | null> {
	const conv = await AppDataSource.getRepository(ConversationEntity).findOneBy({ id: conversationId })
	if (!conv?.proyectoId) return null

	const proyecto = await AppDataSource.getRepository(ProyectoEntity).findOneBy({ id: conv.proyectoId })
	if (!proyecto) return null

	const data = { ...emptyProyectoData(), ...(proyecto.data ?? {}) }

	const lines = [
		'Contexto del proyecto. Usa este proyectoId con read_proyecto_data para consultar el JSON de información y con create/update/delete_proyecto_data para modificar segmentos (secciones: historiasUsuario, arquitectura, proyectosRelacionados, metadatos).',
		`ProyectoId: ${proyecto.id}`,
		`Nombre: ${proyecto.name}`,
		`Estado: ${proyecto.status}`
	]
	if (proyecto.description) lines.push(`Descripción: ${proyecto.description}`)
	lines.push('Información (JSON):', JSON.stringify(data, null, 2))

	return lines.join('\n')
}

async function resolveTraceabilityContext(conversationId: string): Promise<{ traceabilityId: string | null; stageId: string | null }> {
	const stageChatRepo = AppDataSource.getRepository(TraceabilityParticipantStageChatEntity)
	const stageChat = await stageChatRepo.findOneBy({ chatId: conversationId })
	if (stageChat) return { traceabilityId: stageChat.traceabilityId, stageId: stageChat.stageId }

	const tracRepo = AppDataSource.getRepository(TraceabilityEntity)
	const trac = await tracRepo.findOneBy({ chatId: conversationId })
	if (trac) return { traceabilityId: trac.id, stageId: null }

	const partRepo = AppDataSource.getRepository(TraceabilityParticipantEntity)
	const participant = await partRepo.findOneBy({ chatId: conversationId })
	if (participant) return { traceabilityId: participant.traceabilityId, stageId: null }

	return { traceabilityId: null, stageId: null }
}

/** Catálogo de agentes disponibles para el router, con sus capacidades, inyectado al system prompt. */
function describeDelegatableAgents(agents: DelegatableAgent[]): string {
	if (agents.length === 0) {
		return 'Agentes disponibles: ninguno. No puedes delegar; explícale al usuario que su rol no tiene agentes asignados.'
	}

	const lines = ['Agentes disponibles para delegar (llámalos con la herramienta indicada):']
	for (const agent of agents) {
		lines.push(`\n### ${agent.name} — herramienta \`agent_${agent.slug}\``)
		if (agent.description) lines.push(agent.description)
		const tools = agent.tools ?? []
		if (tools.length > 0) {
			lines.push('Capacidades:')
			for (const tool of tools) {
				lines.push(`- ${tool.name}${tool.description ? `: ${tool.description}` : ''}`)
			}
		}
	}
	return lines.join('\n')
}

export type SseEvent =
	| { type: 'chunk'; content: string }
	| { type: 'tool'; name: string; callId?: string; agentId?: string }
	| { type: 'tool_result'; callId: string; status: 'completed' | 'failed' }
	| { type: 'agent_start'; callId: string; agentId: string; slug: string; name: string; instruction: string }
	| { type: 'agent_end'; callId: string; status: 'completed' | 'failed' }
	| { type: 'title'; title: string }
	| { type: 'tool_image'; serverId?: string; toolName: string; args: Record<string, unknown>; mimeType: string; data: string }
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
		private readonly mcpServerRepository: IMcpServerRepository,
		private readonly generateTitleUseCase: GenerateTitleUseCase
	) {}

	async execute(
		conversationId: string,
		userContent: string,
		sendEvent: (event: SseEvent) => void,
		signal?: AbortSignal,
		extraContext?: string
	): Promise<void> {
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

		// Build history from messages already in DB before this turn.
		// Strip any persisted image marker so base64 thumbnails never reach the LLM.
		const history = conv.messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: stripImageMarker(m.content) }))

		const userId = conv.userId
		const toolsCallbacks = {
			onToolCall: async (toolName: string, args: any, meta?: ToolCallMeta) => {
				sendEvent({ type: 'tool', name: toolName, callId: meta?.callId, agentId: meta?.agentId })
			},
			onToolResult: async (callId: string, ok: boolean) => {
				sendEvent({ type: 'tool_result', callId, status: ok ? 'completed' : 'failed' })
			},
			onAgentStart: async (info: { callId: string; id: string; slug: string; name: string; instruction: string }) => {
				sendEvent({
					type: 'agent_start',
					callId: info.callId,
					agentId: info.id,
					slug: info.slug,
					name: info.name,
					instruction: info.instruction
				})
			},
			onAgentEnd: async (callId: string, ok: boolean) => {
				sendEvent({ type: 'agent_end', callId, status: ok ? 'completed' : 'failed' })
			},
			onToolImage: async (info: ToolImageInfo) => {
				sendEvent({
					type: 'tool_image',
					serverId: info.serverId,
					toolName: info.toolName,
					args: info.args,
					mimeType: info.mimeType,
					data: info.data
				})
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
						throw new Error(
							`Credential key not valid for this MCP Server: ${key}, valid keys are: ${serverValid.credentialFields?.map((f) => f.key).join(', ')}`
						)
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

		const { traceabilityId, stageId } = await resolveTraceabilityContext(conversationId)
		const contextLines = [`ChatId: ${conversationId}`]
		if (traceabilityId) contextLines.push(`TraceabilityId: ${traceabilityId}`)
		if (stageId) contextLines.push(`StageId: ${stageId}`)
		const proyectoContext = await resolveProyectoContext(conversationId)
		if (proyectoContext) contextLines.push(proyectoContext)
		if (extraContext) contextLines.push(extraContext)

		// El agente enrutador no resuelve: delega en los agentes que los roles del usuario le permiten.
		// Los chats creados antes del enrutador conservan su agente y se ejecutan sin delegación.
		const delegatableAgents: DelegatableAgent[] | undefined =
			agent.slug === envs.ROUTER_AGENT_SLUG ? await listChatAgentsForUser(userId) : undefined

		if (delegatableAgents) contextLines.push(describeDelegatableAgents(delegatableAgents))

		for await (const chunk of MCPAgentService.asyncCall(
			{ ...agent, addContext: `\n\n${contextLines.join('\n')}` },
			{
				instruction: userContent,
				history,
				toolsCallbacks,
				userId,
				signal,
				auditSourceType: 'chat',
				delegatableAgents
			}
		)) {
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

		if (!conv.title && history.length === 0) {
			const title = await this.generateTitleUseCase.execute(conversationId, userContent, cleanText, userId)
			if (title) sendEvent({ type: 'title', title })
		}

		sendEvent({ type: 'done', message: assistantMsg, responseTime: Date.now() - startTime })
	}
}
