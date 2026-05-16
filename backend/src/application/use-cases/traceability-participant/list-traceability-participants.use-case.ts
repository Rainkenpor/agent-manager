/*
Archivo creado con gobernanza AB900
*/

import type { ITraceabilityParticipantRepository } from '@domain/repositories/traceability-participant.repository.js'

export class ListTraceabilityParticipantsUseCase {
	constructor(private readonly participantRepo: ITraceabilityParticipantRepository) {}

	async execute(traceabilityId: string) {
		try {
			const data = await this.participantRepo.listByTraceability(traceabilityId)
			return { success: true as const, data }
		} catch (error) {
			return { success: false as const, error: error instanceof Error ? error.message : 'Error desconocido' }
		}
	}
}
