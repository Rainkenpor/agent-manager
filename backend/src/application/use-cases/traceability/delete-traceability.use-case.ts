import type { ITraceabilityRepository } from '@domain/repositories/traceability.repository.js'

export class DeleteTraceabilityUseCase {
  constructor(private readonly repo: ITraceabilityRepository) {}

  async execute(id: string) {
    try {
      await this.repo.delete(id)
      return { success: true as const }
    } catch (error) {
      return { success: false as const, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }
}
