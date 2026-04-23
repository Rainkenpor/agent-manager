import { AppDataSource } from '@infra/db/database.js'
import { McpServerEntity, RoleMcpEntity, RoleAgentEntity, RoleMcpToolEntity, AgentEntity } from '@infra/db/entities.js'
import { v4 as uuidv4 } from 'uuid'
import type { IMcpServerRepository } from '@domain/repositories/mcp-server.repository.js'
import type { McpServerEntity as McpServerDomain, CreateMcpServer, UpdateMcpServer } from '@domain/entities/mcp-server.entity.js'

export class McpServerRepository implements IMcpServerRepository {
	private get repo() {
		return AppDataSource.getRepository(McpServerEntity)
	}

	private mapToEntity(e: McpServerEntity): McpServerDomain {
		return {
			id: e.id,
			name: e.name,
			displayName: e.displayName,
			description: e.description,
			type: e.type as 'http' | 'stdio' | 'local',
			url: e.url,
			command: e.command,
			args: e.args ?? [],
			headers: e.headers ?? {},
			credentialFields: e.credentialFields ?? [],
			active: e.active,
			createdAt: e.createdAt,
			updatedAt: e.updatedAt
		}
	}

	async create(data: CreateMcpServer): Promise<McpServerDomain> {
		const now = new Date().toISOString()
		const entity = this.repo.create({
			id: uuidv4(),
			name: data.name,
			displayName: data.displayName ?? null,
			description: data.description ?? null,
			type: data.type ?? 'http',
			url: data.url ?? null,
			command: data.command ?? null,
			args: data.args ?? null,
			headers: data.headers ?? null,
			credentialFields: data.credentialFields ?? null,
			active: data.active ?? true,
			createdAt: now,
			updatedAt: now
		})
		await this.repo.save(entity)
		return this.mapToEntity((await this.repo.findOneByOrFail({ id: entity.id })))
	}

	async findAll(): Promise<McpServerDomain[]> {
		const rows = await this.repo.find()
		rows.sort((a, b) => {
			if (a.type === 'local') return -1
			if (b.type === 'local') return 1
			return a.name.localeCompare(b.name)
		})
		return rows.map((r) => this.mapToEntity(r))
	}

	async findById(id: string): Promise<McpServerDomain | null> {
		const row = await this.repo.findOneBy({ id })
		return row ? this.mapToEntity(row) : null
	}

	async findByName(name: string): Promise<McpServerDomain | null> {
		const row = await this.repo.findOneBy({ name })
		return row ? this.mapToEntity(row) : null
	}

	async update(id: string, data: UpdateMcpServer): Promise<McpServerDomain> {
		await this.repo.update(id, { ...data, updatedAt: new Date().toISOString() })
		return this.mapToEntity(await this.repo.findOneByOrFail({ id }))
	}

	async delete(id: string): Promise<void> {
		await this.repo.delete(id)
	}

	async assignToRole(roleId: string, mcpServerId: string): Promise<void> {
		const repo = AppDataSource.getRepository(RoleMcpEntity)
		const existing = await repo.findOneBy({ roleId, mcpServerId })
		if (existing) return
		await repo.save(repo.create({ id: uuidv4(), roleId, mcpServerId, assignedAt: new Date().toISOString() }))
	}

	async removeFromRole(roleId: string, mcpServerId: string): Promise<void> {
		const repo = AppDataSource.getRepository(RoleMcpEntity)
		await repo.delete({ roleId, mcpServerId })
	}

	async getByRole(roleId: string): Promise<McpServerDomain[]> {
		const repo = AppDataSource.getRepository(RoleMcpEntity)
		const relations = await repo.findBy({ roleId })
		if (!relations.length) return []
		const results: McpServerDomain[] = []
		for (const rel of relations) {
			const row = await this.repo.findOneBy({ id: rel.mcpServerId })
			if (row) results.push(this.mapToEntity(row))
		}
		return results
	}

	async assignAgentToRole(roleId: string, agentId: string): Promise<void> {
		const repo = AppDataSource.getRepository(RoleAgentEntity)
		const existing = await repo.findOneBy({ roleId, agentId })
		if (existing) return
		await repo.save(repo.create({ id: uuidv4(), roleId, agentId, assignedAt: new Date().toISOString() }))
	}

	async removeAgentFromRole(roleId: string, agentId: string): Promise<void> {
		const repo = AppDataSource.getRepository(RoleAgentEntity)
		await repo.delete({ roleId, agentId })
	}

	async getAgentsByRole(roleId: string): Promise<Array<{ id: string; name: string; slug: string; mode: string }>> {
		const repo = AppDataSource.getRepository(RoleAgentEntity)
		const relations = await repo.findBy({ roleId })
		if (!relations.length) return []
		const agentRepo = AppDataSource.getRepository(AgentEntity)
		const results: Array<{ id: string; name: string; slug: string; mode: string }> = []
		for (const rel of relations) {
			const agent = await agentRepo.findOneBy({ id: rel.agentId })
			if (agent) results.push({ id: agent.id, name: agent.name, slug: agent.slug, mode: agent.mode })
		}
		return results
	}

	async getRoleMcpTools(roleId: string, mcpServerId: string): Promise<string[]> {
		const repo = AppDataSource.getRepository(RoleMcpToolEntity)
		const rows = await repo.findBy({ roleId, mcpServerId })
		return rows.map((r) => r.toolName)
	}

	async setRoleMcpTools(roleId: string, mcpServerId: string, toolNames: string[]): Promise<void> {
		const repo = AppDataSource.getRepository(RoleMcpToolEntity)
		await repo.delete({ roleId, mcpServerId })
		if (toolNames.length > 0) {
			const entries = toolNames.map((toolName) =>
				repo.create({ id: uuidv4(), roleId, mcpServerId, toolName, assignedAt: new Date().toISOString() })
			)
			await repo.save(entries)
		}
	}
}
