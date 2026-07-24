import type { CreateProyectoDTO, ProyectoRecord, UpdateProyectoDTO } from '@domain/entities/proyecto.entity.js'
import type { IProyectoRepository } from '@domain/repositories/proyecto.repository.js'

type Result<T> = { success: true; data: T } | { success: false; error: string }

function fail(error: unknown): { success: false; error: string } {
	return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
}

export class ListProyectosUseCase {
	constructor(private readonly repo: IProyectoRepository) {}
	async execute(): Promise<Result<ProyectoRecord[]>> {
		try {
			return { success: true, data: await this.repo.findAll() }
		} catch (error) {
			return fail(error)
		}
	}
}

export class GetProyectoUseCase {
	constructor(private readonly repo: IProyectoRepository) {}
	async execute(id: string): Promise<Result<ProyectoRecord>> {
		try {
			const data = await this.repo.findById(id)
			if (!data) return { success: false, error: 'Proyecto no encontrado' }
			return { success: true, data }
		} catch (error) {
			return fail(error)
		}
	}
}

export class CreateProyectoUseCase {
	constructor(private readonly repo: IProyectoRepository) {}
	async execute(data: CreateProyectoDTO): Promise<Result<ProyectoRecord>> {
		try {
			return { success: true, data: await this.repo.create(data) }
		} catch (error) {
			return fail(error)
		}
	}
}

export class UpdateProyectoUseCase {
	constructor(private readonly repo: IProyectoRepository) {}
	async execute(data: UpdateProyectoDTO): Promise<Result<ProyectoRecord>> {
		try {
			const updated = await this.repo.update(data)
			if (!updated) return { success: false, error: 'Proyecto no encontrado' }
			return { success: true, data: updated }
		} catch (error) {
			return fail(error)
		}
	}
}

export class DeleteProyectoUseCase {
	constructor(private readonly repo: IProyectoRepository) {}
	async execute(id: string): Promise<Result<{ id: string }>> {
		try {
			await this.repo.delete(id)
			return { success: true, data: { id } }
		} catch (error) {
			return fail(error)
		}
	}
}
