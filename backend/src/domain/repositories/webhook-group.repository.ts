import type { CreateWebhookGroupDTO, UpdateWebhookGroupDTO, WebhookGroupEntity } from '../entities/webhook-group.entity.js'

export interface IWebhookGroupRepository {
	findAll(): Promise<WebhookGroupEntity[]>
	findById(id: string): Promise<WebhookGroupEntity | null>
	findByName(name: string): Promise<WebhookGroupEntity | null>
	create(data: CreateWebhookGroupDTO): Promise<WebhookGroupEntity>
	update(id: string, data: UpdateWebhookGroupDTO): Promise<WebhookGroupEntity>
	delete(id: string): Promise<void>
}
