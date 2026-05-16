/*
Archivo creado con gobernanza AB900
*/

import type {
	CreateTraceabilityParticipantDTO,
	TraceabilityInvitation,
	TraceabilityParticipant
} from '../entities/traceability-participant.entity.js'

export interface ITraceabilityParticipantRepository {
	add(data: CreateTraceabilityParticipantDTO): Promise<TraceabilityParticipant>
	removeByUser(traceabilityId: string, userId: string): Promise<void>
	listByTraceability(traceabilityId: string): Promise<TraceabilityParticipant[]>
	listByUser(userId: string): Promise<TraceabilityParticipant[]>
	findOne(traceabilityId: string, userId: string): Promise<TraceabilityParticipant | null>
	setChatId(id: string, chatId: string | null): Promise<void>
	listInvitationsForUser(userId: string): Promise<TraceabilityInvitation[]>
}
