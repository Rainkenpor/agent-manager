import { db } from '../db/database.js'
import {
	traceabilityTemplates,
	templateStages,
	traceabilities,
	traceabilityStages,
	traceabilityTasks,
	traceabilityLinks,
	traceabilityDocuments,
	templateStagePredecessors,
	traceabilityStagePredecessors,
	agents
} from '../db/schema.js'
import { eq, and, inArray } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import type { ITraceabilityRepository } from '../../domain/repositories/traceability.repository.js'
import type {
	TraceabilityTemplate,
	TemplateStage,
	DocumentSection,
	Traceability,
	TraceabilitySummary,
	TraceabilityStage,
	TraceabilityTask,
	TraceabilityLink,
	TraceabilityDocument,
	CreateTemplateDTO,
	UpdateTemplateDTO,
	CreateTemplateStageDTO,
	UpdateTemplateStageDTO,
	CreateTraceabilityDTO,
	UpdateTraceabilityDTO,
	CreateTaskDTO,
	UpdateTaskDTO,
	CreateLinkDTO,
	CreateDocumentDTO,
	UpdateDocumentDTO,
	StageStatus
} from '../../domain/entities/traceability.entity.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateCode(): string {
	return Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('')
}

async function generateUniqueCode(): Promise<string> {
	for (let attempt = 0; attempt < 20; attempt++) {
		const code = generateCode()
		const existing = await db
			.select({ id: traceabilityTemplates.id })
			.from(traceabilityTemplates)
			.where(eq(traceabilityTemplates.code, code))
		if (!existing.length) return code
	}
	throw new Error('Could not generate a unique template code')
}

function parseDocumentSchema(raw: string | null): DocumentSection[] | null {
	if (!raw) return null
	try {
		return JSON.parse(raw) as DocumentSection[]
	} catch {
		return null
	}
}

function serializeDocumentSchema(schema: DocumentSection[] | null | undefined): string | null {
	if (!schema) return null
	return JSON.stringify(schema)
}

function buildTemplate(row: any, stages: TemplateStage[]): TraceabilityTemplate {
	return {
		id: row.id,
		code: row.code ?? null,
		name: row.name,
		description: row.description ?? null,
		stages,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt
	}
}

export class TraceabilityRepository implements ITraceabilityRepository {
	// ─── Templates ──────────────────────────────────────────────────────────────

	async findAllTemplates(): Promise<TraceabilityTemplate[]> {
		const temps = await db.select().from(traceabilityTemplates)
		const stages = await db.select().from(templateStages)
		const allPredecessors = await db.select().from(templateStagePredecessors)
		return temps.map((t) =>
			buildTemplate(
				t,
				stages
					.filter((s) => s.templateId === t.id)
					.sort((a, b) => a.order - b.order)
					.map((s) => ({
						...s,
						type: (s.type ?? 'manual') as 'manual' | 'agent',
						agentId: s.agentId ?? null,
						documentSchema: parseDocumentSchema(s.documentSchema ?? null),
						predecessors: allPredecessors.filter((p) => p.stageId === s.id).map((p) => p.predecessorStageId)
					})) as TemplateStage[]
			)
		)
	}

	async findTemplateById(id: string): Promise<TraceabilityTemplate | null> {
		const rows = await db.select().from(traceabilityTemplates).where(eq(traceabilityTemplates.id, id))
		if (!rows[0]) return null
		const stages = await db.select().from(templateStages).where(eq(templateStages.templateId, id))
		const stageIds = stages.map((s) => s.id)
		const predecessors = stageIds.length
			? await db.select().from(templateStagePredecessors).where(inArray(templateStagePredecessors.stageId, stageIds))
			: []
		return buildTemplate(
			rows[0],
			stages
				.sort((a, b) => a.order - b.order)
				.map((s) => ({
					...s,
					type: (s.type ?? 'manual') as 'manual' | 'agent',
					agentId: s.agentId ?? null,
					documentSchema: parseDocumentSchema(s.documentSchema ?? null),
					predecessors: predecessors.filter((p) => p.stageId === s.id).map((p) => p.predecessorStageId)
				})) as TemplateStage[]
		)
	}

