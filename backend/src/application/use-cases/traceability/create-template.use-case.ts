import type { ITraceabilityRepository } from '@domain/repositories/traceability.repository.js'
import type { CreateTemplateDTO } from '@domain/entities/traceability.entity.js'

export class CreateTemplateUseCase {
  constructor(private readonly repo: ITraceabilityRepository) {}

  async execute(data: CreateTemplateDTO) {
    try {
      const result = await this.repo.createTemplate(data)
      return { success: true as const, data: result }
    } catch (error) {
      return { success: false as const, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }
}
