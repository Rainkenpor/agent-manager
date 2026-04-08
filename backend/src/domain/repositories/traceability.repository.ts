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
} from '../entities/traceability.entity.js'

export interface ITraceabilityRepository {
  // ─── Templates ──────────────────────────────────────────────────────────────
  findAllTemplates(): Promise<TraceabilityTemplate[]>
  findTemplateById(id: string): Promise<TraceabilityTemplate | null>
  createTemplate(data: CreateTemplateDTO): Promise<TraceabilityTemplate>
  updateTemplate(data: UpdateTemplateDTO): Promise<TraceabilityTemplate | null>
  deleteTemplate(id: string): Promise<void>

  // ─── Template Stages ────────────────────────────────────────────────────────
  createTemplateStage(data: CreateTemplateStageDTO): Promise<TemplateStage>
  updateTemplateStage(data: UpdateTemplateStageDTO): Promise<TemplateStage | null>
  deleteTemplateStage(id: string): Promise<void>

  // ─── Traceabilities ─────────────────────────────────────────────────────────
  findAll(): Promise<TraceabilitySummary[]>
  findById(id: string): Promise<Traceability | null>
  create(data: CreateTraceabilityDTO): Promise<Traceability>
  update(data: UpdateTraceabilityDTO): Promise<Traceability | null>
  delete(id: string): Promise<void>

  // ─── Stage status ────────────────────────────────────────────────────────────
  recomputeStageStatus(stageId: string): Promise<TraceabilityStage>

  // ─── Tasks ───────────────────────────────────────────────────────────────────
  createTask(data: CreateTaskDTO): Promise<TraceabilityTask>
  updateTask(data: UpdateTaskDTO): Promise<TraceabilityTask | null>
  deleteTask(id: string): Promise<void>

  // ─── Links ───────────────────────────────────────────────────────────────────
  createLink(data: CreateLinkDTO): Promise<TraceabilityLink>
  deleteLink(id: string): Promise<void>
}
