export interface Stakeholder {
	name: string
	role: string
	email?: string
}

export type RepoFileStatus = 'ok' | 'outdated' | 'missing' | 'unknown'

export type HistoriaStatus = 'pending' | 'in_progress' | 'done' | 'blocked'

export interface ProyectoServicio {
	id: string
	proyectoId: string
	name: string
	repoUrl: string
	repoRef: string | null
	governanceId: string | null
	governanceType: string | null
	agentMdStatus: RepoFileStatus
	claudeMdStatus: RepoFileStatus
	lastCheckedAt: string | null
	createdAt: string
	updatedAt: string
}

export interface HistoriaComentario {
	id: string
	historiaId: string
	author: string
	content: string
	createdAt: string
}

export interface HistoriaUsuario {
	id: string
	proyectoId: string
	code: string | null
	title: string
	description: string | null
	additionalInfo: Record<string, unknown> | null
	status: HistoriaStatus
	createdAt: string
	updatedAt: string
}

export interface ProyectoRecord {
	id: string
	name: string
	description: string | null
	clarifyProjectId: string | null
	architecture: string | null
	programmingLanguage: string | null
	stakeholders: Stakeholder[]
	status: string
	chatAgentId: string | null
	createdBy: string | null
	createdAt: string
	updatedAt: string
}

export interface CreateProyectoDTO {
	name: string
	description?: string | null
	clarifyProjectId?: string | null
	architecture?: string | null
	programmingLanguage?: string | null
	stakeholders?: Stakeholder[]
	status?: string
	chatAgentId?: string | null
	createdBy?: string | null
}

export interface UpdateProyectoDTO {
	id: string
	name?: string
	description?: string | null
	clarifyProjectId?: string | null
	architecture?: string | null
	programmingLanguage?: string | null
	stakeholders?: Stakeholder[]
	status?: string
	chatAgentId?: string | null
}

export interface CreateServicioDTO {
	proyectoId: string
	name: string
	repoUrl: string
	repoRef?: string | null
	governanceId?: string | null
	governanceType?: string | null
}

export interface UpdateServicioDTO {
	id: string
	name?: string
	repoUrl?: string
	repoRef?: string | null
	governanceId?: string | null
	governanceType?: string | null
	agentMdStatus?: RepoFileStatus
	claudeMdStatus?: RepoFileStatus
	lastCheckedAt?: string | null
}

export interface CreateHistoriaDTO {
	proyectoId: string
	code?: string | null
	title: string
	description?: string | null
	additionalInfo?: Record<string, unknown> | null
	status?: HistoriaStatus
}

export interface UpdateHistoriaDTO {
	id: string
	code?: string | null
	title?: string
	description?: string | null
	additionalInfo?: Record<string, unknown> | null
	status?: HistoriaStatus
}

export interface CreateHistoriaComentarioDTO {
	historiaId: string
	author: string
	content: string
}

export interface ProyectoParticipante {
	id: string
	proyectoId: string
	userId: string
	role: string | null
	chatId: string | null
	invitedBy: string | null
	createdAt: string
}

export interface CreateParticipanteDTO {
	proyectoId: string
	userId: string
	role?: string | null
	invitedBy?: string | null
}