	async findTemplateByCode(code: string): Promise<TraceabilityTemplate | null> {
		const rows = await db.select().from(traceabilityTemplates).where(eq(traceabilityTemplates.code, code.toUpperCase()))
		if (!rows[0]) return null
		return this.findTemplateById(rows[0].id)
	}

	async findTemplateStageByTraceabilityStageId(traceabilityStageId: string): Promise<TemplateStage | null> {
		const stageRows = await db.select().from(traceabilityStages).where(eq(traceabilityStages.id, traceabilityStageId))
		if (!stageRows[0]?.templateStageId) return null
		return this.findTemplateStageById(stageRows[0].templateStageId)
	}

	async createTemplate(data: CreateTemplateDTO): Promise<TraceabilityTemplate> {
		const id = uuidv4()
		const code = await generateUniqueCode()
		const now = new Date().toISOString()
		await db
			.insert(traceabilityTemplates)
			.values({ id, code, name: data.name, description: data.description ?? null, createdAt: now, updatedAt: now })
		return { id, code, name: data.name, description: data.description ?? null, stages: [], createdAt: now, updatedAt: now }
	}

	async updateTemplate(data: UpdateTemplateDTO): Promise<TraceabilityTemplate | null> {
		const now = new Date().toISOString()
		const { id, ...rest } = data
		await db
			.update(traceabilityTemplates)
			.set({ ...rest, updatedAt: now })
			.where(eq(traceabilityTemplates.id, id))
		return this.findTemplateById(id)
	}

	async deleteTemplate(id: string): Promise<void> {
		await db.delete(traceabilityTemplates).where(eq(traceabilityTemplates.id, id))
	}

	// ─── Template Stages ────────────────────────────────────────────────────────

	async createTemplateStage(data: CreateTemplateStageDTO): Promise<TemplateStage> {
		const id = uuidv4()
		const now = new Date().toISOString()
		const row = {
			id,
			templateId: data.templateId,
			name: data.name,
			description: data.description ?? null,
			role: data.role ?? null,
			order: data.order,
			parallelGroup: data.parallelGroup ?? null,
			type: (data.type ?? 'manual') as 'manual' | 'agent',
			agentId: data.agentId ?? null,
			documentSchema: serializeDocumentSchema(data.documentSchema ?? null),
			createdAt: now
		}
		await db.insert(templateStages).values(row)
		// Insert predecessors if provided
		if (data.predecessors && data.predecessors.length > 0) {
			for (const predId of data.predecessors) {
				await db.insert(templateStagePredecessors).values({
					id: uuidv4(),
					stageId: id,
					predecessorStageId: predId
				})
			}
		}
		return {
			...row,
			documentSchema: data.documentSchema ?? null,
			predecessors: data.predecessors ?? []
		} as TemplateStage
	}

	async updateTemplateStage(data: UpdateTemplateStageDTO): Promise<TemplateStage | null> {
		const { id, predecessors, documentSchema: ds, ...rest } = data
		const updatePayload: Record<string, unknown> = { ...rest }
		if (ds !== undefined) updatePayload.documentSchema = serializeDocumentSchema(ds)
		await db.update(templateStages).set(updatePayload).where(eq(templateStages.id, id))
		// Replace predecessors if provided
		if (predecessors !== undefined) {
			await db.delete(templateStagePredecessors).where(eq(templateStagePredecessors.stageId, id))
			for (const predId of predecessors) {
				await db.insert(templateStagePredecessors).values({
					id: uuidv4(),
					stageId: id,
					predecessorStageId: predId
				})
			}
		}
		const rows = await db.select().from(templateStages).where(eq(templateStages.id, id))
		if (!rows[0]) return null
		const predRows = await db.select().from(templateStagePredecessors).where(eq(templateStagePredecessors.stageId, id))
		return {
			...rows[0],
			type: (rows[0].type ?? 'manual') as 'manual' | 'agent',
			agentId: rows[0].agentId ?? null,
			documentSchema: parseDocumentSchema(rows[0].documentSchema ?? null),
			predecessors: predRows.map((p) => p.predecessorStageId)
		} as TemplateStage
	}

