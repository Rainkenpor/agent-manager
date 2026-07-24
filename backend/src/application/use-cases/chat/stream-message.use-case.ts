import type { ToolImageInfo } from '@domain/entities/agent.entity.js'
import type { IMcpServerRepository, IMcpUserCredentialRepository } from '@domain/repositories'
import type { IAgentRepository } from '@domain/repositories/agent.repository.js'
import type { IChatRepository } from '@domain/repositories/chat.repository.js'
import { AppDataSource } from '@infra/db/database.js'
import {
	ConversationEntity,
	HistoriaUsuarioEntity,
	ProyectoEntity,
	ProyectoServicioEntity,
	TraceabilityEntity,
	TraceabilityParticipantEntity,
	TraceabilityParticipantStageChatEntity
} from '@infra/db/entities.js'
import { MCPAgentService } from '@infra/service/mcp-agent.service'
import { stripImageMarker } from '@infra/utils/image-marker.js'

/** Si la conversación pertenece a un proyecto, arma un resumen para inyectarlo al contexto del agente. */
async function resolveProyectoContext(conversationId: string): Promise<string | null> {
	const conv = await AppDataSource.getRepository(ConversationEntity).findOneBy({ id: conversationId })
	if (!conv?.proyectoId) return null

	const proyecto = await AppDataSource.getRepository(ProyectoEntity).findOneBy({ id: conv.proyectoId })
	if (!proyecto) return null

	const [servicios, historias] = await Promise.all([
		AppDataSource.getRepository(ProyectoServicioEntity).find({ where: { proyectoId: proyecto.id }, order: { name: 'ASC' } }),
		AppDataSource.getRepository(HistoriaUsuarioEntity).find({ where: { proyectoId: proyecto.id }, order: { createdAt: 'ASC' } })
	])

	const lines = [
		'Contexto del proyecto (usa proyectoId al crear/editar historias de usuario, y el id de cada HU al comentar o cambiar estado):',
		`ProyectoId: ${proyecto.id}`,
		`Nombre: ${proyecto.name}`
	]
	if (proyecto.architecture) lines.push(`Arquitectura: ${proyecto.architecture}`)
	if (proyecto.programmingLanguage) lines.push(`Lenguaje: ${proyecto.programmingLanguage}`)
	if (servicios.length) lines.push(`Servicios: ${servicios.map((s) => `${s.name} (gobernanza: ${s.governanceType ?? 'n/d'})`).join(', ')}`)
	lines.push('Historias de usuario:')
	if (historias.length === 0) lines.push('  (sin historias registradas)')
	for (const h of historias) lines.push(`  - [${h.id}] (${h.status}) ${h.title}`)

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

export type SseEvent =
	| { type: 'chunk'; content: string }
	| { type: 'tool'; name: string }
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
		private readonly mcpServerRepository: IMcpServerRepository
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
			onToolCall: async (toolName: string, args: any) => {
				sendEvent({ type: 'tool', name: toolName })
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

		for await (const chunk of MCPAgentService.asyncCall(
			{ ...agent, addContext: `\n\n${contextLines.join('\n')}` },
			{
				instruction: userContent,
				history,
				toolsCallbacks,
				userId,
				signal,
				auditSourceType: 'chat'
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

		sendEvent({ type: 'done', message: assistantMsg, responseTime: Date.now() - startTime })
	}
}
