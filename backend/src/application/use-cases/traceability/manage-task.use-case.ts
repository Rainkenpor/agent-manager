import type { ITraceabilityRepository } from '@domain/repositories/traceability.repository.js'
import type { IEventListenerRepository } from '@domain/repositories/event-listener.repository.js'
import type { CreateTaskDTO, UpdateTaskDTO } from '@domain/entities/traceability.entity.js'
import { TraceabilityAgentTriggerService } from '@infra/service/traceability-agent-trigger.service.js'
import { EventListenerExecutorService } from '@infra/service/event-listener-executor.service.js'

export class CreateTaskUseCase {
	constructor(
		private readonly repo: ITraceabilityRepository,
		private readonly triggerService: TraceabilityAgentTriggerService,
		private readonly eventListenerRepo: IEventListenerRepository,
		private readonly eventListenerExecutor: EventListenerExecutorService
	) {}

	async execute(data: CreateTaskDTO) {
		try {
			const { jiraIssueId, ...taskData } = data
			const task = await this.repo.createTask(taskData)
			const stage = await this.repo.recomputeStageStatus(data.stageId)
			if (stage.status === 'completed') {
				this.triggerService.checkAndTrigger(data.stageId).catch(console.error)
			}

			if (jiraIssueId) {
				const listener = await this.eventListenerRepo.create({
					name: `${jiraIssueId} - Update Traceability Task when issue is Finalizada`,
					schedule: '*/15 * * * *',
					source: {
						function_name: 'mcp__atlassia__jira_get_issue',
						params: { issue_key: jiraIssueId }
					},
					condition: {
						field: 'element.fields.status.name',
						operator: '==',
						value: 'Finalizada'
					},
					action: [
						{
							function_name: 'mcp__agent-manager__update_traceability_task',
							params: { id: task.id, status: 'done' }
						},
						{
							function_name: 'mcp__agent-manager__completed_traceability_task',
							params: { id: task.id }
						}
					],
					enabled: true
				})
				this.eventListenerExecutor.scheduleListener(listener)
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

	async execute(data: UpdateTaskDTO, triggerAgents = true) {
		try {
			const task = await this.repo.updateTask(data)
			if (!task) return { success: false as const, error: 'Task not found' }
			const stage = await this.repo.recomputeStageStatus(task.stageId)
			if (stage.status === 'completed' && triggerAgents) {
				this.triggerService.checkAndTrigger(task.stageId).catch(console.error)
			}
			return { success: true as const, data: { task, stage } }
		} catch (error) {
			return { success: false as const, error: error instanceof Error ? error.message : 'Unknown error' }
		}
	}
}

export class CompleteTaskUseCase {
	constructor(
		private readonly repo: ITraceabilityRepository,
		private readonly triggerService: TraceabilityAgentTriggerService
	) {}

	async execute(stageId: string) {
		try {
			const stage = await this.repo.recomputeStageStatus(stageId)
			if (stage.status === 'completed') {
				this.triggerService.checkAndTrigger(stageId).catch(console.error)
			}
			return { success: true as const, data: { stageId } }
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
