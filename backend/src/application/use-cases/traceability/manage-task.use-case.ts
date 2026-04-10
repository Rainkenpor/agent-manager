import type { ITraceabilityRepository } from '@domain/repositories/traceability.repository.js'
import type { CreateTaskDTO, UpdateTaskDTO } from '@domain/entities/traceability.entity.js'
import { TraceabilityAgentTriggerService } from '@infra/service/traceability-agent-trigger.service.js'

export class CreateTaskUseCase {
	constructor(
		private readonly repo: ITraceabilityRepository,
		private readonly triggerService: TraceabilityAgentTriggerService
	) {}

	async execute(data: CreateTaskDTO) {
		try {
			const task = await this.repo.createTask(data)
			const stage = await this.repo.recomputeStageStatus(data.stageId)
			if (stage.status === 'completed') {
				this.triggerService.checkAndTrigger(data.stageId).catch(console.error)
			}
			return { success: true as const, data: { task, stage } }
		} catch (error) {
			return { success: false as const, error: error instanceof Error ? error.message : 'Unknown error' }
		}
	}
}

export class UpdateTaskUseCase {
	constructor(
		private readonly repo: ITraceabilityRepository,
		private readonly triggerService: TraceabilityAgentTriggerService
	) {}

	async execute(data: UpdateTaskDTO) {
		try {
			const task = await this.repo.updateTask(data)
			if (!task) return { success: false as const, error: 'Task not found' }
			const stage = await this.repo.recomputeStageStatus(task.stageId)
			if (stage.status === 'completed') {
				this.triggerService.checkAndTrigger(task.stageId).catch(console.error)
			}
			return { success: true as const, data: { task, stage } }
		} catch (error) {
			return { success: false as const, error: error instanceof Error ? error.message : 'Unknown error' }
		}
	}
}

export class DeleteTaskUseCase {
	constructor(
		private readonly repo: ITraceabilityRepository,
		private readonly triggerService: TraceabilityAgentTriggerService
	) {}

	async execute(id: string, stageId: string) {
		try {
			await this.repo.deleteTask(id)
			const stage = await this.repo.recomputeStageStatus(stageId)
			if (stage.status === 'completed') {
				this.triggerService.checkAndTrigger(stageId).catch(console.error)
			}
			return { success: true as const, data: { stage } }
		} catch (error) {
			return { success: false as const, error: error instanceof Error ? error.message : 'Unknown error' }
		}
	}
}
