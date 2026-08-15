import type { ProyectoParticipante, ProyectoRecord } from '@domain/entities/proyecto.entity.js'
import type { IProyectoRepository } from '@domain/repositories/proyecto.repository.js'

type Result<T> = { success: true; data: T } | { success: false; error: string }

export interface ProyectoContext {
	proyecto: ProyectoRecord
	participantes: ProyectoParticipante[]
}

export class GetProyectoContextUseCase {
	constructor(private readonly repo: IProyectoRepository) {}

	async execute(params: { proyectoId: string }): Promise<Result<ProyectoContext>> {
		try {
			const proyecto = await this.repo.findById(params.proyectoId)
			if (!proyecto) return { success: false, error: 'Proyecto no encontrado' }

			const participantes = await this.repo.findParticipantes(proyecto.id)
			return { success: true, data: { proyecto, participantes } }
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
		}
	}
}
