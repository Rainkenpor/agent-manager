/** @deprecated Use GovernanceData instead */
export interface SkillData {
	name: string
	slug: string
	description: string | null
	content: string
}

export interface GovernanceData {
	id: string
	name: string
	type: string
	description: string | null
	content: string
	sections: Array<{
		title: string
		content: string
	}>
}

export interface ToolImageInfo {
	serverName: string
	serverId?: string
	toolName: string
	args: Record<string, unknown>
	mimeType: string
	data: string
}

export interface ToolCallMeta {
	callId?: string
	agentId?: string
}

export interface DelegatableAgentTool {
	name: string
	description: string
}

/** Agente al que el router puede delegar, expuesto al LLM como tool `agent_<slug>` */
export interface DelegatableAgent {
	id: string
	name: string
	slug: string
	description: string | null
	/** Capacidades del agente — el router las necesita para elegir a quién delegar */
	tools?: DelegatableAgentTool[]
}

export interface ToolCallbacks {
	onToolCall: (toolName: string, args: any, meta?: ToolCallMeta) => Promise<void>
	onToolResult?: (callId: string, ok: boolean) => Promise<void>
	onAgentStart?: (info: { callId: string; id: string; slug: string; name: string; instruction: string }) => Promise<void>
	onAgentEnd?: (callId: string, ok: boolean) => Promise<void>
	onToolImage?: (info: ToolImageInfo) => Promise<void>
	credentialCallbacks: {
		getCredentials: (mcpServerId: string) => Promise<Record<string, string>>
		setCredential: (mcpServerId: string, key: string, value: string) => Promise<void>
		deleteCredential: (mcpServerId: string, key: string) => Promise<void>
		getListCredentials: () => Promise<
			{
				id: string
				name: string
				displayName: string
				credentialFields: { key: string; description: string }[]
			}[]
		>
	}
}

export interface IAgentServiceExecute {
	systemPrompt?: string // Permite pasar un prompt personalizado para este agente
	agentSlug: string
	query: string
	history?: Array<{ role: 'user' | 'assistant'; content: string }>
	allowedTools?: Set<string> // Lista de herramientas permitidas para este agente
	delegatableAgents?: DelegatableAgent[] // Agentes a los que se puede delegar como tool `agent_<slug>`
	maxOutputTokens?: number // Límite de tokens de salida (max_tokens) para la llamada al LLM
	artifacts?: { name: string; content: string }[]
	stream?: boolean // Indica si la respuesta debe ser en formato stream
	toolsCallbacks?: ToolCallbacks // Callbacks para invocar herramientas y manejar borradores
	userId?: string // ID del usuario que inicia la ejecución (para inyección de credenciales MCP)
	signal?: AbortSignal // Señal para cancelar la ejecución del agente
	auditSourceType?: 'chat' | 'agent' | 'tool' // Tipo de origen para la auditoría de tokens
	auditAgentId?: string // ID del agente para la auditoría de tokens
	auditAgentName?: string // Nombre del agente para la auditoría de tokens
}

export interface IAgentService {
	// biome-ignore lint/suspicious/noExplicitAny: return type varies per implementation
	executeAgent(params: IAgentServiceExecute): Promise<any>
}

// ─── CRUD entities para el módulo de administración de agentes ───────────────

export interface AgentRecord {
	id: string
	name: string
	slug: string
	description: string | null
	mode: 'primary' | 'subagent'
	groupIds: string[]
	model: string
	temperature: string
	maxOutputTokens: number | null
	tools: Record<string, boolean>
	content: string
	isActive: boolean
	useByChat: boolean
	createdAt: string
	updatedAt: string
}

export interface AgentWithSubagents extends AgentRecord {
	subagents: AgentRecord[]
}

export interface CreateAgentDTO {
	name: string
	slug: string
	description?: string
	mode: 'primary' | 'subagent'
	groupIds?: string[]
	model: string
	temperature: string
	maxOutputTokens?: number | null
	tools: Record<string, boolean>
	content: string
	subagentIds?: string[]
}

export interface UpdateAgentDTO {
	id: string
	name?: string
	slug?: string
	description?: string | null
	mode?: 'primary' | 'subagent'
	groupIds?: string[]
	model?: string
	temperature?: string
	maxOutputTokens?: number | null
	tools?: Record<string, boolean>
	content?: string
	useByChat?: boolean
	isActive?: boolean
	subagentIds?: string[]
}
