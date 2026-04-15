import type { IEventListenerRepository } from '@domain/repositories/event-listener.repository.js'

export class DeleteEventListenerUseCase {
	constructor(private readonly repo: IEventListenerRepository) {}

	async execute(id: string): Promise<{ success: true } | { success: false; error: string }> {
		try {
			const existing = await this.repo.findById(id)
			if (!existing) return { success: false, error: 'EventListener not found' }
			await this.repo.delete(id)
			return { success: true }
		} catch (err) {
			return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
		}
	}
}
