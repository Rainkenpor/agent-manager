import type { ITraceabilityRepository } from '@domain/repositories/traceability.repository.js'
import type { CreateTraceabilityDTO } from '@domain/entities/traceability.entity.js'

export class CreateTraceabilityUseCase {
  constructor(private readonly repo: ITraceabilityRepository) {}

  async execute(data: CreateTraceabilityDTO) {
    try {
      const result = await this.repo.create(data)
      return { success: true as const, data: result }
    } catch (error) {
      return { success: false as const, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }
}