	async deleteTemplateStage(id: string): Promise<void> {
		await db.delete(templateStages).where(eq(templateStages.id, id))
	}

	async findTemplateStageById(id: string): Promise<TemplateStage | null> {
		const rows = await db.select().from(templateStages).where(eq(templateStages.id, id))
		if (!rows[0]) return null
		const preds = await db.select().from(templateStagePredecessors).where(eq(templateStagePredecessors.stageId, id))
		return {
			...rows[0],
			type: (rows[0].type ?? 'manual') as 'manual' | 'agent',
			agentId: rows[0].agentId ?? null,
			documentSchema: parseDocumentSchema(rows[0].documentSchema ?? null),
			predecessors: preds.map((p) => p.predecessorStageId)
		} as TemplateStage
	}

	async syncTraceabilitiesFromTemplate(templateId: string): Promise<void> {
		const template = await this.findTemplateById(templateId)
		if (!template) return

		const tracRows = await db.select().from(traceabilities).where(eq(traceabilities.templateId, templateId))

		for (const trac of tracRows) {
			const now = new Date().toISOString()

			// Snapshot updated template name
			await db.update(traceabilities).set({ templateName: template.name, updatedAt: now }).where(eq(traceabilities.id, trac.id))

			// Load existing traceability stages
			const existingStages = await db.select().from(traceabilityStages).where(eq(traceabilityStages.traceabilityId, trac.id))

			// Build map templateStageId → traceabilityStageId
			const tplToTrac = new Map<string, string>()
			for (const es of existingStages) {
				if (es.templateStageId) tplToTrac.set(es.templateStageId, es.id)
			}

			const templateStageIds = new Set(template.stages.map((ts) => ts.id))

			// ── Pass 1: create new stages, update existing ones ──────────────────
			for (const ts of template.stages) {
				const existing = existingStages.find((s) => s.templateStageId === ts.id)
				if (existing) {
					await db
						.update(traceabilityStages)
						.set({
							name: ts.name,
							description: ts.description ?? null,
							role: ts.role ?? null,
							order: ts.order,
							parallelGroup: ts.parallelGroup ?? null,
							type: ts.type ?? 'manual',
							agentId: ts.agentId ?? null,
							updatedAt: now
						})
						.where(eq(traceabilityStages.id, existing.id))
				} else {
					const newId = uuidv4()
					await db.insert(traceabilityStages).values({
						id: newId,
						traceabilityId: trac.id,
						templateStageId: ts.id,
						name: ts.name,
						description: ts.description ?? null,
						role: ts.role ?? null,
						order: ts.order,
						parallelGroup: ts.parallelGroup ?? null,
						type: ts.type ?? 'manual',
						agentId: ts.agentId ?? null,
						status: 'pending',
						createdAt: now,
						updatedAt: now
					})
					tplToTrac.set(ts.id, newId)
				}
			}

			// Delete stages removed from template (cascade removes tasks/links/predecessors)
			for (const es of existingStages) {
				if (es.templateStageId && !templateStageIds.has(es.templateStageId)) {
					await db.delete(traceabilityStages).where(eq(traceabilityStages.id, es.id))
				}
			}

			// ── Pass 2: sync predecessors (map is now complete) ──────────────────
			for (const ts of template.stages) {
				const tracStageId = tplToTrac.get(ts.id)
				if (!tracStageId) continue
				await db.delete(traceabilityStagePredecessors).where(eq(traceabilityStagePredecessors.stageId, tracStageId))
				for (const predTplId of ts.predecessors) {
					const predTracId = tplToTrac.get(predTplId)
					if (predTracId) {
						await db.insert(traceabilityStagePredecessors).values({
							id: uuidv4(),
							stageId: tracStageId,
							predecessorStageId: predTracId
						})
					}
				}
			}
		}
	}

