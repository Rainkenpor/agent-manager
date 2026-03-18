import type {
	AgentRecord,
	AgentWithSubagents,
	CreateAgentDTO,
	UpdateAgentDTO,
} from "../entities/agent.entity.js";

export interface IAgentRepository {
	create(data: CreateAgentDTO): Promise<AgentWithSubagents>;
	findAll(options?: { useByChat?: boolean }): Promise<AgentWithSubagents[]>;
	findById(id: string): Promise<AgentWithSubagents | undefined>;
	findBySlug(slug: string): Promise<AgentWithSubagents | undefined>;
	update(data: UpdateAgentDTO): Promise<AgentWithSubagents | undefined>;
	delete(id: string): Promise<boolean>;
	setSubagents(agentId: string, subagentIds: string[]): Promise<void>;
	getSubagents(agentId: string): Promise<AgentRecord[]>;
}
