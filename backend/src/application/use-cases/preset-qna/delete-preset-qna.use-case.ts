import type { IPresetQnaRepository } from '@domain/repositories/preset-qna.repository.js'

export class DeletePresetQnaUseCase {
	constructor(private readonly repo: IPresetQnaRepository) {}

	async execute(id: string): Promise<{ success: true } | { success: false; error: string }> {
		try {
			const ok = await this.repo.delete(id)
			if (!ok) return { success: false, error: 'Grupo de preguntas no encontrado' }
			return { success: true }
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Error desconocido'
			return { success: false, error: `Error al eliminar: ${message}` }
		}
	}
}
