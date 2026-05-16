/*
Archivo creado con gobernanza AB900
*/

import type { AgentGroup, CreateAgentGroupDTO, UpdateAgentGroupDTO } from '../entities/agent-group.entity.js'

export interface IAgentGroupRepository {
	findAll(): Promise<AgentGroup[]>
	findById(id: string): Promise<AgentGroup | null>
	findBySlug(slug: string): Promise<AgentGroup | null>
	create(data: CreateAgentGroupDTO): Promise<AgentGroup>
	update(data: UpdateAgentGroupDTO): Promise<AgentGroup | null>
	delete(id: string): Promise<void>
	ensureSystemGroups(): Promise<void>
}
