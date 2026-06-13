import type { CreateWebhookDTO, UpdateWebhookDTO, WebhookEntity } from '../entities/webhook.entity.js'

export interface IWebhookRepository {
	findAll(): Promise<WebhookEntity[]>
	findById(id: string): Promise<WebhookEntity | null>
	findByName(name: string): Promise<WebhookEntity | null>
	create(data: CreateWebhookDTO): Promise<WebhookEntity>
	update(id: string, data: UpdateWebhookDTO): Promise<WebhookEntity>
	delete(id: string): Promise<void>
}
