import type { ITraceabilityRepository } from '@domain/repositories/traceability.repository.js'

export class GetTraceabilityByConversationUseCase {
  constructor(private readonly repo: ITraceabilityRepository) {}

  async execute(chatId: string) {
    try {
      const result = await this.repo.findByConversationId(chatId)
      return { success: true as const, data: result }
    } catch (error) {
      return { success: false as const, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }
}
