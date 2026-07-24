import { randomBytes } from 'node:crypto'
import { AppDataSource } from '@infra/db/database.js'
import { WebhookEntity } from '@infra/db/entities.js'
import { v4 as uuidv4 } from 'uuid'
import type {
	CreateWebhookDTO,
	UpdateWebhookDTO,
	WebhookContractField,
	WebhookEntity as WebhookDomain,
	WebhookMethod
} from '../../domain/entities/webhook.entity.js'
import type { IWebhookRepository } from '../../domain/repositories/webhook.repository.js'

export class WebhookRepository implements IWebhookRepository {
	private get repo() {
		return AppDataSource.getRepository(WebhookEntity)
	}

	async findAll(): Promise<WebhookDomain[]> {
		const rows = await this.repo.find()
		return rows.map(this.mapWebhook)
	}

	async findByGroupId(groupId: string): Promise<WebhookDomain[]> {
		const rows = await this.repo.find({ where: { groupId }, order: { name: 'ASC' } })
		return rows.map(this.mapWebhook)
	}

	async findById(id: string): Promise<WebhookDomain | null> {
		const row = await this.repo.findOneBy({ id })
		return row ? this.mapWebhook(row) : null
	}

	async findByGroupIdAndName(groupId: string, name: string): Promise<WebhookDomain | null> {
		const row = await this.repo.findOneBy({ groupId, name })
		return row ? this.mapWebhook(row) : null
	}

	async create(data: CreateWebhookDTO): Promise<WebhookDomain> {
		const now = new Date().toISOString()
		const authEnabled = data.authEnabled ?? true
		const entity = this.repo.create({
			id: uuidv4(),
			groupId: data.groupId,
			name: data.name,
			description: data.description ?? null,
			method: data.method ?? 'POST',
			targetType: data.targetType,
			targetId: data.targetId,
			targetName: data.targetName,
			extraData: data.extraData ?? null,
			contract: data.contract ?? null,
			authEnabled,
			secret: authEnabled ? randomBytes(24).toString('hex') : null,
			active: data.active ?? true,
			createdAt: now,
			updatedAt: now
		})
		await this.repo.save(entity)
		return this.mapWebhook(await this.repo.findOneByOrFail({ id: entity.id }))
	}

	async update(id: string, data: UpdateWebhookDTO): Promise<WebhookDomain> {
		const updateData: Partial<WebhookEntity> = { updatedAt: new Date().toISOString() }
		if (data.groupId !== undefined) updateData.groupId = data.groupId
		if (data.description !== undefined) updateData.description = data.description
		if (data.method !== undefined) updateData.method = data.method
		if (data.targetType !== undefined) updateData.targetType = data.targetType
		if (data.targetId !== undefined) updateData.targetId = data.targetId
		if (data.targetName !== undefined) updateData.targetName = data.targetName
		if (data.extraData !== undefined) updateData.extraData = data.extraData
		if (data.contract !== undefined) updateData.contract = data.contract
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
		return this.mapWebhook(await this.repo.findOneByOrFail({ id }))
	}

	async delete(id: string): Promise<void> {
		await this.repo.delete(id)
	}

	private mapWebhook(e: WebhookEntity): WebhookDomain {
		return {
			id: e.id,
			groupId: e.groupId,
			name: e.name,
			description: e.description,
			method: e.method as WebhookMethod,
			targetType: e.targetType as 'agent' | 'mcp_tool' | 'llm',
			targetId: e.targetId,
			targetName: e.targetName,
			extraData: e.extraData,
			contract: (e.contract as WebhookContractField[] | null) ?? null,
			authEnabled: e.authEnabled,
			secret: e.secret,
			active: e.active,
			createdAt: e.createdAt,
			updatedAt: e.updatedAt
		}
	}
}
