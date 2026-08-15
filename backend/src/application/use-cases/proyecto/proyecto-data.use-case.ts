import { emptyProyectoData, emptySection, type ProyectoData } from '@domain/entities/proyecto.entity.js'
import type { IProyectoRepository } from '@domain/repositories/proyecto.repository.js'
import { deleteAt, existsAt, parsePath, readAt, writeAt } from '@infra/utils/json-path.js'

type Result<T> = { success: true; data: T } | { success: false; error: string }

function fail(error: unknown): { success: false; error: string } {
	return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
}

/** Resultado de las operaciones de escritura: la sección tal como quedó. */
export interface ProyectoDataSegment {
	proyectoId: string
	section: string
	path?: string
	value: unknown
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

const notFound = (section: string, path: string) => ({
	success: false as const,
	error: `Ruta no encontrada en la sección "${section}": ${path}`
})

export class ReadProyectoDataUseCase {
	constructor(private readonly repo: IProyectoRepository) {}

	async execute(params: { proyectoId: string; section?: string; path?: string }): Promise<Result<unknown>> {
		try {
			const proyecto = await this.repo.findById(params.proyectoId)
			if (!proyecto) return { success: false, error: 'Proyecto no encontrado' }
			if (!params.section) return { success: true, data: proyecto.data }

			const segments = [params.section, ...parsePath(params.path)]
			const { found, value } = readAt(proyecto.data, segments)
			if (!found) return notFound(params.section, params.path ?? '')
			return { success: true, data: value }
		} catch (error) {
			return fail(error)
		}
	}
}

/** Base común de las escrituras: carga el proyecto, muta una copia del documento y persiste. */
abstract class WriteProyectoDataUseCase {
	constructor(protected readonly repo: IProyectoRepository) {}

	protected async withData(
		proyectoId: string,
		mutate: (data: ProyectoData) => Result<ProyectoDataSegment>
	): Promise<Result<ProyectoDataSegment>> {
		const proyecto = await this.repo.findById(proyectoId)
		if (!proyecto) return { success: false, error: 'Proyecto no encontrado' }

		const data: ProyectoData = { ...emptyProyectoData(), ...structuredClone(proyecto.data) }
		const mutation = mutate(data)
		if (!mutation.success) return mutation

		const updated = await this.repo.updateData(proyectoId, data)
		if (!updated) return { success: false, error: 'Proyecto no encontrado' }
		return mutation
	}
}

export class CreateProyectoDataUseCase extends WriteProyectoDataUseCase {
	async execute(params: { proyectoId: string; section: string; path?: string; value: unknown }): Promise<Result<ProyectoDataSegment>> {
		try {
			return this.withData(params.proyectoId, (data) => {
				const { section, path, value } = params
				if (!(section in data)) data[section] = emptySection(section)

				const segments = [section, ...parsePath(path)]
				const target = readAt(data, segments)

				if (Array.isArray(target.value)) {
					target.value.push(value)
				} else if (!path) {
					return { success: false, error: `La sección "${section}" no es una lista: indica un path para crear una clave dentro de ella.` }
				} else if (target.found) {
					return { success: false, error: `Ya existe un valor en "${section}.${path}". Usa update_proyecto_data para reemplazarlo.` }
				} else if (!writeAt(data, segments, value)) {
					return notFound(section, path)
				}

				return { success: true, data: { proyectoId: params.proyectoId, section, path, value: data[section] } }
			})
		} catch (error) {
			return fail(error)
		}
	}
}

export class UpdateProyectoDataUseCase extends WriteProyectoDataUseCase {
	async execute(params: {
		proyectoId: string
		section: string
		path?: string
		value: unknown
		merge?: boolean
	}): Promise<Result<ProyectoDataSegment>> {
		try {
			return this.withData(params.proyectoId, (data) => {
				const { section, path, value, merge } = params
				const segments = [section, ...parsePath(path)]
				const current = readAt(data, segments)
				if (!current.found && path) return notFound(section, path)

				const next = merge && isPlainObject(current.value) && isPlainObject(value) ? { ...current.value, ...value } : value
				if (!writeAt(data, segments, next)) return notFound(section, path ?? '')

				return { success: true, data: { proyectoId: params.proyectoId, section, path, value: data[section] } }
			})
		} catch (error) {
			return fail(error)
		}
	}
}

export class DeleteProyectoDataUseCase extends WriteProyectoDataUseCase {
	async execute(params: { proyectoId: string; section: string; path?: string }): Promise<Result<ProyectoDataSegment>> {
		try {
			return this.withData(params.proyectoId, (data) => {
				const { section, path } = params
				if (!path) {
					if (!(section in data)) return notFound(section, '')
					data[section] = emptySection(section)
				} else {
					const segments = [section, ...parsePath(path)]
					if (!existsAt(data, segments) || !deleteAt(data, segments)) return notFound(section, path)
				}

				return { success: true, data: { proyectoId: params.proyectoId, section, path, value: data[section] } }
			})
		} catch (error) {
			return fail(error)
		}
	}
}

/** Reemplaza una sección completa (usado por el panel JSON de la UI). */
export class ReplaceProyectoDataSectionUseCase extends WriteProyectoDataUseCase {
	async execute(params: { proyectoId: string; section: string; value: unknown }): Promise<Result<ProyectoDataSegment>> {
		try {
			return this.withData(params.proyectoId, (data) => {
				data[params.section] = params.value
				return { success: true, data: { proyectoId: params.proyectoId, section: params.section, value: params.value } }
			})
		} catch (error) {
			return fail(error)
		}
	}
}

/** Reemplaza el documento completo. */
export class ReplaceProyectoDataUseCase {
	constructor(private readonly repo: IProyectoRepository) {}

	async execute(params: { proyectoId: string; data: Record<string, unknown> }): Promise<Result<ProyectoData>> {
		try {
			const updated = await this.repo.updateData(params.proyectoId, { ...emptyProyectoData(), ...params.data })
			if (!updated) return { success: false, error: 'Proyecto no encontrado' }
			return { success: true, data: updated.data }
		} catch (error) {
			return fail(error)
		}
	}
}
