import type { ITraceabilityRepository } from '@domain/repositories/traceability.repository.js'

export class GetTemplateUseCase {
  constructor(private readonly repo: ITraceabilityRepository) {}

  async execute(id: string) {
    try {
      const data = await this.repo.findTemplateById(id)
      if (!data) return { success: false as const, error: 'Template not found' }
      return { success: true as const, data }
    } catch (error) {
      return { success: false as const, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }
}

export class GetTemplateByCodeUseCase {
  constructor(private readonly repo: ITraceabilityRepository) {}

  async execute(code: string) {
    try {
      const data = await this.repo.findTemplateByCode(code)
      if (!data) return { success: false as const, error: 'Template not found' }
      return { success: true as const, data }
    } catch (error) {
      return { success: false as const, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }
}
