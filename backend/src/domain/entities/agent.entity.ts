export interface IAgentServiceExecute {
	notificationRoom?: string; // Room para notificaciones
	dirPath: string;
	/** Primary agent types + any subagent name from the subagents directory */
	agentType:
		| "core"
		| "pending"
		| "commits"
		| "deep-search"
		| "analyzer"
		| "business-rules"
		| "diagrams"
		| "examples"
		| "technical-concepts"
		| (string & Record<never, never>); // allow arbitrary subagent names
	query: string;
	history?: Array<{ role: "user" | "assistant"; content: string }>;
	artifacts?: { name: string; content: string }[];
	stream?: boolean; // Indica si la respuesta debe ser en formato stream
}

export interface IAgentService {
	// biome-ignore lint/suspicious/noExplicitAny: return type varies per implementation
	executeAgent(params: IAgentServiceExecute): Promise<any>;
}

// ─── CRUD entities para el módulo de administración de agentes ───────────────

export interface AgentRecord {
	id: string;
	name: string;
	slug: string;
	description: string | null;
	mode: "primary" | "subagent";
	model: string;
	temperature: string;
	tools: Record<string, boolean>;
	content: string;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface AgentWithSubagents extends AgentRecord {
	subagents: AgentRecord[];
}

export interface CreateAgentDTO {
	name: string;
	slug: string;
	description?: string;
	mode: "primary" | "subagent";
	model: string;
	temperature: string;
	tools: Record<string, boolean>;
	content: string;
	subagentIds?: string[];
}

export interface UpdateAgentDTO {
	id: string;
	name?: string;
	slug?: string;
	description?: string | null;
	mode?: "primary" | "subagent";
	model?: string;
	temperature?: string;
	tools?: Record<string, boolean>;
	content?: string;
	useByChat?: boolean;
	isActive?: boolean;
	subagentIds?: string[];
}
