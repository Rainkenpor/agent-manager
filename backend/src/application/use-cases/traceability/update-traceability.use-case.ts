import type { ITraceabilityRepository } from '@domain/repositories/traceability.repository.js'
import type { UpdateTraceabilityDTO } from '@domain/entities/traceability.entity.js'

export class UpdateTraceabilityUseCase {
  constructor(private readonly repo: ITraceabilityRepository) {}

  async execute(data: UpdateTraceabilityDTO) {
    try {
      const result = await this.repo.update(data)
      if (!result) return { success: false as const, error: 'Traceability not found' }
      return { success: true as const, data: result }
    } catch (error) {
      return { success: false as const, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }
}