	// ─── Traceabilities ─────────────────────────────────────────────────────────

	async findAll(): Promise<TraceabilitySummary[]> {
		const rows = await db.select().from(traceabilities)
		const allStages = await db.select().from(traceabilityStages)
		return rows.map((t) => {
			const stages = allStages.filter((s) => s.traceabilityId === t.id)
			return {
				id: t.id,
				title: t.title,
				description: t.description,
				status: t.status as TraceabilitySummary['status'],
				templateId: t.templateId,
				templateName: t.templateName,
				createdBy: t.createdBy,
				stageCount: stages.length,
				completedStages: stages.filter((s) => s.status === 'completed').length,
				createdAt: t.createdAt,
				updatedAt: t.updatedAt
			}
		})
	}

	async findById(id: string): Promise<Traceability | null> {
		const rows = await db.select().from(traceabilities).where(eq(traceabilities.id, id))
		if (!rows[0]) return null
		const t = rows[0]
		const stages = await db.select().from(traceabilityStages).where(eq(traceabilityStages.traceabilityId, id))
		// Fetch all tasks, links, documents, and predecessors for all stages
		const allTasks: TraceabilityTask[] = []
		const allLinks: TraceabilityLink[] = []
		const allDocuments: TraceabilityDocument[] = []
		const allPredecessors: Array<{ stageId: string; predecessorStageId: string }> = []
		for (const stage of stages) {
			const stageTasks = await db.select().from(traceabilityTasks).where(eq(traceabilityTasks.stageId, stage.id))
			const stageLinks = await db.select().from(traceabilityLinks).where(eq(traceabilityLinks.stageId, stage.id))
			const stageDocs = await db.select().from(traceabilityDocuments).where(eq(traceabilityDocuments.stageId, stage.id))
			const stagePreds = await db.select().from(traceabilityStagePredecessors).where(eq(traceabilityStagePredecessors.stageId, stage.id))
			allTasks.push(...(stageTasks as TraceabilityTask[]))
			allLinks.push(...(stageLinks as TraceabilityLink[]))
			allDocuments.push(...(stageDocs as TraceabilityDocument[]))
			allPredecessors.push(...stagePreds)
		}
		const stageList: TraceabilityStage[] = stages
			.sort((a, b) => a.order - b.order)
			.map((s) => ({
				id: s.id,
				traceabilityId: s.traceabilityId,
				templateStageId: s.templateStageId,
				name: s.name,
				description: s.description,
				role: s.role,
				order: s.order,
				parallelGroup: s.parallelGroup,
				type: (s.type ?? 'manual') as 'manual' | 'agent',
				agentId: s.agentId ?? null,
				predecessors: allPredecessors.filter((p) => p.stageId === s.id).map((p) => p.predecessorStageId),
				status: s.status as StageStatus,
				tasks: allTasks.filter((tk) => tk.stageId === s.id),
				links: allLinks.filter((lk) => lk.stageId === s.id),
				documents: allDocuments.filter((d) => d.stageId === s.id),
				createdAt: s.createdAt,
				updatedAt: s.updatedAt
			}))
		return {
			id: t.id,
			title: t.title,
			description: t.description,
			status: t.status as Traceability['status'],
			templateId: t.templateId,
			templateName: t.templateName,
			createdBy: t.createdBy,
			stages: stageList,
			createdAt: t.createdAt,
			updatedAt: t.updatedAt
		}
	}

