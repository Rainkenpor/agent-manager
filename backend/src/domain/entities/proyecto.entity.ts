export interface Stakeholder {
	name: string
	role: string
	email?: string
}

export const PROYECTO_DATA_SECTIONS = ['historiasUsuario', 'arquitectura', 'proyectosRelacionados', 'metadatos'] as const

export type ProyectoDataSection = (typeof PROYECTO_DATA_SECTIONS)[number]

/** Documento libre del proyecto. Las cuatro secciones están garantizadas; se admiten secciones propias. */
export interface ProyectoData {
	historiasUsuario: unknown[]
	arquitectura: Record<string, unknown>
	proyectosRelacionados: unknown[]
	metadatos: Record<string, unknown>
	[section: string]: unknown
}

export const emptyProyectoData = (): ProyectoData => ({
	historiasUsuario: [],
	arquitectura: {},
	proyectosRelacionados: [],
	metadatos: {}
})

/** Valor vacío por defecto de una sección: arreglo para las de tipo lista, objeto para el resto. */
export function emptySection(section: string): unknown {
	const defaults = emptyProyectoData()
	return section in defaults ? defaults[section] : {}
}

export interface ProyectoRecord {
	id: string
	name: string
	description: string | null
	data: ProyectoData
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
	data?: ProyectoData
	stakeholders?: Stakeholder[]
	status?: string
	chatAgentId?: string | null
	createdBy?: string | null
}

export interface UpdateProyectoDTO {
	id: string
	name?: string
	description?: string | null
	data?: ProyectoData
	stakeholders?: Stakeholder[]
	status?: string
	chatAgentId?: string | null
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
