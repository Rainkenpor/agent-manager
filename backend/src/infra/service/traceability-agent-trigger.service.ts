import { AgentService } from './agent.service.js'
import type { IAgentRepository, ITraceabilityRepository } from '../../domain/repositories/index.js'

export class TraceabilityAgentTriggerService {
	private readonly agentService: AgentService

	constructor(
		private readonly repo: ITraceabilityRepository,
		private readonly agentRepository: IAgentRepository
	) {
		this.agentService = new AgentService()
	}

	/** Called after a stage transitions to 'completed'. Fire-and-forget. */
	async checkAndTrigger(completedStageId: string): Promise<void> {
		try {
			const readyStages = await this.repo.findReadyAgentStages(completedStageId)
			for (const stage of readyStages) {
				this.runAgentStage(stage).catch((err) => console.error(`[TraceabilityAgentTrigger] Error in stage ${stage.id}:`, err))
			}
		} catch (err) {
			console.error('[TraceabilityAgentTrigger] checkAndTrigger error:', err)
		}
	}

	private async runAgentStage(stage: Awaited<ReturnType<ITraceabilityRepository['findReadyAgentStages']>>[number]): Promise<void> {
		await this.repo.updateStageStatus(stage.id, 'in-review')

		const trac = await this.repo.findById(stage.traceabilityId)
		const context = JSON.stringify(
			{
				traceabilityId: stage.traceabilityId,
				traceabilityTitle: trac?.title,
				traceabilityDescription: trac?.description,
				currentStage: { id: stage.id, name: stage.name, description: stage.description }
			},
			null,
			2
		)

		if (!stage.agentId) {
			console.warn(`[TraceabilityAgentTrigger] Stage ${stage.id} has no agentSlug defined. Skipping.`)
			await this.repo.updateStageStatus(stage.id, 'blocked')
			return
		}

		try {
			const agent = await this.agentRepository.findById(stage.agentId)
			if (!agent) {
				console.warn(`[TraceabilityAgentTrigger] Agent with ID ${stage.agentId} not found for stage ${stage.id}. Skipping.`)
				await this.repo.updateStageStatus(stage.id, 'blocked')
				return
			}
			await this.agentService.executeAgent({
				agentSlug: stage.agentSlug,
				query: `Eres un agente automatizado asignado a la etapa "${stage.name}" de la trazabilidad "${trac?.title ?? stage.traceabilityId}". Revisa el contexto adjunto con toda la información de la trazabilidad, sus etapas y tareas. Completa las tareas de esta etapa (stageId: ${stage.id}) usando las herramientas disponibles (create_traceability_task, update_traceability_task, complete_traceability_task) y actualiza su estado según corresponda.`,
				systemPrompt: `${stage.agentContent} \n\nContexto: ${context}` || undefined,
				allowedTools: new Set(
					Object.entries(agent.tools)
						.filter(([_, enabled]) => enabled)
						.map(([toolName]) => toolName)
				),
				userId: trac?.createdBy ?? undefined
			})
			// After agent completes, recompute the stage status from actual tasks
			await this.repo.recomputeStageStatus(stage.id)
		} catch (err) {
			console.error(`[TraceabilityAgentTrigger] Agent failed for stage ${stage.id}:`, err)
			await this.repo.updateStageStatus(stage.id, 'blocked')
		}
	}
}
