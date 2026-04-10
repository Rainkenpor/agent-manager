import { db } from '../db/database.js'
import { agents, agentSubagents } from '../db/schema.js'
import { eq, asc } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import type { IAgentRepository } from '@domain/repositories/agent.repository.js'
import type { AgentRecord, AgentWithSubagents, CreateAgentDTO, UpdateAgentDTO } from '../../domain/entities/agent.entity.js'

export class AgentRepository implements IAgentRepository {
	private toRecord(row: typeof agents.$inferSelect): AgentRecord {
		return {
			...row,
			tools: (row.tools as Record<string, boolean>) ?? {}
		}
	}

	async create(data: CreateAgentDTO): Promise<AgentWithSubagents> {
		const id = uuidv4()
		const now = new Date().toISOString()

		await db.insert(agents).values({
			id,
			name: data.name,
			slug: data.slug,
			description: data.description ?? null,
			mode: data.mode,
			model: data.model,
			temperature: data.temperature,
			tools: data.tools as never,
			content: data.content,
			isActive: true,
			createdAt: now,
			updatedAt: now
		})

		if (data.subagentIds?.length) {
			await this.setSubagents(id, data.subagentIds)
		}

		return (await this.findById(id))!
	}

	async findAll(options?: { useByChat?: boolean }): Promise<AgentWithSubagents[]> {
		const rows = await db
			.select()
			.from(agents)
			.where(options?.useByChat !== undefined ? eq(agents.useByChat, options.useByChat) : undefined)
			.orderBy(asc(agents.mode), asc(agents.name))

		return Promise.all(rows.map((r) => this._withSubagents(this.toRecord(r))))
	}

	async findById(id: string): Promise<AgentWithSubagents | undefined> {
		const rows = await db.select().from(agents).where(eq(agents.id, id)).limit(1)

		if (!rows[0]) return undefined
		return this._withSubagents(this.toRecord(rows[0]))
	}

	async findBySlug(slug: string): Promise<AgentWithSubagents | undefined> {
		const rows = await db.select().from(agents).where(eq(agents.slug, slug)).limit(1)

		if (!rows[0]) return undefined
		return this._withSubagents(this.toRecord(rows[0]))
	}

	async update(data: UpdateAgentDTO): Promise<AgentWithSubagents | undefined> {
		const now = new Date().toISOString()
		const updateValues: Partial<typeof agents.$inferInsert> = {
			updatedAt: now
		}

		if (data.name !== undefined) updateValues.name = data.name
		if (data.slug !== undefined) updateValues.slug = data.slug
		if (data.description !== undefined) updateValues.description = data.description
		if (data.mode !== undefined) updateValues.mode = data.mode
		if (data.model !== undefined) updateValues.model = data.model
		if (data.temperature !== undefined) updateValues.temperature = data.temperature
		if (data.tools !== undefined) updateValues.tools = data.tools as never
		if (data.content !== undefined) updateValues.content = data.content
		if (data.isActive !== undefined) updateValues.isActive = data.isActive
		if (data.useByChat !== undefined) updateValues.useByChat = data.useByChat

		await db.update(agents).set(updateValues).where(eq(agents.id, data.id))

		if (data.subagentIds !== undefined) {
			await this.setSubagents(data.id, data.subagentIds)
		}

		return this.findById(data.id)
	}

	async delete(id: string): Promise<boolean> {
		const result = await db.delete(agents).where(eq(agents.id, id))
		return result.changes > 0
	}

	async setSubagents(agentId: string, subagentIds: string[]): Promise<void> {
		await db.delete(agentSubagents).where(eq(agentSubagents.agentId, agentId))

		if (!subagentIds.length) return

		await db.insert(agentSubagents).values(
			subagentIds.map((subagentId, i) => ({
				id: uuidv4(),
				agentId,
				subagentId,
				order: i,
				createdAt: new Date().toISOString()
			}))
		)
	}

	async getSubagents(agentId: string): Promise<AgentRecord[]> {
		const relations = await db.select().from(agentSubagents).where(eq(agentSubagents.agentId, agentId)).orderBy(asc(agentSubagents.order))

		if (!relations.length) return []

		const subagentRows = await Promise.all(
			relations.map((r) =>
				db
					.select()
					.from(agents)
					.where(eq(agents.id, r.subagentId))
					.limit(1)
					.then((rows) => rows[0])
			)
		)

		return subagentRows.filter(Boolean).map((r) => this.toRecord(r))
	}

	private async _withSubagents(agent: AgentRecord): Promise<AgentWithSubagents> {
		const subagents = await this.getSubagents(agent.id)
		return { ...agent, subagents }
	}
}
