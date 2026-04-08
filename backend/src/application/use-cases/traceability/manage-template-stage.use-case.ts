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
      await this.repo.deleteTemplateStage(id)
      return { success: true as const }
    } catch (error) {
      return { success: false as const, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }
}
