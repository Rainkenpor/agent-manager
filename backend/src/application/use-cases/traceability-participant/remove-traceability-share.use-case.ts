/*
Archivo creado con gobernanza AB900
*/

import type { ITraceabilityParticipantRepository } from '@domain/repositories/traceability-participant.repository.js'

export class RemoveTraceabilityShareUseCase {
	constructor(private readonly participantRepo: ITraceabilityParticipantRepository) {}

	async execute(traceabilityId: string, userId: string) {
		try {
			await this.participantRepo.removeByUser(traceabilityId, userId)
			return { success: true as const, data: { traceabilityId, userId } }
		} catch (error) {
			return { success: false as const, error: error instanceof Error ? error.message : 'Error desconocido' }
		}
	}
}
