import type { CreateServicioDTO, ProyectoServicio, UpdateServicioDTO } from '@domain/entities/proyecto.entity.js'
import type { IProyectoRepository } from '@domain/repositories/proyecto.repository.js'

type Result<T> = { success: true; data: T } | { success: false; error: string }

function fail(error: unknown): { success: false; error: string } {
	return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
}

export class ListServiciosUseCase {
	constructor(private readonly repo: IProyectoRepository) {}
	async execute(proyectoId: string): Promise<Result<ProyectoServicio[]>> {
		try {
			return { success: true, data: await this.repo.findServicios(proyectoId) }
		} catch (error) {
			return fail(error)
		}
	}
}

export class AddServicioUseCase {
	constructor(private readonly repo: IProyectoRepository) {}
	async execute(data: CreateServicioDTO): Promise<Result<ProyectoServicio>> {
		try {
			const proyecto = await this.repo.findById(data.proyectoId)
			if (!proyecto) return { success: false, error: 'Proyecto no encontrado' }
			return { success: true, data: await this.repo.createServicio(data) }
		} catch (error) {
			return fail(error)
		}
	}
}

export class UpdateServicioUseCase {
	constructor(private readonly repo: IProyectoRepository) {}
	async execute(data: UpdateServicioDTO): Promise<Result<ProyectoServicio>> {
		try {
			const updated = await this.repo.updateServicio(data)
			if (!updated) return { success: false, error: 'Servicio no encontrado' }
			return { success: true, data: updated }
		} catch (error) {
			return fail(error)
		}
	}
}

export class DeleteServicioUseCase {
	constructor(private readonly repo: IProyectoRepository) {}
	async execute(id: string): Promise<Result<{ id: string }>> {
		try {
			await this.repo.deleteServicio(id)
			return { success: true, data: { id } }
		} catch (error) {
			return fail(error)
		}
	}
}
