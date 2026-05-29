import type { TraceabilityDocument } from '@domain/entities/traceability.entity.js'
import type { ITraceabilityRepository } from '@domain/repositories/traceability.repository.js'

export type TraceabilityByCodeView = 'summary' | 'documents' | 'links' | 'full'

export interface GetTraceabilityByCodeInput {
	code: string
	view?: TraceabilityByCodeView
	stageId?: string
	documentNames?: string[]
}

export class GetTraceabilityByCodeUseCase {
	constructor(private readonly repo: ITraceabilityRepository) {}

	async execute(input: GetTraceabilityByCodeInput) {
		try {
			const traceability = await this.repo.findByCode(input.code)
			if (!traceability) return { success: false as const, error: `No se encontró trazabilidad con código "${input.code}"` }

			const view = input.view ?? 'summary'
			const stages = input.stageId ? traceability.stages.filter((s) => s.id === input.stageId) : traceability.stages

			if (view === 'summary') {
				const docsByStage = await this.groupDocumentsByStage(traceability.id)
				const enriched = await Promise.all(
					stages.map(async (s) => {
						const [tasks, links] = await Promise.all([this.repo.getTasksByStageId(s.id), this.repo.getLinksByStageId(s.id)])
						const documents = docsByStage.get(s.id) ?? []
						return {
							id: s.id,
							name: s.name,
							status: s.status,
							order: s.order,
							role: s.role,
							assignedUserId: s.assignedUserId,
							taskCount: tasks.length,
							completedTasks: tasks.filter((t) => t.status === 'done').length,
							linkCount: links.length,
							documentCount: documents.length,
							documentNames: documents.map((d) => d.name)
						}
					})
				)
				return {
					success: true as const,
					data: {
						id: traceability.id,
						code: traceability.code,
						title: traceability.title,
						description: traceability.description,
						status: traceability.status,
						templateName: traceability.templateName,
						createdAt: traceability.createdAt,
						updatedAt: traceability.updatedAt,
						stages: enriched
					}
				}
			}

			if (view === 'documents') {
				const filterNames = input.documentNames && input.documentNames.length > 0 ? new Set(input.documentNames) : null
				const stageInfo = new Map(stages.map((s) => [s.id, { name: s.name, status: s.status }]))
				// Con filtro de nombres se requiere el contenido completo (getDocumentByStageId lo incluye);
				// sin filtro basta con los metadatos de la trazabilidad (getDocumentByTraceabilityId no carga el contenido).
				const documents = filterNames
					? (await Promise.all(stages.map((s) => this.repo.getDocumentByStageId(s.id)))).flat()
					: (await this.repo.getDocumentByTraceabilityId(traceability.id)).filter((d) => stageInfo.has(d.stageId))
				return {
					success: true as const,
					data: {
						id: traceability.id,
						code: traceability.code,
						title: traceability.title,
						documents: documents
							.filter((d) => !filterNames || filterNames.has(d.name))
							.map((d) => {
								const stage = stageInfo.get(d.stageId)
								return {
									id: d.id,
									name: d.name,
									stageName: stage?.name,
									stageStatus: stage?.status,
									...(filterNames ? { content: d.content } : {}),
									createdAt: d.createdAt,
									updatedAt: d.updatedAt
								}
							})
					}
				}
			}

			if (view === 'links') {
				const links = (
					await Promise.all(
						stages.map(async (s) => {
							const stageLinks = await this.repo.getLinksByStageId(s.id)
							return stageLinks.map((l) => ({ ...l, stageName: s.name, stageStatus: s.status }))
						})
					)
				).flat()
				return {
					success: true as const,
					data: {
						id: traceability.id,
						code: traceability.code,
						title: traceability.title,
						links
					}
				}
			}

			// full
			const fullStages = await Promise.all(
				stages.map(async (s) => {
					const [documents, links, tasks] = await Promise.all([
						this.repo.getDocumentByStageId(s.id),
						this.repo.getLinksByStageId(s.id),
						this.repo.getTasksByStageId(s.id)
					])
					return { ...s, documents, links, tasks }
				})
			)
			return {
				success: true as const,
				data: {
					...traceability,
					stages: fullStages
				}
			}
		} catch (error) {
			return { success: false as const, error: error instanceof Error ? error.message : 'Unknown error' }
		}
	}

	private async groupDocumentsByStage(traceabilityId: string): Promise<Map<string, TraceabilityDocument[]>> {
		const documents = await this.repo.getDocumentByTraceabilityId(traceabilityId)
		const grouped = new Map<string, TraceabilityDocument[]>()
		for (const doc of documents) {
			const list = grouped.get(doc.stageId)
			if (list) list.push(doc)
			else grouped.set(doc.stageId, [doc])
		}
		return grouped
	}
}
