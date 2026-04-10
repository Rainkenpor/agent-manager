import type { ITraceabilityRepository } from '@domain/repositories/traceability.repository.js'

export class GetTraceabilityUseCase {
  constructor(private readonly repo: ITraceabilityRepository) {}

  async execute(id: string) {
    try {
      const data = await this.repo.findById(id)
      if (!data) return { success: false as const, error: 'Traceability not found' }
      return { success: true as const, data }
    } catch (error) {
      return { success: false as const, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }
}
