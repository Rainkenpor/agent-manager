import type { HistoriaComentario } from '@domain/entities/proyecto.entity.js'
import type { IProyectoRepository } from '@domain/repositories/proyecto.repository.js'

type Result<T> = { success: true; data: T } | { success: false; error: string }

function fail(error: unknown): { success: false; error: string } {
	return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
}

export class ListComentariosUseCase {
	constructor(private readonly repo: IProyectoRepository) {}
	async execute(historiaId: string): Promise<Result<HistoriaComentario[]>> {
		try {
			return { success: true, data: await this.repo.findComentarios(historiaId) }
		} catch (error) {
			return fail(error)
		}
	}
}

export class AddComentarioUseCase {
	constructor(private readonly repo: IProyectoRepository) {}
	async execute(data: { historiaId: string; author: string; content: string }): Promise<Result<HistoriaComentario>> {
		try {
			const historia = await this.repo.findHistoriaById(data.historiaId)
			if (!historia) return { success: false, error: 'Historia de usuario no encontrada' }
			return { success: true, data: await this.repo.createComentario(data) }
		} catch (error) {
			return fail(error)
		}
	}
}
