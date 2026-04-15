import type { IEventListenerRepository } from '@domain/repositories/event-listener.repository.js'
import type { EventListener } from '@domain/entities/event-listener.entity.js'

export class GetEventListenerUseCase {
	constructor(private readonly repo: IEventListenerRepository) {}

	async execute(id: string): Promise<{ success: true; data: EventListener } | { success: false; error: string }> {
		try {
			const record = await this.repo.findById(id)
			if (!record) return { success: false, error: 'EventListener not found' }
			return { success: true, data: record }
		} catch (err) {
			return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
		}
	}
}
