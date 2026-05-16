import type { IAgentRepository } from '@domain/repositories/agent.repository.js'
import { AppDataSource } from '@infra/db/database.js'
import { AgentEntity, AgentGroupAssignmentEntity, AgentGroupEntity, AgentSubagentEntity } from '@infra/db/entities.js'
import { In } from 'typeorm'
import { v4 as uuidv4 } from 'uuid'
import type { AgentRecord, AgentWithSubagents, CreateAgentDTO, UpdateAgentDTO } from '../../domain/entities/agent.entity.js'

export class AgentRepository implements IAgentRepository {
	private get repo() {
		return AppDataSource.getRepository(AgentEntity)
	}

	private toRecord(e: AgentEntity, groupIds: string[] = []): AgentRecord {
		return {
			...e,
			mode: e.mode as 'primary' | 'subagent',
			groupIds,
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
		if (data.groupIds?.length) {
			await this.setGroups(entity.id, data.groupIds)
		}
		return (await this.findById(entity.id))!
	}

	async findAll(options?: { useByChat?: boolean; groupSlug?: string }): Promise<AgentWithSubagents[]> {
		const where: Partial<AgentEntity> = {}
		if (options?.useByChat !== undefined) where.useByChat = options.useByChat

		let restrictIds: string[] | null = null
		if (options?.groupSlug) {
			const groupRepo = AppDataSource.getRepository(AgentGroupEntity)
			const group = await groupRepo.findOneBy({ slug: options.groupSlug })
			if (!group) return []
			const assignRepo = AppDataSource.getRepository(AgentGroupAssignmentEntity)
			const assignments = await assignRepo.findBy({ groupId: group.id })
			if (!assignments.length) return []
			restrictIds = assignments.map((a) => a.agentId)
		}

		const rows = await this.repo.find({
			where: restrictIds ? { ...where, id: In(restrictIds) } : where,
			order: { mode: 'ASC', name: 'ASC' }
		})
		if (!rows.length) return []

		const assignRepo = AppDataSource.getRepository(AgentGroupAssignmentEntity)
		const allAssignments = await assignRepo.findBy({ agentId: In(rows.map((r) => r.id)) })
		const groupsByAgent = new Map<string, string[]>()
		for (const a of allAssignments) {
			const arr = groupsByAgent.get(a.agentId) ?? []
			arr.push(a.groupId)
			groupsByAgent.set(a.agentId, arr)
		}

		return Promise.all(rows.map((r) => this._withSubagents(this.toRecord(r, groupsByAgent.get(r.id) ?? []))))
	}

	async findById(id: string): Promise<AgentWithSubagents | undefined> {
		const row = await this.repo.findOneBy({ id })
		if (!row) return undefined
		const groupIds = await this.getGroupIds(id)
		return this._withSubagents(this.toRecord(row, groupIds))
	}

	async findBySlug(slug: string): Promise<AgentWithSubagents | undefined> {
		const row = await this.repo.findOneBy({ slug })
		if (!row) return undefined
		const groupIds = await this.getGroupIds(row.id)
		return this._withSubagents(this.toRecord(row, groupIds))
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
		if (data.groupIds !== undefined) {
			await this.setGroups(data.id, data.groupIds)
		}
		return this.findById(data.id)
	}

	async delete(id: string): Promise<boolean> {
		const assignRepo = AppDataSource.getRepository(AgentGroupAssignmentEntity)
		await assignRepo.delete({ agentId: id })
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

	async setGroups(agentId: string, groupIds: string[]): Promise<void> {
		const repo = AppDataSource.getRepository(AgentGroupAssignmentEntity)
		await repo.delete({ agentId })
		const unique = Array.from(new Set(groupIds))
		if (!unique.length) return
		const now = new Date().toISOString()
		const entries = unique.map((groupId) => repo.create({ id: uuidv4(), agentId, groupId, createdAt: now }))
		await repo.save(entries)
	}

	async getGroupIds(agentId: string): Promise<string[]> {
		const repo = AppDataSource.getRepository(AgentGroupAssignmentEntity)
		const rows = await repo.findBy({ agentId })
		return rows.map((r) => r.groupId)
	}

	async getSubagents(agentId: string): Promise<AgentRecord[]> {
		const repo = AppDataSource.getRepository(AgentSubagentEntity)
		const relations = await repo.find({ where: { agentId }, order: { order: 'ASC' } })
		if (!relations.length) return []
		const subagents = await Promise.all(relations.map((r) => this.repo.findOneBy({ id: r.subagentId })))
		return subagents.filter((s): s is AgentEntity => s !== null).map((s) => this.toRecord(s))
	}

	private async _withSubagents(agent: AgentRecord): Promise<AgentWithSubagents> {
		const subagents = await this.getSubagents(agent.id)
		return { ...agent, subagents }
	}
}
