import type { CreateHistoriaDTO, HistoriaStatus, HistoriaUsuario, UpdateHistoriaDTO } from '@domain/entities/proyecto.entity.js'
import type { IProyectoRepository } from '@domain/repositories/proyecto.repository.js'

type Result<T> = { success: true; data: T } | { success: false; error: string }

function fail(error: unknown): { success: false; error: string } {
	return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
}

export class ListHistoriasUseCase {
	constructor(private readonly repo: IProyectoRepository) {}
	async execute(proyectoId: string): Promise<Result<HistoriaUsuario[]>> {
		try {
			return { success: true, data: await this.repo.findHistorias(proyectoId) }
		} catch (error) {
			return fail(error)
		}
	}
}

export class GetHistoriaUseCase {
	constructor(private readonly repo: IProyectoRepository) {}
	async execute(id: string): Promise<Result<HistoriaUsuario>> {
		try {
			const data = await this.repo.findHistoriaById(id)
			if (!data) return { success: false, error: 'Historia de usuario no encontrada' }
			return { success: true, data }
		} catch (error) {
			return fail(error)
		}
	}
}

export class CreateHistoriaUseCase {
	constructor(private readonly repo: IProyectoRepository) {}
	async execute(data: CreateHistoriaDTO): Promise<Result<HistoriaUsuario>> {
		try {
			const proyecto = await this.repo.findById(data.proyectoId)
			if (!proyecto) return { success: false, error: 'Proyecto no encontrado' }
			return { success: true, data: await this.repo.createHistoria(data) }
		} catch (error) {
			return fail(error)
		}
	}
}

export class UpdateHistoriaUseCase {
	constructor(private readonly repo: IProyectoRepository) {}
	async execute(data: UpdateHistoriaDTO): Promise<Result<HistoriaUsuario>> {
		try {
			const updated = await this.repo.updateHistoria(data)
			if (!updated) return { success: false, error: 'Historia de usuario no encontrada' }
			return { success: true, data: updated }
		} catch (error) {
			return fail(error)
		}
	}
}

export class UpdateHistoriaStatusUseCase {
	constructor(private readonly repo: IProyectoRepository) {}
	async execute(id: string, status: HistoriaStatus): Promise<Result<HistoriaUsuario>> {
		try {
			const updated = await this.repo.updateHistoria({ id, status })
			if (!updated) return { success: false, error: 'Historia de usuario no encontrada' }
			return { success: true, data: updated }
		} catch (error) {
			return fail(error)
		}
	}
}

export class DeleteHistoriaUseCase {
	constructor(private readonly repo: IProyectoRepository) {}
	async execute(id: string): Promise<Result<{ id: string }>> {
		try {
			await this.repo.deleteHistoria(id)
			return { success: true, data: { id } }
		} catch (error) {
			return fail(error)
		}
	}
}
