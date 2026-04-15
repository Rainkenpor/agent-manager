import type { IEventListenerRepository } from '@domain/repositories/event-listener.repository.js'
import type { EventListener } from '@domain/entities/event-listener.entity.js'

export class ListEventListenersUseCase {
	constructor(private readonly repo: IEventListenerRepository) {}

	async execute(): Promise<{ success: true; data: EventListener[] } | { success: false; error: string }> {
		try {
			const records = await this.repo.findAll()
			return { success: true, data: records }
		} catch (err) {
			return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
		}
	}
}
