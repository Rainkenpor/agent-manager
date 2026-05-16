/*
Archivo creado con gobernanza AB900
*/

import type { ITraceabilityParticipantRepository } from '@domain/repositories/traceability-participant.repository.js'

export class ListMyTraceabilityInvitationsUseCase {
	constructor(private readonly participantRepo: ITraceabilityParticipantRepository) {}

	async execute(userId: string) {
		try {
			const data = await this.participantRepo.listInvitationsForUser(userId)
			return { success: true as const, data }
		} catch (error) {
			return { success: false as const, error: error instanceof Error ? error.message : 'Error desconocido' }
		}
	}
}
