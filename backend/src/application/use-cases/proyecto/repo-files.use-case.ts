import type { ProyectoServicio } from '@domain/entities/proyecto.entity.js'
import type { IProyectoRepository } from '@domain/repositories/proyecto.repository.js'
import { applyServiceFiles, verifyServiceFiles } from '@infra/service/repo-governance.service.js'

type Result<T> = { success: true; data: T } | { success: false; error: string }

function fail(error: unknown): { success: false; error: string } {
	return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
}

async function targetServicios(repo: IProyectoRepository, proyectoId: string, servicioId?: string): Promise<ProyectoServicio[]> {
	const servicios = await repo.findServicios(proyectoId)
	return servicioId ? servicios.filter((s) => s.id === servicioId) : servicios
}

export class VerifyRepoFilesUseCase {
	constructor(private readonly repo: IProyectoRepository) {}

	async execute(params: { proyectoId: string; servicioId?: string; userId?: string }): Promise<Result<ProyectoServicio[]>> {
		try {
			const proyecto = await this.repo.findById(params.proyectoId)
			if (!proyecto) return { success: false, error: 'Proyecto no encontrado' }
			const servicios = await targetServicios(this.repo, params.proyectoId, params.servicioId)
			const now = new Date().toISOString()
			const updated: ProyectoServicio[] = []
			for (const servicio of servicios) {
				const { agentMdStatus, claudeMdStatus } = await verifyServiceFiles(proyecto, servicio, params.userId)
				const result = await this.repo.updateServicio({ id: servicio.id, agentMdStatus, claudeMdStatus, lastCheckedAt: now })
				if (result) updated.push(result)
			}
			return { success: true, data: updated }
		} catch (error) {
			return fail(error)
		}
	}
}

export class ApplyRepoFilesUseCase {
	constructor(private readonly repo: IProyectoRepository) {}

	async execute(params: { proyectoId: string; servicioId?: string; userId?: string }): Promise<Result<ProyectoServicio[]>> {
		try {
			const proyecto = await this.repo.findById(params.proyectoId)
			if (!proyecto) return { success: false, error: 'Proyecto no encontrado' }
			const servicios = await targetServicios(this.repo, params.proyectoId, params.servicioId)
			const now = new Date().toISOString()
			const updated: ProyectoServicio[] = []
			for (const servicio of servicios) {
				const { agentMdStatus, claudeMdStatus } = await applyServiceFiles(proyecto, servicio, params.userId)
				const result = await this.repo.updateServicio({ id: servicio.id, agentMdStatus, claudeMdStatus, lastCheckedAt: now })
				if (result) updated.push(result)
			}
			return { success: true, data: updated }
		} catch (error) {
			return fail(error)
		}
	}
}
