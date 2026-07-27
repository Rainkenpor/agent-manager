import { randomBytes } from 'node:crypto'
import { AppDataSource } from '@infra/db/database.js'
import { WebhookGroupEntity } from '@infra/db/entities.js'
import { v4 as uuidv4 } from 'uuid'
import type {
	CreateWebhookGroupDTO,
	UpdateWebhookGroupDTO,
	WebhookGroupEntity as WebhookGroupDomain
} from '../../domain/entities/webhook-group.entity.js'
import type { IWebhookGroupRepository } from '../../domain/repositories/webhook-group.repository.js'

export class WebhookGroupRepository implements IWebhookGroupRepository {
	private get repo() {
		return AppDataSource.getRepository(WebhookGroupEntity)
	}

	async findAll(): Promise<WebhookGroupDomain[]> {
		const rows = await this.repo.find({ order: { name: 'ASC' } })
		return rows.map(this.mapGroup)
	}

	async findById(id: string): Promise<WebhookGroupDomain | null> {
		const row = await this.repo.findOneBy({ id })
		return row ? this.mapGroup(row) : null
	}

	async findByName(name: string): Promise<WebhookGroupDomain | null> {
		const row = await this.repo.findOneBy({ name })
		return row ? this.mapGroup(row) : null
	}

	async create(data: CreateWebhookGroupDTO): Promise<WebhookGroupDomain> {
		const now = new Date().toISOString()
		const authEnabled = data.authEnabled ?? true
		const entity = this.repo.create({
			id: uuidv4(),
			name: data.name,
			description: data.description ?? null,
			authEnabled,
			secret: authEnabled ? randomBytes(24).toString('hex') : null,
			active: data.active ?? true,
			createdAt: now,
			updatedAt: now
		})
		await this.repo.save(entity)
		return this.mapGroup(await this.repo.findOneByOrFail({ id: entity.id }))
	}

	async update(id: string, data: UpdateWebhookGroupDTO): Promise<WebhookGroupDomain> {
		const updateData: Partial<WebhookGroupEntity> = { updatedAt: new Date().toISOString() }
		if (data.description !== undefined) updateData.description = data.description
		if (data.active !== undefined) updateData.active = data.active
		if (data.authEnabled !== undefined) {
			updateData.authEnabled = data.authEnabled
			if (data.authEnabled) {
				const current = await this.repo.findOneBy({ id })
				if (current && !current.secret) {
					updateData.secret = randomBytes(24).toString('hex')
				}
			}
		}
		await this.repo.update(id, updateData)
		return this.mapGroup(await this.repo.findOneByOrFail({ id }))
	}

	async delete(id: string): Promise<void> {
		await this.repo.delete(id)
	}

	private mapGroup(e: WebhookGroupEntity): WebhookGroupDomain {
		return {
			id: e.id,
			name: e.name,
			description: e.description,
			authEnabled: e.authEnabled,
			secret: e.secret,
			active: e.active,
			createdAt: e.createdAt,
			updatedAt: e.updatedAt
		}
	}
}
