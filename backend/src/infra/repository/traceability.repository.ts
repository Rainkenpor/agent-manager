import { db } from '../db/database.js'
import {
  traceabilityTemplates,
  templateStages,
  traceabilities,
  traceabilityStages,
  traceabilityTasks,
  traceabilityLinks,
} from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import type { ITraceabilityRepository } from '../../domain/repositories/traceability.repository.js'
import type {
  TraceabilityTemplate,
  TemplateStage,
  Traceability,
  TraceabilitySummary,
  TraceabilityStage,
  TraceabilityTask,
  TraceabilityLink,
  CreateTemplateDTO,
  UpdateTemplateDTO,
  CreateTemplateStageDTO,
  UpdateTemplateStageDTO,
  CreateTraceabilityDTO,
  UpdateTraceabilityDTO,
  CreateTaskDTO,
  UpdateTaskDTO,
  CreateLinkDTO,
  StageStatus,
} from '../../domain/entities/traceability.entity.js'

export class TraceabilityRepository implements ITraceabilityRepository {
  // ─── Templates ──────────────────────────────────────────────────────────────

  async findAllTemplates(): Promise<TraceabilityTemplate[]> {
    const temps = await db.select().from(traceabilityTemplates)
    const stages = await db.select().from(templateStages)
    return temps.map((t) => ({
      ...t,
      stages: stages
        .filter((s) => s.templateId === t.id)
        .sort((a, b) => a.order - b.order) as TemplateStage[],
    }))
  }

  async findTemplateById(id: string): Promise<TraceabilityTemplate | null> {
    const rows = await db.select().from(traceabilityTemplates).where(eq(traceabilityTemplates.id, id))
    if (!rows[0]) return null
    const stages = await db.select().from(templateStages).where(eq(templateStages.templateId, id))
    return {
      ...rows[0],
      stages: stages.sort((a, b) => a.order - b.order) as TemplateStage[],
    }
  }

  async createTemplate(data: CreateTemplateDTO): Promise<TraceabilityTemplate> {
    const id = uuidv4()
    const now = new Date().toISOString()
    await db.insert(traceabilityTemplates).values({ id, ...data, createdAt: now, updatedAt: now })
    return { id, name: data.name, description: data.description ?? null, stages: [], createdAt: now, updatedAt: now }
  }

  async updateTemplate(data: UpdateTemplateDTO): Promise<TraceabilityTemplate | null> {
    const now = new Date().toISOString()
    const { id, ...rest } = data
    await db.update(traceabilityTemplates).set({ ...rest, updatedAt: now }).where(eq(traceabilityTemplates.id, id))
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
      createdAt: now,
    }
    await db.insert(templateStages).values(row)
    return row as TemplateStage
  }

  async updateTemplateStage(data: UpdateTemplateStageDTO): Promise<TemplateStage | null> {
    const { id, ...rest } = data
    await db.update(templateStages).set(rest).where(eq(templateStages.id, id))
    const rows = await db.select().from(templateStages).where(eq(templateStages.id, id))
    return (rows[0] as TemplateStage) ?? null
  }

  async deleteTemplateStage(id: string): Promise<void> {
    await db.delete(templateStages).where(eq(templateStages.id, id))
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
        stageCount: stages.length,
        completedStages: stages.filter((s) => s.status === 'completed').length,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      }
    })
  }

  async findById(id: string): Promise<Traceability | null> {
    const rows = await db.select().from(traceabilities).where(eq(traceabilities.id, id))
    if (!rows[0]) return null
    const t = rows[0]
    const stages = await db.select().from(traceabilityStages).where(eq(traceabilityStages.traceabilityId, id))
    const tasks = stages.length
      ? await db.select().from(traceabilityTasks).where(
          // Fetch all tasks for stages of this traceability
          eq(traceabilityTasks.stageId, stages[0]?.id ?? '')
        )
      : []
    // Fetch all tasks and links for all stages
    const allTasks: TraceabilityTask[] = []
    const allLinks: TraceabilityLink[] = []
    for (const stage of stages) {
      const stageTasks = await db.select().from(traceabilityTasks).where(eq(traceabilityTasks.stageId, stage.id))
      const stageLinks = await db.select().from(traceabilityLinks).where(eq(traceabilityLinks.stageId, stage.id))
      allTasks.push(...(stageTasks as TraceabilityTask[]))
      allLinks.push(...(stageLinks as TraceabilityLink[]))
    }
    const stageList: TraceabilityStage[] = stages.sort((a, b) => a.order - b.order).map((s) => ({
      id: s.id,
      traceabilityId: s.traceabilityId,
      templateStageId: s.templateStageId,
      name: s.name,
      description: s.description,
      role: s.role,
      order: s.order,
      parallelGroup: s.parallelGroup,
      status: s.status as StageStatus,
      tasks: allTasks.filter((tk) => tk.stageId === s.id),
      links: allLinks.filter((lk) => lk.stageId === s.id),
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }))
    return {
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status as Traceability['status'],
      templateId: t.templateId,
      templateName: t.templateName,
      stages: stageList,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
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
      createdAt: now,
      updatedAt: now,
    })
    // Create stage instances from template stages
    const stageList: TraceabilityStage[] = []
    for (const ts of template.stages) {
      const stageId = uuidv4()
      await db.insert(traceabilityStages).values({
        id: stageId,
        traceabilityId: id,
        templateStageId: ts.id,
        name: ts.name,
        description: ts.description ?? null,
        role: ts.role ?? null,
        order: ts.order,
        parallelGroup: ts.parallelGroup ?? null,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
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
        status: 'pending',
        tasks: [],
        links: [],
        createdAt: now,
        updatedAt: now,
      })
    }
    return {
      id,
      title: data.title,
      description: data.description ?? null,
      status: 'active',
      templateId: data.templateId,
      templateName: template.name,
      stages: stageList,
      createdAt: now,
      updatedAt: now,
    }
  }

  async update(data: UpdateTraceabilityDTO): Promise<Traceability | null> {
    const now = new Date().toISOString()
    const { id, ...rest } = data
    await db.update(traceabilities).set({ ...rest, updatedAt: now }).where(eq(traceabilities.id, id))
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
    await db.update(traceabilityStages)
      .set({ status: newStatus, updatedAt: now })
      .where(eq(traceabilityStages.id, stageId))
    const rows = await db.select().from(traceabilityStages).where(eq(traceabilityStages.id, stageId))
    const s = rows[0]!
    const links = await db.select().from(traceabilityLinks).where(eq(traceabilityLinks.stageId, stageId))
    return {
      id: s.id,
      traceabilityId: s.traceabilityId,
      templateStageId: s.templateStageId,
      name: s.name,
      description: s.description,
      role: s.role,
      order: s.order,
      parallelGroup: s.parallelGroup,
      status: newStatus,
      tasks: tasks as TraceabilityTask[],
      links: links as TraceabilityLink[],
      createdAt: s.createdAt,
      updatedAt: now,
    }
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
      updatedAt: now,
    }
    await db.insert(traceabilityTasks).values(row)
    return row as TraceabilityTask
  }

  async updateTask(data: UpdateTaskDTO): Promise<TraceabilityTask | null> {
    const now = new Date().toISOString()
    const { id, ...rest } = data
    await db.update(traceabilityTasks).set({ ...rest, updatedAt: now }).where(eq(traceabilityTasks.id, id))
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
      createdAt: now,
    }
    await db.insert(traceabilityLinks).values(row)
    return row as TraceabilityLink
  }

  async deleteLink(id: string): Promise<void> {
    await db.delete(traceabilityLinks).where(eq(traceabilityLinks.id, id))
  }
}
