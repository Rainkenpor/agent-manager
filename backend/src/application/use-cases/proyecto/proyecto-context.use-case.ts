import type {
	HistoriaComentario,
	HistoriaUsuario,
	ProyectoParticipante,
	ProyectoRecord,
	ProyectoServicio
} from '@domain/entities/proyecto.entity.js'
import type { IProyectoRepository } from '@domain/repositories/proyecto.repository.js'

type Result<T> = { success: true; data: T } | { success: false; error: string }

export interface ProyectoContext {
	proyecto: ProyectoRecord
	servicios: ProyectoServicio[]
	participantes: ProyectoParticipante[]
	historias: Array<HistoriaUsuario & { comentarios: HistoriaComentario[] }>
}

export class GetProyectoContextUseCase {
	constructor(private readonly repo: IProyectoRepository) {}

	async execute(params: { proyectoId?: string; clarifyProjectId?: string }): Promise<Result<ProyectoContext>> {
		try {
			const proyecto = params.proyectoId
				? await this.repo.findById(params.proyectoId)
				: params.clarifyProjectId
					? await this.repo.findByClarifyId(params.clarifyProjectId)
					: null
			if (!proyecto) return { success: false, error: 'Proyecto no encontrado' }

			const [servicios, historias, participantes] = await Promise.all([
				this.repo.findServicios(proyecto.id),
				this.repo.findHistorias(proyecto.id),
				this.repo.findParticipantes(proyecto.id)
			])
			const historiasConComentarios = await Promise.all(
				historias.map(async (h) => ({ ...h, comentarios: await this.repo.findComentarios(h.id) }))
			)

			return { success: true, data: { proyecto, servicios, participantes, historias: historiasConComentarios } }
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
		}
	}
}
