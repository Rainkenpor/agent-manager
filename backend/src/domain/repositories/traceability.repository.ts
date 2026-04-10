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
} from '../entities/traceability.entity.js'

export interface ITraceabilityRepository {
	// ─── Templates ──────────────────────────────────────────────────────────────
	findAllTemplates(): Promise<TraceabilityTemplate[]>
	findTemplateById(id: string): Promise<TraceabilityTemplate | null>
	findTemplateByCode(code: string): Promise<TraceabilityTemplate | null>
	findTemplateStageByTraceabilityStageId(stageId: string): Promise<TemplateStage | null>
	createTemplate(data: CreateTemplateDTO): Promise<TraceabilityTemplate>
	updateTemplate(data: UpdateTemplateDTO): Promise<TraceabilityTemplate | null>
	deleteTemplate(id: string): Promise<void>

	// ─── Template Stages ────────────────────────────────────────────────────────
	findTemplateStageById(id: string): Promise<TemplateStage | null>
	createTemplateStage(data: CreateTemplateStageDTO): Promise<TemplateStage>
	updateTemplateStage(data: UpdateTemplateStageDTO): Promise<TemplateStage | null>
	deleteTemplateStage(id: string): Promise<void>
	syncTraceabilitiesFromTemplate(templateId: string): Promise<void>

	// ─── Traceabilities ─────────────────────────────────────────────────────────
	findAll(): Promise<TraceabilitySummary[]>
	findById(id: string): Promise<Traceability | null>
	create(data: CreateTraceabilityDTO): Promise<Traceability>
	update(data: UpdateTraceabilityDTO): Promise<Traceability | null>
	delete(id: string): Promise<void>

	// ─── Stage status ────────────────────────────────────────────────────────────
	recomputeStageStatus(stageId: string): Promise<TraceabilityStage>
	findReadyAgentStages(completedStageId: string): Promise<Array<TraceabilityStage & { agentSlug: string; agentContent: string }>>
	updateStageStatus(stageId: string, status: StageStatus): Promise<void>

	// ─── Effort & Assignment ─────────────────────────────────────────────────────
	getUsersByRoleWithEffort(roleId: string): Promise<UserEffort[]>
	assignUserToStage(stageId: string, userId: string | null): Promise<void>
	findStagesByUserId(userId: string): Promise<MyStage[]>

	// ─── Tasks ───────────────────────────────────────────────────────────────────
	createTask(data: CreateTaskDTO): Promise<TraceabilityTask>
	updateTask(data: UpdateTaskDTO): Promise<TraceabilityTask | null>
	deleteTask(id: string): Promise<void>

	// ─── Links ───────────────────────────────────────────────────────────────────
	createLink(data: CreateLinkDTO): Promise<TraceabilityLink>
	deleteLink(id: string): Promise<void>

	// ─── Documents ───────────────────────────────────────────────────────────────
	createDocument(data: CreateDocumentDTO): Promise<TraceabilityDocument>
	updateDocument(data: UpdateDocumentDTO): Promise<TraceabilityDocument | null>
	deleteDocument(id: string): Promise<void>
	getDocument(id: string): Promise<TraceabilityDocument | null>
	getDocumentByTraceabilityId(traceabilityId: string): Promise<TraceabilityDocument[]>
}
