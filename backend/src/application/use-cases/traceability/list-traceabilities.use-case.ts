import type { ITraceabilityRepository } from '@domain/repositories/traceability.repository.js'

export class ListTraceabilitiesUseCase {
  constructor(private readonly repo: ITraceabilityRepository) {}

  async execute() {
    try {
      const data = await this.repo.findAll()
      return { success: true as const, data }
    } catch (error) {
      return { success: false as const, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }
}
