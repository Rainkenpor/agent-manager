import type { ITraceabilityRepository } from '@domain/repositories/traceability.repository.js'
import type { UserEffort, MyStage } from '@domain/entities/traceability.entity.js'

export class GetUsersByRoleWithEffortUseCase {
	constructor(private readonly repo: ITraceabilityRepository) {}

	async execute(roleId: string): Promise<{ success: true; data: UserEffort[] } | { success: false; error: string }> {
		try {
			const data = await this.repo.getUsersByRoleWithEffort(roleId)
			return { success: true, data }
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			return { success: false, error: message }
		}
	}
}

export class AssignStageUserUseCase {
	constructor(private readonly repo: ITraceabilityRepository) {}

	async execute(
		stageId: string,
		userId: string | null
	): Promise<{ success: true; data: { stageId: string; userId: string | null } } | { success: false; error: string }> {
		try {
			await this.repo.assignUserToStage(stageId, userId)
			return { success: true, data: { stageId, userId } }
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			return { success: false, error: message }
		}
	}
}

export class GetMyStagesUseCase {
	constructor(private readonly repo: ITraceabilityRepository) {}

	async execute(userId: string): Promise<{ success: true; data: MyStage[] } | { success: false; error: string }> {
		try {
			const data = await this.repo.findStagesByUserId(userId)
			return { success: true, data }
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			return { success: false, error: message }
		}
	}
}
