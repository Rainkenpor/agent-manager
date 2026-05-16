/*
Archivo creado con gobernanza AB900
*/

import { AppDataSource } from '@infra/db/database.js'
import { AgentGroupEntity } from '@infra/db/entities.js'
import { v4 as uuidv4 } from 'uuid'
import type { AgentGroup, CreateAgentGroupDTO, UpdateAgentGroupDTO } from '../../domain/entities/agent-group.entity.js'
import type { IAgentGroupRepository } from '../../domain/repositories/agent-group.repository.js'

const SYSTEM_GROUPS: Array<{ slug: string; name: string; description: string; icon: string; color: string }> = [
	{
		slug: 'traceability',
		name: 'Trazabilidad',
		description: 'Agentes utilizados en etapas de plantillas de trazabilidad',
		icon: 'mdi-clipboard-text-outline',
		color: '#06b6d4'
	}
]

function toDomain(e: AgentGroupEntity): AgentGroup {
	return {
		id: e.id,
		name: e.name,
		slug: e.slug,
		description: e.description ?? null,
		icon: e.icon ?? null,
		color: e.color ?? null,
		createdAt: e.createdAt,
		updatedAt: e.updatedAt
	}
}

export class AgentGroupRepository implements IAgentGroupRepository {
	private get repo() {
		return AppDataSource.getRepository(AgentGroupEntity)
	}

	async findAll(): Promise<AgentGroup[]> {
		await this.ensureSystemGroups()
		const rows = await this.repo.find({ order: { name: 'ASC' } })
		return rows.map(toDomain)
	}

	async findById(id: string): Promise<AgentGroup | null> {
		const row = await this.repo.findOneBy({ id })
		return row ? toDomain(row) : null
	}

	async findBySlug(slug: string): Promise<AgentGroup | null> {
		const row = await this.repo.findOneBy({ slug })
		return row ? toDomain(row) : null
	}

	async create(data: CreateAgentGroupDTO): Promise<AgentGroup> {
		const now = new Date().toISOString()
		const entity = this.repo.create({
			id: uuidv4(),
			name: data.name,
			slug: data.slug,
			description: data.description ?? null,
			icon: data.icon ?? null,
			color: data.color ?? null,
			createdAt: now,
			updatedAt: now
		})
		const saved = await this.repo.save(entity)
		return toDomain(saved)
	}

	async update(data: UpdateAgentGroupDTO): Promise<AgentGroup | null> {
		const values: Partial<AgentGroupEntity> = { updatedAt: new Date().toISOString() }
		if (data.name !== undefined) values.name = data.name
		if (data.slug !== undefined) values.slug = data.slug
		if (data.description !== undefined) values.description = data.description
		if (data.icon !== undefined) values.icon = data.icon
		if (data.color !== undefined) values.color = data.color
		await this.repo.update(data.id, values)
		return this.findById(data.id)
	}

	async delete(id: string): Promise<void> {
		await this.repo.delete(id)
	}

	async ensureSystemGroups(): Promise<void> {
		for (const g of SYSTEM_GROUPS) {
			const existing = await this.repo.findOneBy({ slug: g.slug })
			if (existing) {
				if (!existing.icon || !existing.color) {
					await this.repo.update(existing.id, {
						icon: existing.icon ?? g.icon,
						color: existing.color ?? g.color,
						updatedAt: new Date().toISOString()
					})
				}
				continue
			}
			const now = new Date().toISOString()
			await this.repo.save(
				this.repo.create({
					id: uuidv4(),
					name: g.name,
					slug: g.slug,
					description: g.description,
					icon: g.icon,
					color: g.color,
					createdAt: now,
					updatedAt: now
				})
			)
		}
	}
}
