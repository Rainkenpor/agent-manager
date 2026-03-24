export interface ToolCallbacks {
	onToolCall: (toolName: string, args: any) => Promise<void>
	draftCallbacks: {
		onUpdate: (draft: string) => Promise<void>
		onRead: () => Promise<string | null>
	}
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
	artifacts?: { name: string; content: string }[]
	stream?: boolean // Indica si la respuesta debe ser en formato stream
	toolsCallbacks?: ToolCallbacks // Callbacks para invocar herramientas y manejar borradores
	userId?: string // ID del usuario que inicia la ejecución (para inyección de credenciales MCP)
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
	model: string
	temperature: string
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
	model: string
	temperature: string
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
	model?: string
	temperature?: string
	tools?: Record<string, boolean>
	content?: string
	useByChat?: boolean
	isActive?: boolean
	subagentIds?: string[]
}
