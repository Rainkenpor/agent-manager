import { AppDataSource } from '@infra/db/database.js'
import { IntegrationEntity } from '@infra/db/entities.js'
import { v4 as uuidv4 } from 'uuid'
import type {
	CreateIntegrationDTO,
	IntegrationEntity as IntegrationDomain,
	UpdateIntegrationDTO
} from '../../domain/entities/integration.entity.js'
import type { IIntegrationRepository } from '../../domain/repositories/integration.repository.js'

export class IntegrationRepository implements IIntegrationRepository {
	private get repo() {
		return AppDataSource.getRepository(IntegrationEntity)
	}

	async findAll(): Promise<IntegrationDomain[]> {
		const rows = await this.repo.find({ order: { createdAt: 'DESC' } })
		return rows.map(this.mapIntegration)
	}

	async findById(id: string): Promise<IntegrationDomain | null> {
		const row = await this.repo.findOneBy({ id })
		return row ? this.mapIntegration(row) : null
	}

	async findByOrigin(origin: string): Promise<IntegrationDomain | null> {
		const row = await this.repo.findOneBy({ origin })
		return row ? this.mapIntegration(row) : null
	}

	async findByName(name: string): Promise<IntegrationDomain | null> {
		const row = await this.repo.findOneBy({ name })
		return row ? this.mapIntegration(row) : null
	}

	async create(data: CreateIntegrationDTO): Promise<IntegrationDomain> {
		const now = new Date().toISOString()
		const entity = this.repo.create({
			id: uuidv4(),
			name: data.name,
			origin: data.origin,
			agentSlug: data.agentSlug ?? null,
			agentName: data.agentName ?? null,
			scope: data.scope ?? [],
			description: data.description ?? null,
			active: data.active ?? false,
			createdAt: now,
			updatedAt: now
		})
		await this.repo.save(entity)
		return this.mapIntegration(await this.repo.findOneByOrFail({ id: entity.id }))
	}

	async update(id: string, data: UpdateIntegrationDTO): Promise<IntegrationDomain> {
		const updateData: Partial<IntegrationEntity> = { updatedAt: new Date().toISOString() }
		if (data.name !== undefined) updateData.name = data.name
		if (data.agentSlug !== undefined) updateData.agentSlug = data.agentSlug
		if (data.agentName !== undefined) updateData.agentName = data.agentName
		if (data.scope !== undefined) updateData.scope = data.scope
		if (data.description !== undefined) updateData.description = data.description
		if (data.active !== undefined) updateData.active = data.active
		await this.repo.update(id, updateData)
		return this.mapIntegration(await this.repo.findOneByOrFail({ id }))
	}

	async delete(id: string): Promise<void> {
		await this.repo.delete(id)
	}

	private mapIntegration(e: IntegrationEntity): IntegrationDomain {
		return {
			id: e.id,
			name: e.name,
			origin: e.origin,
			agentSlug: e.agentSlug,
			agentName: e.agentName,
			scope: e.scope ?? [],
			description: e.description,
			active: e.active,
			createdAt: e.createdAt,
			updatedAt: e.updatedAt
		}
	}
}