	async create(data: CreateTraceabilityDTO): Promise<Traceability> {
		const id = uuidv4()
		const now = new Date().toISOString()
		// Get template to snapshot its name and stages
		const template = await this.findTemplateById(data.templateId)
		if (!template) throw new Error(`Template ${data.templateId} not found`)
		await db.insert(traceabilities).values({
			id,
			title: data.title,
			description: data.description ?? null,
			status: 'active',
			templateId: data.templateId,
			templateName: template.name,
			createdBy: data.createdBy ?? null,
			createdAt: now,
			updatedAt: now
		})
		// Create stage instances from template stages
		// Build a map templateStageId → new traceability stageId for predecessor remapping
		const stageIdMap = new Map<string, string>()
		const stageList: TraceabilityStage[] = []

		for (const ts of template.stages) {
			const stageId = uuidv4()
			stageIdMap.set(ts.id, stageId)
			await db.insert(traceabilityStages).values({
				id: stageId,
				traceabilityId: id,
				templateStageId: ts.id,
				name: ts.name,
				description: ts.description ?? null,
				role: ts.role ?? null,
				order: ts.order,
				parallelGroup: ts.parallelGroup ?? null,
				type: ts.type ?? 'manual',
				agentId: ts.agentId ?? null,
				status: 'pending',
				createdAt: now,
				updatedAt: now
			})
			stageList.push({
				id: stageId,
				traceabilityId: id,
				templateStageId: ts.id,
				name: ts.name,
				description: ts.description,
				role: ts.role,
				order: ts.order,
				parallelGroup: ts.parallelGroup,
				type: ts.type ?? 'manual',
				agentId: ts.agentId ?? null,
				predecessors: [],
				status: 'pending',
				tasks: [],
				links: [],
				documents: [],
				createdAt: now,
				updatedAt: now
			})
		}

		// Insert predecessor relationships using mapped IDs
		for (const ts of template.stages) {
			const newStageId = stageIdMap.get(ts.id)
			if (!newStageId) continue
			for (const predTemplateStageId of ts.predecessors) {
				const newPredId = stageIdMap.get(predTemplateStageId)
				if (!newPredId) continue
				await db.insert(traceabilityStagePredecessors).values({
					id: uuidv4(),
					stageId: newStageId,
					predecessorStageId: newPredId
				})
			}
			// Update the stageList entry with remapped predecessors
			const stageEntry = stageList.find((s) => s.id === newStageId)
			if (stageEntry) {
				stageEntry.predecessors = ts.predecessors.map((pid) => stageIdMap.get(pid)).filter((pid): pid is string => pid !== undefined)
			}
		}

		return {
			id,
			title: data.title,
			description: data.description ?? null,
			status: 'active',
			templateId: data.templateId,
			templateName: template.name,
			createdBy: data.createdBy ?? null,
			stages: stageList,
			createdAt: now,
			updatedAt: now
		}
	}

	async update(data: UpdateTraceabilityDTO): Promise<Traceability | null> {
		const now = new Date().toISOString()
		const { id, ...rest } = data
		await db
			.update(traceabilities)
			.set({ ...rest, updatedAt: now })
			.where(eq(traceabilities.id, id))
		return this.findById(id)
	}

	async delete(id: string): Promise<void> {
		await db.delete(traceabilities).where(eq(traceabilities.id, id))
	}

	// ─── Stage status ────────────────────────────────────────────────────────────

