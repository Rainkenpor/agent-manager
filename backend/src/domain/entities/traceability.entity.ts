export type StageStatus = 'pending' | 'active' | 'completed' | 'blocked' | 'in-review'
export type TaskType = 'task' | 'bug'
export type TaskStatus = 'todo' | 'in-progress' | 'done' | 'blocked'
export type LinkPlatform = 'jira' | 'confluence' | 'github' | 'gitlab' | 'generic'
export type TraceabilityStatus = 'active' | 'completed' | 'archived'

// ─── Templates ────────────────────────────────────────────────────────────────

export interface TemplateStage {
  id: string
  templateId: string
  name: string
  description?: string | null
  role?: string | null
  order: number
  parallelGroup?: string | null
  createdAt: string
}

export interface TraceabilityTemplate {
  id: string
  name: string
  description?: string | null
  stages: TemplateStage[]
  createdAt: string
  updatedAt: string
}

export interface CreateTemplateDTO {
  name: string
  description?: string
}

export interface UpdateTemplateDTO {
  id: string
  name?: string
  description?: string | null
}

export interface CreateTemplateStageDTO {
  templateId: string
  name: string
  description?: string
  role?: string
  order: number
  parallelGroup?: string
}

export interface UpdateTemplateStageDTO {
  id: string
  name?: string
  description?: string | null
  role?: string | null
  order?: number
  parallelGroup?: string | null
}

// ─── Traceability Instances ───────────────────────────────────────────────────

export interface TraceabilityLink {
  id: string
  stageId: string
  label: string
  url: string
  platform: LinkPlatform
  createdAt: string
}

export interface TraceabilityTask {
  id: string
  stageId: string
  title: string
  description?: string | null
  type: TaskType
  status: TaskStatus
  createdAt: string
  updatedAt: string
}

export interface TraceabilityStage {
  id: string
  traceabilityId: string
  templateStageId?: string | null
  name: string
  description?: string | null
  role?: string | null
  order: number
  parallelGroup?: string | null
  status: StageStatus
  tasks: TraceabilityTask[]
  links: TraceabilityLink[]
  createdAt: string
  updatedAt: string
}

export interface Traceability {
  id: string
  title: string
  description?: string | null
  status: TraceabilityStatus
  templateId?: string | null
  templateName?: string | null
  stages: TraceabilityStage[]
  createdAt: string
  updatedAt: string
}

export interface TraceabilitySummary {
  id: string
  title: string
  description?: string | null
  status: TraceabilityStatus
  templateId?: string | null
  templateName?: string | null
  stageCount: number
  completedStages: number
  createdAt: string
  updatedAt: string
}

export interface CreateTraceabilityDTO {
  title: string
  description?: string
  templateId: string
}

export interface UpdateTraceabilityDTO {
  id: string
  title?: string
  description?: string | null
  status?: TraceabilityStatus
}

export interface CreateTaskDTO {
  stageId: string
  title: string
  description?: string
  type?: TaskType
  status?: TaskStatus
}

export interface UpdateTaskDTO {
  id: string
  title?: string
  description?: string | null
  type?: TaskType
  status?: TaskStatus
}

export interface CreateLinkDTO {
  stageId: string
  label: string
  url: string
  platform?: LinkPlatform
}
