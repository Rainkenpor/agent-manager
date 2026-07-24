import { randomUUID } from 'node:crypto'
import { DEFAULT_WEBHOOK_GROUP } from '@domain/entities/webhook-group.entity.js'
import { AppDataSource } from './database.js'
import { WebhookEntity, WebhookGroupEntity } from './entities.js'

/**
 * Los webhooks creados antes de existir los grupos no tienen `group_id`.
 * Se crea el grupo "default" y se les asigna, para que sigan respondiendo en `/api/default/<webhook>`.
 */
export async function ensureDefaultWebhookGroup(): Promise<void> {
	const groupRepo = AppDataSource.getRepository(WebhookGroupEntity)
	const webhookRepo = AppDataSource.getRepository(WebhookEntity)

	const orphans = await webhookRepo.count({ where: { groupId: null as never } })
	if (orphans === 0) return

	let group = await groupRepo.findOneBy({ name: DEFAULT_WEBHOOK_GROUP })
	if (!group) {
		const now = new Date().toISOString()
		group = await groupRepo.save(
			groupRepo.create({
				id: randomUUID(),
				name: DEFAULT_WEBHOOK_GROUP,
				description: 'Grupo asignado automáticamente a los webhooks creados antes de existir los grupos',
				active: true,
				createdAt: now,
				updatedAt: now
			})
		)
	}

	await webhookRepo.createQueryBuilder().update().set({ groupId: group.id }).where('group_id IS NULL').execute()

	console.log(`✅ ${orphans} webhook(s) migrados al grupo "${DEFAULT_WEBHOOK_GROUP}"`)
}
