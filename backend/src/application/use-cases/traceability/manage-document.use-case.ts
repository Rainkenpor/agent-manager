import type { ITraceabilityRepository } from '@domain/repositories/traceability.repository.js'
import type { CreateDocumentDTO, UpdateDocumentDTO } from '@domain/entities/traceability.entity.js'

export class CreateDocumentUseCase {
	constructor(private readonly repo: ITraceabilityRepository) {}

	async execute(data: CreateDocumentDTO) {
		try {
			// Validate required sections if the template stage defines a documentSchema
			const templateStage = await this.repo.findTemplateStageByTraceabilityStageId(data.stageId)
			if (templateStage?.documentSchema?.length) {
				const content = data.content ?? ''
				const missing = templateStage.documentSchema
					.filter((s) => s.required)
					.filter((s) => !content.toLowerCase().includes(s.name.toLowerCase()))
				if (missing.length > 0) {
					return {
						success: false as const,
						error: `El documento debe incluir las secciones requeridas: ${missing.map((s) => `"${s.name}"`).join(', ')}`
					}
				}
			}
			const doc = await this.repo.createDocument(data)
			return { success: true as const, data: doc }
		} catch (error) {
			return { success: false as const, error: error instanceof Error ? error.message : 'Unknown error' }
		}
	}
}

export class UpdateDocumentUseCase {
	constructor(private readonly repo: ITraceabilityRepository) {}

	async execute(data: UpdateDocumentDTO) {
		try {
			const doc = await this.repo.updateDocument(data)
			if (!doc) return { success: false as const, error: 'Document not found' }
			return { success: true as const, data: doc }
		} catch (error) {
			return { success: false as const, error: error instanceof Error ? error.message : 'Unknown error' }
		}
	}
}

export class DeleteDocumentUseCase {
	constructor(private readonly repo: ITraceabilityRepository) {}

	async execute(id: string) {
		try {
			await this.repo.deleteDocument(id)
			return { success: true as const }
		} catch (error) {
			return { success: false as const, error: error instanceof Error ? error.message : 'Unknown error' }
		}
	}
}

export class GetDocumentUseCase {
	constructor(private readonly repo: ITraceabilityRepository) {}

	async execute(data: { id?: string; traceabilityId?: string }) {
		try {
			if (data.id) {
				const doc = await this.repo.getDocument(data.id)
				if (!doc) return { success: false as const, error: 'Document not found' }
				return { success: true as const, data: doc }
			}
			if (data.traceabilityId) {
				const docs = await this.repo.getDocumentByTraceabilityId(data.traceabilityId)
				return { success: true as const, data: docs }
			}
		} catch (error) {
			return { success: false as const, error: error instanceof Error ? error.message : 'Unknown error' }
		}
	}
}