	async recomputeStageStatus(stageId: string): Promise<TraceabilityStage> {
		const tasks = await db.select().from(traceabilityTasks).where(eq(traceabilityTasks.stageId, stageId))
		let newStatus: StageStatus = 'pending'
		if (tasks.length > 0) {
			const allDone = tasks.every((t) => t.status === 'done')
			const anyBlocked = tasks.some((t) => t.status === 'blocked')
			const anyInReview = tasks.some((t) => t.status === 'in-progress')
			if (allDone) newStatus = 'completed'
			else if (anyBlocked) newStatus = 'blocked'
			else if (anyInReview) newStatus = 'in-review'
			else newStatus = 'active'
		}
		const now = new Date().toISOString()
		await db.update(traceabilityStages).set({ status: newStatus, updatedAt: now }).where(eq(traceabilityStages.id, stageId))
		const rows = await db.select().from(traceabilityStages).where(eq(traceabilityStages.id, stageId))
		const s = rows[0]!
		const links = await db.select().from(traceabilityLinks).where(eq(traceabilityLinks.stageId, stageId))
		const documents = await db.select().from(traceabilityDocuments).where(eq(traceabilityDocuments.stageId, stageId))
		const predRows = await db.select().from(traceabilityStagePredecessors).where(eq(traceabilityStagePredecessors.stageId, stageId))
		return {
			id: s.id,
			traceabilityId: s.traceabilityId,
			templateStageId: s.templateStageId,
			name: s.name,
			description: s.description,
			role: s.role,
			order: s.order,
			parallelGroup: s.parallelGroup,
			type: (s.type ?? 'manual') as 'manual' | 'agent',
			agentId: s.agentId ?? null,
			predecessors: predRows.map((p) => p.predecessorStageId),
			status: newStatus,
			tasks: tasks as TraceabilityTask[],
			links: links as TraceabilityLink[],
			documents: documents as TraceabilityDocument[],
			createdAt: s.createdAt,
			updatedAt: now
		}
	}

	async findReadyAgentStages(completedStageId: string): Promise<Array<TraceabilityStage & { agentSlug: string; agentContent: string }>> {
		// 1. Find stages that have completedStageId as a predecessor
		const successorRels = await db
			.select()
			.from(traceabilityStagePredecessors)
			.where(eq(traceabilityStagePredecessors.predecessorStageId, completedStageId))

		if (!successorRels.length) return []

		const successorIds = successorRels.map((r) => r.stageId)

		// 2. Load those stages, filter for agent type
		const successorStages = await db
			.select()
			.from(traceabilityStages)
			.where(and(inArray(traceabilityStages.id, successorIds), eq(traceabilityStages.type, 'agent')))

		const result: Array<TraceabilityStage & { agentSlug: string; agentContent: string }> = []

		for (const stage of successorStages) {
			if (!stage.agentId) continue

			// 3. Check ALL predecessors of this stage are completed
			const allPreds = await db.select().from(traceabilityStagePredecessors).where(eq(traceabilityStagePredecessors.stageId, stage.id))
			const predIds = allPreds.map((p) => p.predecessorStageId)
			if (!predIds.length) continue

			const predStages = await db.select().from(traceabilityStages).where(inArray(traceabilityStages.id, predIds))
			const allCompleted = predStages.every((p) => p.status === 'completed')
			if (!allCompleted) continue

			// 4. Load agent info
			const agentRows = await db.select().from(agents).where(eq(agents.id, stage.agentId))
			if (!agentRows[0] || !agentRows[0].isActive) continue

			// 5. Build full stage object
			const stageTasks = await db.select().from(traceabilityTasks).where(eq(traceabilityTasks.stageId, stage.id))
			const stageLinks = await db.select().from(traceabilityLinks).where(eq(traceabilityLinks.stageId, stage.id))

			result.push({
				id: stage.id,
				traceabilityId: stage.traceabilityId,
				templateStageId: stage.templateStageId,
				name: stage.name,
				description: stage.description,
				role: stage.role,
				order: stage.order,
				parallelGroup: stage.parallelGroup,
				type: stage.type as 'agent',
				agentId: stage.agentId,
				status: stage.status as StageStatus,
				predecessors: predIds,
				tasks: stageTasks as TraceabilityTask[],
				links: stageLinks as TraceabilityLink[],
				documents: [],
				createdAt: stage.createdAt,
				updatedAt: stage.updatedAt,
				agentSlug: agentRows[0].slug,
				agentContent: agentRows[0].content
			})
		}

		return result
	}

