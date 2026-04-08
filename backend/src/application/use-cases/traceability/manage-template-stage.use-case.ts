import type { ITraceabilityRepository } from '@domain/repositories/traceability.repository.js'
import type {
  CreateTemplateStageDTO,
  UpdateTemplateStageDTO,
} from '@domain/entities/traceability.entity.js'

export class CreateTemplateStageUseCase {
  constructor(private readonly repo: ITraceabilityRepository) {}

  async execute(data: CreateTemplateStageDTO) {
    try {
      const result = await this.repo.createTemplateStage(data)
      // Propagate new stage to all derived traceabilities
      this.repo.syncTraceabilitiesFromTemplate(data.templateId).catch(console.error)
      return { success: true as const, data: result }
    } catch (error) {
      return { success: false as const, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }
}

export class UpdateTemplateStageUseCase {
  constructor(private readonly repo: ITraceabilityRepository) {}

  async execute(data: UpdateTemplateStageDTO) {
    try {
      const result = await this.repo.updateTemplateStage(data)
      if (!result) return { success: false as const, error: 'Stage not found' }
      // Propagate changes to all derived traceabilities
      this.repo.syncTraceabilitiesFromTemplate(result.templateId).catch(console.error)
      return { success: true as const, data: result }
    } catch (error) {
      return { success: false as const, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }
}

export class DeleteTemplateStageUseCase {
  constructor(private readonly repo: ITraceabilityRepository) {}

  async execute(id: string) {
    try {
      // Fetch templateId before deleting so we can sync afterwards
      const stage = await this.repo.findTemplateStageById(id)
      await this.repo.deleteTemplateStage(id)
      if (stage) this.repo.syncTraceabilitiesFromTemplate(stage.templateId).catch(console.error)
      return { success: true as const }
    } catch (error) {
      return { success: false as const, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }
}
