/*
Archivo creado con gobernanza AB900
*/

import type { ITraceabilityRepository } from '@domain/repositories/traceability.repository.js'
import type { ITraceabilityParticipantRepository } from '@domain/repositories/traceability-participant.repository.js'
import type { IUserRepository } from '@domain/repositories/user.repository.js'

export class ListTraceabilityParticipantsUseCase {
	constructor(
		private readonly participantRepo: ITraceabilityParticipantRepository,
		private readonly traceabilityRepo: ITraceabilityRepository,
		private readonly userRepo: IUserRepository
	) {}

	async execute(traceabilityId: string) {
		try {
			const participants = await this.participantRepo.listByTraceability(traceabilityId)

			const traceability = await this.traceabilityRepo.findById(traceabilityId)
			const stageRoleIds = new Set<string>()
			for (const stage of traceability?.stages ?? []) {
				if (stage.role) stageRoleIds.add(stage.role)
			}

			const data = await Promise.all(
				participants.map(async (p) => {
					let hasRoleMatch = false
					if (stageRoleIds.size > 0) {
						const userRoles = await this.userRepo.getRoles(p.userId)
						hasRoleMatch = userRoles.some((r) => stageRoleIds.has(r.id))
					}
					return { ...p, hasRoleMatch }
				})
			)

			return { success: true as const, data }
		} catch (error) {
			return { success: false as const, error: error instanceof Error ? error.message : 'Error desconocido' }
		}
	}
}