	async updateStageStatus(stageId: string, status: StageStatus): Promise<void> {
		await db.update(traceabilityStages).set({ status, updatedAt: new Date().toISOString() }).where(eq(traceabilityStages.id, stageId))
	}

	// ─── Tasks ───────────────────────────────────────────────────────────────────

	async createTask(data: CreateTaskDTO): Promise<TraceabilityTask> {
		const id = uuidv4()
		const now = new Date().toISOString()
		const row = {
			id,
			stageId: data.stageId,
			title: data.title,
			description: data.description ?? null,
			type: data.type ?? 'task',
			status: data.status ?? 'todo',
			createdAt: now,
			updatedAt: now
		}
		await db.insert(traceabilityTasks).values(row)
		return row as TraceabilityTask
	}

	async updateTask(data: UpdateTaskDTO): Promise<TraceabilityTask | null> {
		const now = new Date().toISOString()
		const { id, ...rest } = data
		await db
			.update(traceabilityTasks)
			.set({ ...rest, updatedAt: now })
			.where(eq(traceabilityTasks.id, id))
		const rows = await db.select().from(traceabilityTasks).where(eq(traceabilityTasks.id, id))
		return (rows[0] as TraceabilityTask) ?? null
	}

	async deleteTask(id: string): Promise<void> {
		await db.delete(traceabilityTasks).where(eq(traceabilityTasks.id, id))
	}

	// ─── Links ───────────────────────────────────────────────────────────────────

	async createLink(data: CreateLinkDTO): Promise<TraceabilityLink> {
		const id = uuidv4()
		const now = new Date().toISOString()
		const row = {
			id,
			stageId: data.stageId,
			label: data.label,
			url: data.url,
			platform: data.platform ?? 'generic',
			createdAt: now
		}
		await db.insert(traceabilityLinks).values(row)
		return row as TraceabilityLink
	}

	async deleteLink(id: string): Promise<void> {
		await db.delete(traceabilityLinks).where(eq(traceabilityLinks.id, id))
	}

	// ─── Documents ───────────────────────────────────────────────────────────────

	async createDocument(data: CreateDocumentDTO): Promise<TraceabilityDocument> {
		const id = uuidv4()
		const now = new Date().toISOString()
		const row = {
			id,
			stageId: data.stageId,
			name: data.name,
			content: data.content ?? '',
			createdAt: now,
			updatedAt: now
		}
		await db.insert(traceabilityDocuments).values(row)
		return row as TraceabilityDocument
	}

	async updateDocument(data: UpdateDocumentDTO): Promise<TraceabilityDocument | null> {
		const now = new Date().toISOString()
		const { id, ...rest } = data
		await db
			.update(traceabilityDocuments)
			.set({ ...rest, updatedAt: now })
			.where(eq(traceabilityDocuments.id, id))
		const rows = await db.select().from(traceabilityDocuments).where(eq(traceabilityDocuments.id, id))
		return (rows[0] as TraceabilityDocument) ?? null
	}

	async deleteDocument(id: string): Promise<void> {
		await db.delete(traceabilityDocuments).where(eq(traceabilityDocuments.id, id))
	}

	async getDocument(id: string): Promise<TraceabilityDocument | null> {
		const rows = await db.select().from(traceabilityDocuments).where(eq(traceabilityDocuments.id, id))
		return (rows[0] as TraceabilityDocument) ?? null
	}

	async getDocumentByTraceabilityId(traceabilityId: string): Promise<TraceabilityDocument[]> {
		const stageRows = await db.select().from(traceabilityStages).where(eq(traceabilityStages.traceabilityId, traceabilityId))
		const stageIds = stageRows.map((s) => s.id)
		if (!stageIds.length) return []
		const docRows = await db.select().from(traceabilityDocuments).where(inArray(traceabilityDocuments.stageId, stageIds))
		return docRows as TraceabilityDocument[]
	}
}
