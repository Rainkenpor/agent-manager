import { AppDataSource } from '@infra/db/database.js'
import { AgentEntity, AgentSubagentEntity } from '@infra/db/entities.js'
import { v4 as uuidv4 } from 'uuid'
import type { IAgentRepository } from '@domain/repositories/agent.repository.js'
import type { AgentRecord, AgentWithSubagents, CreateAgentDTO, UpdateAgentDTO } from '../../domain/entities/agent.entity.js'

export class AgentRepository implements IAgentRepository {
	private get repo() {
		return AppDataSource.getRepository(AgentEntity)
	}

	private toRecord(e: AgentEntity): AgentRecord {
		return {
			...e,
			mode: e.mode as 'primary' | 'subagent',
			tools: (e.tools as Record<string, boolean>) ?? {}
		}
	}

	async create(data: CreateAgentDTO): Promise<AgentWithSubagents> {
		const now = new Date().toISOString()
		const entity = this.repo.create({
			id: uuidv4(),
			name: data.name,
			slug: data.slug,
			description: data.description ?? null,
			mode: data.mode,
			model: data.model,
			temperature: data.temperature,
			tools: data.tools as Record<string, boolean>,
			content: data.content,
			isActive: true,
			useByChat: false,
			createdAt: now,
			updatedAt: now
		})
		await this.repo.save(entity)
		if (data.subagentIds?.length) {
			await this.setSubagents(entity.id, data.subagentIds)
		}
		return (await this.findById(entity.id))!
	}

	async findAll(options?: { useByChat?: boolean }): Promise<AgentWithSubagents[]> {
		const where = options?.useByChat !== undefined ? { useByChat: options.useByChat } : {}
		const rows = await this.repo.find({
			where,
			order: { mode: 'ASC', name: 'ASC' }
		})
		return Promise.all(rows.map((r) => this._withSubagents(this.toRecord(r))))
	}

	async findById(id: string): Promise<AgentWithSubagents | undefined> {
		const row = await this.repo.findOneBy({ id })
		if (!row) return undefined
		return this._withSubagents(this.toRecord(row))
	}

	async findBySlug(slug: string): Promise<AgentWithSubagents | undefined> {
		const row = await this.repo.findOneBy({ slug })
		if (!row) return undefined
		return this._withSubagents(this.toRecord(row))
	}

	async update(data: UpdateAgentDTO): Promise<AgentWithSubagents | undefined> {
		const updateValues: Partial<AgentEntity> = { updatedAt: new Date().toISOString() }
		if (data.name !== undefined) updateValues.name = data.name
		if (data.slug !== undefined) updateValues.slug = data.slug
		if (data.description !== undefined) updateValues.description = data.description
		if (data.mode !== undefined) updateValues.mode = data.mode
		if (data.model !== undefined) updateValues.model = data.model
		if (data.temperature !== undefined) updateValues.temperature = data.temperature
		if (data.tools !== undefined) updateValues.tools = data.tools as Record<string, boolean>
		if (data.content !== undefined) updateValues.content = data.content
		if (data.isActive !== undefined) updateValues.isActive = data.isActive
		if (data.useByChat !== undefined) updateValues.useByChat = data.useByChat

		await this.repo.update(data.id, updateValues)
		if (data.subagentIds !== undefined) {
			await this.setSubagents(data.id, data.subagentIds)
		}
		return this.findById(data.id)
	}

	async delete(id: string): Promise<boolean> {
		const result = await this.repo.delete(id)
		return (result.affected ?? 0) > 0
	}

	async setSubagents(agentId: string, subagentIds: string[]): Promise<void> {
		const repo = AppDataSource.getRepository(AgentSubagentEntity)
		await repo.delete({ agentId })
		if (!subagentIds.length) return
		const entries = subagentIds.map((subagentId, i) =>
			repo.create({
				id: uuidv4(),
				agentId,
				subagentId,
				order: i,
				createdAt: new Date().toISOString()
			})
		)
		await repo.save(entries)
	}

	async getSubagents(agentId: string): Promise<AgentRecord[]> {
		const repo = AppDataSource.getRepository(AgentSubagentEntity)
		const relations = await repo.find({ where: { agentId }, order: { order: 'ASC' } })
		if (!relations.length) return []
		const subagents = await Promise.all(
			relations.map((r) => this.repo.findOneBy({ id: r.subagentId }))
		)
		return subagents.filter((s): s is AgentEntity => s !== null).map((s) => this.toRecord(s))
	}

	private async _withSubagents(agent: AgentRecord): Promise<AgentWithSubagents> {
		const subagents = await this.getSubagents(agent.id)
		return { ...agent, subagents }
	}
}
