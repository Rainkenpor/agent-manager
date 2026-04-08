import type { ITraceabilityRepository } from '@domain/repositories/traceability.repository.js'
import type { UpdateTemplateDTO } from '@domain/entities/traceability.entity.js'

export class UpdateTemplateUseCase {
  constructor(private readonly repo: ITraceabilityRepository) {}

  async execute(data: UpdateTemplateDTO) {
    try {
      const result = await this.repo.updateTemplate(data)
      if (!result) return { success: false as const, error: 'Template not found' }
      // Propagate name / description changes to all derived traceabilities
      this.repo.syncTraceabilitiesFromTemplate(data.id).catch(console.error)
      return { success: true as const, data: result }
    } catch (error) {
      return { success: false as const, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }
}
