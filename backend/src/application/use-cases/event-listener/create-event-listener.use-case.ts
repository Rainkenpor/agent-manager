import type { IEventListenerRepository } from '@domain/repositories/event-listener.repository.js'
import type { EventListener, CreateEventListenerDTO } from '@domain/entities/event-listener.entity.js'

export class CreateEventListenerUseCase {
	constructor(private readonly repo: IEventListenerRepository) {}

	async execute(
		data: CreateEventListenerDTO
	): Promise<{ success: true; data: EventListener } | { success: false; error: string }> {
		try {
			const record = await this.repo.create(data)
			return { success: true, data: record }
		} catch (err) {
			return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
		}
	}
}
