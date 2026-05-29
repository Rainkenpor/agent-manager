import type { CreateLinkDTO } from '@domain/entities/traceability.entity.js'
import type { ITraceabilityRepository } from '@domain/repositories/traceability.repository.js'

export class CreateLinkUseCase {
	constructor(private readonly repo: ITraceabilityRepository) {}

	async execute(data: CreateLinkDTO) {
		try {
			const result = await this.repo.createLink(data)
			return { success: true as const, data: result }
		} catch (error) {
			return { success: false as const, error: error instanceof Error ? error.message : 'Unknown error' }
		}
	}
}

export class DeleteLinkUseCase {
	constructor(private readonly repo: ITraceabilityRepository) {}

	async execute(id: string) {
		try {
			await this.repo.deleteLink(id)
			return { success: true as const }
		} catch (error) {
			return { success: false as const, error: error instanceof Error ? error.message : 'Unknown error' }
		}
	}
}

export class GetLinksByStageUseCase {
	constructor(private readonly repo: ITraceabilityRepository) {}

	async execute(stageId: string) {
		try {
			const links = await this.repo.getLinksByStageId(stageId)
			return { success: true as const, data: links }
		} catch (error) {
			return { success: false as const, error: error instanceof Error ? error.message : 'Unknown error' }
		}
	}
}
