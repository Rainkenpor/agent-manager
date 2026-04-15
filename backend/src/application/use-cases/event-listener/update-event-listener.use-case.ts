import type { IEventListenerRepository } from '@domain/repositories/event-listener.repository.js'
import type { EventListener, UpdateEventListenerDTO } from '@domain/entities/event-listener.entity.js'

export class UpdateEventListenerUseCase {
	constructor(private readonly repo: IEventListenerRepository) {}

	async execute(
		data: UpdateEventListenerDTO
	): Promise<{ success: true; data: EventListener } | { success: false; error: string }> {
		try {
			const existing = await this.repo.findById(data.id)
			if (!existing) return { success: false, error: 'EventListener not found' }
			const record = await this.repo.update(data)
			return { success: true, data: record }
		} catch (err) {
			return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
		}
	}
}
