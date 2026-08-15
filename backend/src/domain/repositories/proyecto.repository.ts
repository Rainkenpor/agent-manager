import type {
	CreateParticipanteDTO,
	CreateProyectoDTO,
	ProyectoData,
	ProyectoParticipante,
	ProyectoRecord,
	UpdateProyectoDTO
} from '../entities/proyecto.entity.js'

export interface IProyectoRepository {
	// Proyecto
	findAll(): Promise<ProyectoRecord[]>
	findById(id: string): Promise<ProyectoRecord | null>
	create(data: CreateProyectoDTO): Promise<ProyectoRecord>
	update(data: UpdateProyectoDTO): Promise<ProyectoRecord | null>
	updateData(id: string, data: ProyectoData): Promise<ProyectoRecord | null>
	delete(id: string): Promise<void>

	// Participantes (interesados = usuarios)
	findParticipantes(proyectoId: string): Promise<ProyectoParticipante[]>
	findParticipante(proyectoId: string, userId: string): Promise<ProyectoParticipante | null>
	addParticipante(data: CreateParticipanteDTO): Promise<ProyectoParticipante>
	updateParticipante(id: string, changes: { role?: string | null; chatId?: string | null }): Promise<ProyectoParticipante | null>
	removeParticipante(proyectoId: string, userId: string): Promise<void>
	findProyectosByParticipant(userId: string): Promise<ProyectoRecord[]>
}
