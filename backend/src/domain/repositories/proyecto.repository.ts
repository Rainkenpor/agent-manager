import type {
	CreateHistoriaComentarioDTO,
	CreateHistoriaDTO,
	CreateParticipanteDTO,
	CreateProyectoDTO,
	CreateServicioDTO,
	HistoriaComentario,
	HistoriaUsuario,
	ProyectoParticipante,
	ProyectoRecord,
	ProyectoServicio,
	UpdateHistoriaDTO,
	UpdateProyectoDTO,
	UpdateServicioDTO
} from '../entities/proyecto.entity.js'

export interface IProyectoRepository {
	// Proyecto
	findAll(): Promise<ProyectoRecord[]>
	findById(id: string): Promise<ProyectoRecord | null>
	findByClarifyId(clarifyProjectId: string): Promise<ProyectoRecord | null>
	create(data: CreateProyectoDTO): Promise<ProyectoRecord>
	update(data: UpdateProyectoDTO): Promise<ProyectoRecord | null>
	delete(id: string): Promise<void>

	// Servicios
	findServicios(proyectoId: string): Promise<ProyectoServicio[]>
	findServicioById(id: string): Promise<ProyectoServicio | null>
	createServicio(data: CreateServicioDTO): Promise<ProyectoServicio>
	updateServicio(data: UpdateServicioDTO): Promise<ProyectoServicio | null>
	deleteServicio(id: string): Promise<void>

	// Historias de usuario
	findHistorias(proyectoId: string): Promise<HistoriaUsuario[]>
	findHistoriaById(id: string): Promise<HistoriaUsuario | null>
	createHistoria(data: CreateHistoriaDTO): Promise<HistoriaUsuario>
	updateHistoria(data: UpdateHistoriaDTO): Promise<HistoriaUsuario | null>
	deleteHistoria(id: string): Promise<void>

	// Comentarios de HU
	findComentarios(historiaId: string): Promise<HistoriaComentario[]>
	createComentario(data: CreateHistoriaComentarioDTO): Promise<HistoriaComentario>

	// Participantes (interesados = usuarios)
	findParticipantes(proyectoId: string): Promise<ProyectoParticipante[]>
	findParticipante(proyectoId: string, userId: string): Promise<ProyectoParticipante | null>
	addParticipante(data: CreateParticipanteDTO): Promise<ProyectoParticipante>
	updateParticipante(id: string, changes: { role?: string | null; chatId?: string | null }): Promise<ProyectoParticipante | null>
	removeParticipante(proyectoId: string, userId: string): Promise<void>
	findProyectosByParticipant(userId: string): Promise<ProyectoRecord[]>
}
