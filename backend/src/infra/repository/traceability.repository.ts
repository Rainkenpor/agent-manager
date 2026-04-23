import { AppDataSource } from '@infra/db/database.js'
import {
	TraceabilityTemplateEntity,
	TemplateStageEntity,
	TemplateStagePredecessorEntity,
	TraceabilityEntity,
	TraceabilityStageEntity,
	TraceabilityStagePredecessorEntity,
	TraceabilityTaskEntity,
	TraceabilityLinkEntity,
	TraceabilityDocumentEntity,
	AgentEntity,
	UserEntity,
	UserRoleEntity
} from '@infra/db/entities.js'
import { In, Not } from 'typeorm'
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
	UserEffort,
	MyStage,
	TraceabilityStatus,
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
	const repo = AppDataSource.getRepository(TraceabilityTemplateEntity)
	for (let attempt = 0; attempt < 20; attempt++) {
		const code = generateCode()
		const existing = await repo.findOneBy({ code })
		if (!existing) return code
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

function buildTemplate(row: TraceabilityTemplateEntity, stages: TemplateStage[]): TraceabilityTemplate {
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
		const tplRepo = AppDataSource.getRepository(TraceabilityTemplateEntity)
		const stageRepo = AppDataSource.getRepository(TemplateStageEntity)
		const predRepo = AppDataSource.getRepository(TemplateStagePredecessorEntity)

		const temps = await tplRepo.find()
		const stages = await stageRepo.find()
		const allPredecessors = await predRepo.find()

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
						effortScore: s.effortScore ?? 5,
						predecessors: allPredecessors.filter((p) => p.stageId === s.id).map((p) => p.predecessorStageId)
					})) as TemplateStage[]
			)
		)
	}

	async findTemplateById(id: string): Promise<TraceabilityTemplate | null> {
		const tplRepo = AppDataSource.getRepository(TraceabilityTemplateEntity)
		const stageRepo = AppDataSource.getRepository(TemplateStageEntity)
		const predRepo = AppDataSource.getRepository(TemplateStagePredecessorEntity)

		const tpl = await tplRepo.findOneBy({ id })
		if (!tpl) return null

		const stages = await stageRepo.findBy({ templateId: id })
		const stageIds = stages.map((s) => s.id)
		const predecessors = stageIds.length ? await predRepo.findBy({ stageId: In(stageIds) }) : []

		return buildTemplate(
			tpl,
			stages
				.sort((a, b) => a.order - b.order)
				.map((s) => ({
					...s,
					type: (s.type ?? 'manual') as 'manual' | 'agent',
					agentId: s.agentId ?? null,
					documentSchema: parseDocumentSchema(s.documentSchema ?? null),
					effortScore: s.effortScore ?? 5,
					predecessors: predecessors.filter((p) => p.stageId === s.id).map((p) => p.predecessorStageId)
				})) as TemplateStage[]
		)
	}

	async findTemplateByCode(code: string): Promise<TraceabilityTemplate | null> {
		const tplRepo = AppDataSource.getRepository(TraceabilityTemplateEntity)
		const tpl = await tplRepo.findOneBy({ code: code.toUpperCase() })
		if (!tpl) return null
		return this.findTemplateById(tpl.id)
	}

	async findTemplateStageByTraceabilityStageId(traceabilityStageId: string): Promise<TemplateStage | null> {
		const stageRepo = AppDataSource.getRepository(TraceabilityStageEntity)
		const stage = await stageRepo.findOneBy({ id: traceabilityStageId })
		if (!stage?.templateStageId) return null
		return this.findTemplateStageById(stage.templateStageId)
	}

	async createTemplate(data: CreateTemplateDTO): Promise<TraceabilityTemplate> {
		const tplRepo = AppDataSource.getRepository(TraceabilityTemplateEntity)
		const id = uuidv4()
		const code = await generateUniqueCode()
		const now = new Date().toISOString()
		await tplRepo.save(tplRepo.create({ id, code, name: data.name, description: data.description ?? null, createdAt: now, updatedAt: now }))
		return { id, code, name: data.name, description: data.description ?? null, stages: [], createdAt: now, updatedAt: now }
	}

	async updateTemplate(data: UpdateTemplateDTO): Promise<TraceabilityTemplate | null> {
		const tplRepo = AppDataSource.getRepository(TraceabilityTemplateEntity)
		const { id, ...rest } = data
		await tplRepo.update(id, { ...rest, updatedAt: new Date().toISOString() })
		return this.findTemplateById(id)
	}

	async deleteTemplate(id: string): Promise<void> {
		const tplRepo = AppDataSource.getRepository(TraceabilityTemplateEntity)
		await tplRepo.delete(id)
	}

	// ─── Template Stages ────────────────────────────────────────────────────────

	async createTemplateStage(data: CreateTemplateStageDTO): Promise<TemplateStage> {
		const stageRepo = AppDataSource.getRepository(TemplateStageEntity)
		const predRepo = AppDataSource.getRepository(TemplateStagePredecessorEntity)
		const id = uuidv4()
		const now = new Date().toISOString()
		const entity = stageRepo.create({
			id,
			templateId: data.templateId,
			name: data.name,
			description: data.description ?? null,
			role: data.role ?? null,
			order: data.order,
			parallelGroup: data.parallelGroup ?? null,
			type: (data.type ?? 'manual') as string,
			agentId: data.agentId ?? null,
			documentSchema: serializeDocumentSchema(data.documentSchema ?? null),
			effortScore: data.effortScore ?? 5,
			createdAt: now
		})
		await stageRepo.save(entity)
		if (data.predecessors?.length) {
			const preds = data.predecessors.map((predId) =>
				predRepo.create({ id: uuidv4(), stageId: id, predecessorStageId: predId })
			)
			await predRepo.save(preds)
		}
		return {
			...entity,
			documentSchema: data.documentSchema ?? null,
			predecessors: data.predecessors ?? []
		} as TemplateStage
	}

	async updateTemplateStage(data: UpdateTemplateStageDTO): Promise<TemplateStage | null> {
		const stageRepo = AppDataSource.getRepository(TemplateStageEntity)
		const predRepo = AppDataSource.getRepository(TemplateStagePredecessorEntity)
		const { id, predecessors, documentSchema: ds, effortScore, ...rest } = data
		const updatePayload: Record<string, unknown> = { ...rest }
		if (ds !== undefined) updatePayload.documentSchema = serializeDocumentSchema(ds)
		if (effortScore !== undefined) updatePayload.effortScore = effortScore
		await stageRepo.update(id, updatePayload)
		if (predecessors !== undefined) {
			await predRepo.delete({ stageId: id })
			if (predecessors.length) {
				const preds = predecessors.map((predId) =>
					predRepo.create({ id: uuidv4(), stageId: id, predecessorStageId: predId })
				)
				await predRepo.save(preds)
			}
		}
		const row = await stageRepo.findOneBy({ id })
		if (!row) return null
		const predRows = await predRepo.findBy({ stageId: id })
		return {
			...row,
			type: (row.type ?? 'manual') as 'manual' | 'agent',
			agentId: row.agentId ?? null,
			documentSchema: parseDocumentSchema(row.documentSchema ?? null),
			predecessors: predRows.map((p) => p.predecessorStageId)
		} as TemplateStage
	}

	async deleteTemplateStage(id: string): Promise<void> {
		const stageRepo = AppDataSource.getRepository(TemplateStageEntity)
		await stageRepo.delete(id)
	}

	async findTemplateStageById(id: string): Promise<TemplateStage | null> {
		const stageRepo = AppDataSource.getRepository(TemplateStageEntity)
		const predRepo = AppDataSource.getRepository(TemplateStagePredecessorEntity)
		const row = await stageRepo.findOneBy({ id })
		if (!row) return null
		const preds = await predRepo.findBy({ stageId: id })
		return {
			...row,
			type: (row.type ?? 'manual') as 'manual' | 'agent',
			agentId: row.agentId ?? null,
			documentSchema: parseDocumentSchema(row.documentSchema ?? null),
			effortScore: row.effortScore ?? 5,
			predecessors: preds.map((p) => p.predecessorStageId)
		} as TemplateStage
	}

	async syncTraceabilitiesFromTemplate(templateId: string): Promise<void> {
		const tplRepo = AppDataSource.getRepository(TraceabilityTemplateEntity)
		const tracRepo = AppDataSource.getRepository(TraceabilityEntity)
		const tsRepo = AppDataSource.getRepository(TraceabilityStageEntity)
		const tspRepo = AppDataSource.getRepository(TraceabilityStagePredecessorEntity)

		const template = await this.findTemplateById(templateId)
		if (!template) return

		const tracRows = await tracRepo.findBy({ templateId })

		for (const trac of tracRows) {
			const now = new Date().toISOString()
			await tracRepo.update(trac.id, { templateName: template.name, updatedAt: now })

			const existingStages = await tsRepo.findBy({ traceabilityId: trac.id })
			const tplToTrac = new Map<string, string>()
			for (const es of existingStages) {
				if (es.templateStageId) tplToTrac.set(es.templateStageId, es.id)
			}

			const templateStageIds = new Set(template.stages.map((ts) => ts.id))

			for (const ts of template.stages) {
				const existing = existingStages.find((s) => s.templateStageId === ts.id)
				if (existing) {
					await tsRepo.update(existing.id, {
						name: ts.name,
						description: ts.description ?? null,
						role: ts.role ?? null,
						order: ts.order,
						parallelGroup: ts.parallelGroup ?? null,
						type: ts.type ?? 'manual',
						agentId: ts.agentId ?? null,
						effortScore: ts.effortScore ?? 5,
						updatedAt: now
					})
				} else {
					const newId = uuidv4()
					await tsRepo.save(tsRepo.create({
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
						effortScore: ts.effortScore ?? 5,
						status: 'pending',
						createdAt: now,
						updatedAt: now
					}))
					tplToTrac.set(ts.id, newId)
				}
			}

			for (const es of existingStages) {
				if (es.templateStageId && !templateStageIds.has(es.templateStageId)) {
					await tsRepo.delete(es.id)
				}
			}

			for (const ts of template.stages) {
				const tracStageId = tplToTrac.get(ts.id)
				if (!tracStageId) continue
				await tspRepo.delete({ stageId: tracStageId })
				if (ts.predecessors.length) {
					const preds = ts.predecessors
						.map((predTplId) => tplToTrac.get(predTplId))
						.filter((predTracId): predTracId is string => !!predTracId)
						.map((predTracId) => tspRepo.create({ id: uuidv4(), stageId: tracStageId, predecessorStageId: predTracId }))
					if (preds.length) await tspRepo.save(preds)
				}
			}
		}
	}

	// ─── Traceabilities ─────────────────────────────────────────────────────────

	async findAll(): Promise<TraceabilitySummary[]> {
		const tracRepo = AppDataSource.getRepository(TraceabilityEntity)
		const tsRepo = AppDataSource.getRepository(TraceabilityStageEntity)
		const rows = await tracRepo.find()
		const allStages = await tsRepo.find()
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
		const tracRepo = AppDataSource.getRepository(TraceabilityEntity)
		const tsRepo = AppDataSource.getRepository(TraceabilityStageEntity)
		const taskRepo = AppDataSource.getRepository(TraceabilityTaskEntity)
		const linkRepo = AppDataSource.getRepository(TraceabilityLinkEntity)
		const docRepo = AppDataSource.getRepository(TraceabilityDocumentEntity)
		const predRepo = AppDataSource.getRepository(TraceabilityStagePredecessorEntity)

		const t = await tracRepo.findOneBy({ id })
		if (!t) return null

		const stages = await tsRepo.findBy({ traceabilityId: id })
		const stageIds = stages.map((s) => s.id)

		const [allTasks, allLinks, allDocuments, allPredecessors] = await Promise.all([
			stageIds.length ? taskRepo.findBy({ stageId: In(stageIds) }) : Promise.resolve([]),
			stageIds.length ? linkRepo.findBy({ stageId: In(stageIds) }) : Promise.resolve([]),
			stageIds.length ? docRepo.findBy({ stageId: In(stageIds) }) : Promise.resolve([]),
			stageIds.length ? predRepo.findBy({ stageId: In(stageIds) }) : Promise.resolve([])
		])

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
				effortScore: s.effortScore ?? 5,
				assignedUserId: s.assignedUserId ?? null,
				tasks: allTasks.filter((tk) => tk.stageId === s.id) as TraceabilityTask[],
				links: allLinks.filter((lk) => lk.stageId === s.id) as TraceabilityLink[],
				documents: allDocuments.filter((d) => d.stageId === s.id) as TraceabilityDocument[],
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
		const tracRepo = AppDataSource.getRepository(TraceabilityEntity)
		const tsRepo = AppDataSource.getRepository(TraceabilityStageEntity)
		const tspRepo = AppDataSource.getRepository(TraceabilityStagePredecessorEntity)

		const id = uuidv4()
		const now = new Date().toISOString()
		const template = await this.findTemplateById(data.templateId)
		if (!template) throw new Error(`Template ${data.templateId} not found`)

		await tracRepo.save(tracRepo.create({
			id,
			title: data.title,
			description: data.description ?? null,
			status: 'active',
			templateId: data.templateId,
			templateName: template.name,
			createdBy: data.createdBy ?? null,
			createdAt: now,
			updatedAt: now
		}))

		const stageIdMap = new Map<string, string>()
		const stageList: TraceabilityStage[] = []

		const roleIds = [...new Set(template.stages.map((ts) => ts.role).filter((r): r is string => !!r))]
		const userEffortCache = new Map<string, UserEffort[]>()
		for (const roleId of roleIds) {
			userEffortCache.set(roleId, await this.getUsersByRoleWithEffort(roleId))
		}
		const sessionEffortDelta = new Map<string, number>()

		for (const ts of template.stages) {
			const stageId = uuidv4()
			stageIdMap.set(ts.id, stageId)

			let assignedUserId: string | null = null
			if (ts.role) {
				const candidates = userEffortCache.get(ts.role) ?? []
				if (candidates.length > 0) {
					let minUser = candidates[0]
					let minEffort = minUser.effortScore + (sessionEffortDelta.get(minUser.userId) ?? 0)
					for (const u of candidates) {
						const total = u.effortScore + (sessionEffortDelta.get(u.userId) ?? 0)
						if (total < minEffort) { minEffort = total; minUser = u }
					}
					assignedUserId = minUser.userId
					sessionEffortDelta.set(minUser.userId, (sessionEffortDelta.get(minUser.userId) ?? 0) + (ts.effortScore ?? 5))
				}
			}

			await tsRepo.save(tsRepo.create({
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
				effortScore: ts.effortScore ?? 5,
				assignedUserId,
				status: 'pending',
				createdAt: now,
				updatedAt: now
			}))

			stageList.push({
				id: stageId, traceabilityId: id, templateStageId: ts.id,
				name: ts.name, description: ts.description, role: ts.role,
				order: ts.order, parallelGroup: ts.parallelGroup,
				type: ts.type ?? 'manual', agentId: ts.agentId ?? null,
				predecessors: [], status: 'pending', effortScore: ts.effortScore ?? 5,
				assignedUserId, tasks: [], links: [], documents: [],
				createdAt: now, updatedAt: now
			})
		}

		for (const ts of template.stages) {
			const newStageId = stageIdMap.get(ts.id)
			if (!newStageId) continue
			if (ts.predecessors.length) {
				const preds = ts.predecessors
					.map((pid) => stageIdMap.get(pid))
					.filter((pid): pid is string => pid !== undefined)
					.map((predTracId) => tspRepo.create({ id: uuidv4(), stageId: newStageId, predecessorStageId: predTracId }))
				if (preds.length) await tspRepo.save(preds)
			}
			const stageEntry = stageList.find((s) => s.id === newStageId)
			if (stageEntry) {
				stageEntry.predecessors = ts.predecessors.map((pid) => stageIdMap.get(pid)).filter((pid): pid is string => pid !== undefined)
			}
		}

		return {
			id, title: data.title, description: data.description ?? null,
			status: 'active', templateId: data.templateId, templateName: template.name,
			createdBy: data.createdBy ?? null, stages: stageList,
			createdAt: now, updatedAt: now
		}
	}

	async update(data: UpdateTraceabilityDTO): Promise<Traceability | null> {
		const tracRepo = AppDataSource.getRepository(TraceabilityEntity)
		const { id, ...rest } = data
		await tracRepo.update(id, { ...rest, updatedAt: new Date().toISOString() })
		return this.findById(id)
	}

	async delete(id: string): Promise<void> {
		const tracRepo = AppDataSource.getRepository(TraceabilityEntity)
		await tracRepo.delete(id)
	}

	// ─── Stage status ────────────────────────────────────────────────────────────

	async recomputeStageStatus(stageId: string): Promise<TraceabilityStage> {
		const tsRepo = AppDataSource.getRepository(TraceabilityStageEntity)
		const taskRepo = AppDataSource.getRepository(TraceabilityTaskEntity)
		const linkRepo = AppDataSource.getRepository(TraceabilityLinkEntity)
		const docRepo = AppDataSource.getRepository(TraceabilityDocumentEntity)
		const predRepo = AppDataSource.getRepository(TraceabilityStagePredecessorEntity)

		const tasks = await taskRepo.findBy({ stageId })
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
		await tsRepo.update(stageId, { status: newStatus, updatedAt: now })
		const s = await tsRepo.findOneByOrFail({ id: stageId })
		const [links, documents, predRows] = await Promise.all([
			linkRepo.findBy({ stageId }),
			docRepo.findBy({ stageId }),
			predRepo.findBy({ stageId })
		])

		return {
			id: s.id, traceabilityId: s.traceabilityId, templateStageId: s.templateStageId,
			name: s.name, description: s.description, role: s.role, order: s.order,
			parallelGroup: s.parallelGroup, type: (s.type ?? 'manual') as 'manual' | 'agent',
			agentId: s.agentId ?? null, predecessors: predRows.map((p) => p.predecessorStageId),
			status: newStatus, effortScore: s.effortScore ?? 5, assignedUserId: s.assignedUserId ?? null,
			tasks: tasks as TraceabilityTask[], links: links as TraceabilityLink[],
			documents: documents as TraceabilityDocument[], createdAt: s.createdAt, updatedAt: now
		}
	}

	async findReadyAgentStages(completedStageId: string): Promise<Array<TraceabilityStage & { agentSlug: string; agentContent: string }>> {
		const tsRepo = AppDataSource.getRepository(TraceabilityStageEntity)
		const tspRepo = AppDataSource.getRepository(TraceabilityStagePredecessorEntity)
		const taskRepo = AppDataSource.getRepository(TraceabilityTaskEntity)
		const linkRepo = AppDataSource.getRepository(TraceabilityLinkEntity)
		const agentRepo = AppDataSource.getRepository(AgentEntity)
		const userRepo = AppDataSource.getRepository(UserEntity)

		const successorRels = await tspRepo.findBy({ predecessorStageId: completedStageId })
		if (!successorRels.length) return []

		const successorIds = successorRels.map((r) => r.stageId)
		const successorStages = await tsRepo.find({ where: { id: In(successorIds), type: 'agent' } })

		const result: Array<TraceabilityStage & { agentSlug: string; agentContent: string }> = []

		for (const stage of successorStages) {
			if (!stage.agentId) continue

			const allPreds = await tspRepo.findBy({ stageId: stage.id })
			const predIds = allPreds.map((p) => p.predecessorStageId)
			if (!predIds.length) continue

			const predStages = await tsRepo.findBy({ id: In(predIds) })
			if (!predStages.every((p) => p.status === 'completed')) continue

			const nextRels = await tspRepo.findBy({ predecessorStageId: stage.id })
			const nextIds = nextRels.map((r) => r.stageId)
			const nextStagesRaw = nextIds.length ? await tsRepo.findBy({ id: In(nextIds) }) : []
			const nextStages = await Promise.all(
				nextStagesRaw.map(async (ns) => {
					let userName: string | null = null
					if (ns.assignedUserId) {
						const u = await userRepo.findOneBy({ id: ns.assignedUserId })
						if (u) userName = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim()
					}
					return { id: ns.id, name: ns.name, user: userName }
				})
			)

			const agentRow = await agentRepo.findOneBy({ id: stage.agentId })
			if (!agentRow || !agentRow.isActive) continue

			const [stageTasks, stageLinks] = await Promise.all([
				taskRepo.findBy({ stageId: stage.id }),
				linkRepo.findBy({ stageId: stage.id })
			])

			result.push({
				id: stage.id, traceabilityId: stage.traceabilityId, templateStageId: stage.templateStageId,
				name: stage.name, description: stage.description, role: stage.role, order: stage.order,
				parallelGroup: stage.parallelGroup, type: stage.type as 'agent', agentId: stage.agentId,
				status: stage.status as StageStatus, effortScore: stage.effortScore ?? 5,
				assignedUserId: stage.assignedUserId ?? null, predecessors: predIds,
				nextStages: nextStages as any, tasks: stageTasks as TraceabilityTask[], links: stageLinks as TraceabilityLink[],
				documents: [], createdAt: stage.createdAt, updatedAt: stage.updatedAt,
				agentSlug: agentRow.slug, agentContent: agentRow.content
			})
		}

		return result
	}

	async updateStageStatus(stageId: string, status: StageStatus): Promise<void> {
		const tsRepo = AppDataSource.getRepository(TraceabilityStageEntity)
		await tsRepo.update(stageId, { status, updatedAt: new Date().toISOString() })
	}

	// ─── Tasks ───────────────────────────────────────────────────────────────────

	async createTask(data: CreateTaskDTO): Promise<TraceabilityTask> {
		const taskRepo = AppDataSource.getRepository(TraceabilityTaskEntity)
		const now = new Date().toISOString()
		const entity = taskRepo.create({
			id: uuidv4(), stageId: data.stageId, title: data.title,
			description: data.description ?? null, type: data.type ?? 'task',
			status: data.status ?? 'todo', createdAt: now, updatedAt: now
		})
		await taskRepo.save(entity)
		return entity as TraceabilityTask
	}

	async updateTask(data: UpdateTaskDTO): Promise<TraceabilityTask | null> {
		const taskRepo = AppDataSource.getRepository(TraceabilityTaskEntity)
		const { id, ...rest } = data
		await taskRepo.update(id, { ...rest, updatedAt: new Date().toISOString() })
		const row = await taskRepo.findOneBy({ id })
		return (row as TraceabilityTask) ?? null
	}

	async deleteTask(id: string): Promise<void> {
		const taskRepo = AppDataSource.getRepository(TraceabilityTaskEntity)
		await taskRepo.delete(id)
	}

	// ─── Links ───────────────────────────────────────────────────────────────────

	async createLink(data: CreateLinkDTO): Promise<TraceabilityLink> {
		const linkRepo = AppDataSource.getRepository(TraceabilityLinkEntity)
		const now = new Date().toISOString()
		const entity = linkRepo.create({
			id: uuidv4(), stageId: data.stageId, label: data.label,
			url: data.url, platform: data.platform ?? 'generic', createdAt: now
		})
		await linkRepo.save(entity)
		return entity as TraceabilityLink
	}

	async deleteLink(id: string): Promise<void> {
		const linkRepo = AppDataSource.getRepository(TraceabilityLinkEntity)
		await linkRepo.delete(id)
	}

	// ─── Documents ───────────────────────────────────────────────────────────────

	async createDocument(data: CreateDocumentDTO): Promise<TraceabilityDocument> {
		const docRepo = AppDataSource.getRepository(TraceabilityDocumentEntity)
		const now = new Date().toISOString()
		const entity = docRepo.create({
			id: uuidv4(), stageId: data.stageId, name: data.name,
			content: data.content ?? '', createdAt: now, updatedAt: now
		})
		await docRepo.save(entity)
		return entity as TraceabilityDocument
	}

	async updateDocument(data: UpdateDocumentDTO): Promise<TraceabilityDocument | null> {
		const docRepo = AppDataSource.getRepository(TraceabilityDocumentEntity)
		const { id, ...rest } = data
		await docRepo.update(id, { ...rest, updatedAt: new Date().toISOString() })
		const row = await docRepo.findOneBy({ id })
		return (row as TraceabilityDocument) ?? null
	}

	async deleteDocument(id: string): Promise<void> {
		const docRepo = AppDataSource.getRepository(TraceabilityDocumentEntity)
		await docRepo.delete(id)
	}

	async getDocument(id: string): Promise<TraceabilityDocument | null> {
		const docRepo = AppDataSource.getRepository(TraceabilityDocumentEntity)
		const row = await docRepo.findOneBy({ id })
		return (row as TraceabilityDocument) ?? null
	}

	async getDocumentByTraceabilityId(traceabilityId: string): Promise<TraceabilityDocument[]> {
		const tsRepo = AppDataSource.getRepository(TraceabilityStageEntity)
		const docRepo = AppDataSource.getRepository(TraceabilityDocumentEntity)
		const stages = await tsRepo.findBy({ traceabilityId })
		const stageIds = stages.map((s) => s.id)
		if (!stageIds.length) return []
		const rows = await docRepo.findBy({ stageId: In(stageIds) })
		return rows as TraceabilityDocument[]
	}

	// ─── Effort & Assignment ─────────────────────────────────────────────────────

	async getUsersByRoleWithEffort(roleId: string): Promise<UserEffort[]> {
		const urRepo = AppDataSource.getRepository(UserRoleEntity)
		const userRepo = AppDataSource.getRepository(UserEntity)
		const tsRepo = AppDataSource.getRepository(TraceabilityStageEntity)

		const usersWithRole = await urRepo.findBy({ roleId })
		const result: UserEffort[] = []

		for (const ur of usersWithRole) {
			const user = await userRepo.findOneBy({ id: ur.userId, active: true })
			if (!user) continue
			const activeStages = await tsRepo.findBy({ assignedUserId: ur.userId, status: Not('completed') })
			const effortScore = activeStages.reduce((sum, s) => sum + (s.effortScore ?? 5), 0)
			result.push({
				userId: ur.userId,
				username: user.username,
				firstName: user.firstName ?? null,
				lastName: user.lastName ?? null,
				email: user.email,
				effortScore
			})
		}

		return result.sort((a, b) => a.effortScore - b.effortScore)
	}

	async assignUserToStage(stageId: string, userId: string | null): Promise<void> {
		const tsRepo = AppDataSource.getRepository(TraceabilityStageEntity)
		await tsRepo.update(stageId, { assignedUserId: userId, updatedAt: new Date().toISOString() })
	}

	async findStagesByUserId(userId: string): Promise<MyStage[]> {
		const tsRepo = AppDataSource.getRepository(TraceabilityStageEntity)
		const tracRepo = AppDataSource.getRepository(TraceabilityEntity)
		const taskRepo = AppDataSource.getRepository(TraceabilityTaskEntity)
		const linkRepo = AppDataSource.getRepository(TraceabilityLinkEntity)
		const docRepo = AppDataSource.getRepository(TraceabilityDocumentEntity)
		const predRepo = AppDataSource.getRepository(TraceabilityStagePredecessorEntity)

		const stages = await tsRepo.findBy({ assignedUserId: userId })
		if (!stages.length) return []

		const tracIds = [...new Set(stages.map((s) => s.traceabilityId))]
		const tracRows = await tracRepo.findBy({ id: In(tracIds) })
		const tracMap = new Map(tracRows.map((t) => [t.id, t]))

		const result: MyStage[] = []
		for (const stage of stages) {
			const trac = tracMap.get(stage.traceabilityId)
			if (!trac) continue

			const [tasks, links, docs, preds] = await Promise.all([
				taskRepo.findBy({ stageId: stage.id }),
				linkRepo.findBy({ stageId: stage.id }),
				docRepo.findBy({ stageId: stage.id }),
				predRepo.findBy({ stageId: stage.id })
			])

			const predIds = preds.map((p) => p.predecessorStageId)
			let predecessorsCompleted = true
			if (predIds.length > 0) {
				const predStages = await tsRepo.findBy({ id: In(predIds) })
				predecessorsCompleted = predStages.every((s) => s.status === 'completed')
			}

			result.push({
				id: stage.id, traceabilityId: stage.traceabilityId, templateStageId: stage.templateStageId,
				name: stage.name, description: stage.description, role: stage.role, order: stage.order,
				parallelGroup: stage.parallelGroup, type: (stage.type ?? 'manual') as 'manual' | 'agent',
				agentId: stage.agentId ?? null, predecessors: predIds,
				status: stage.status as StageStatus, effortScore: stage.effortScore ?? 5,
				assignedUserId: stage.assignedUserId ?? null,
				tasks: tasks as TraceabilityTask[], links: links as TraceabilityLink[],
				documents: docs as TraceabilityDocument[],
				createdAt: stage.createdAt, updatedAt: stage.updatedAt,
				traceabilityTitle: trac.title,
				traceabilityStatus: trac.status as TraceabilityStatus,
				predecessorsCompleted
			})
		}

		return result
	}
}
