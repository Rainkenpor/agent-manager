/*
Archivo creado con gobernanza AB900
*/

import type { ITraceabilityRepository } from '@domain/repositories/traceability.repository.js'
import type { ITraceabilityParticipantRepository } from '@domain/repositories/traceability-participant.repository.js'
import type { IUserRepository } from '@domain/repositories/user.repository.js'

export class ShareTraceabilityUseCase {
	constructor(
		private readonly participantRepo: ITraceabilityParticipantRepository,
		private readonly traceabilityRepo: ITraceabilityRepository,
		private readonly userRepo: IUserRepository
	) {}

	async execute(params: { traceabilityId: string; userId: string; invitedBy: string }) {
		try {
			const traceability = await this.traceabilityRepo.findById(params.traceabilityId)
			if (!traceability) return { success: false as const, error: 'Trazabilidad no encontrada' }

			const targetUser = await this.userRepo.findById(params.userId)
			if (!targetUser) return { success: false as const, error: 'Usuario destino no existe' }

			if (params.userId === traceability.createdBy) {
				return { success: false as const, error: 'El usuario ya es propietario de la trazabilidad' }
			}

			const existing = await this.participantRepo.findOne(params.traceabilityId, params.userId)
			if (existing) return { success: true as const, data: existing }

			const data = await this.participantRepo.add({
				traceabilityId: params.traceabilityId,
				userId: params.userId,
				invitedBy: params.invitedBy
			})
			return { success: true as const, data }
		} catch (error) {
			return { success: false as const, error: error instanceof Error ? error.message : 'Error desconocido' }
		}
	}
}
