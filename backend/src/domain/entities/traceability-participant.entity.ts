/*
Archivo creado con gobernanza AB900
*/

export interface TraceabilityParticipant {
	id: string
	traceabilityId: string
	userId: string
	chatId: string | null
	invitedBy: string
	createdAt: string
}

export interface CreateTraceabilityParticipantDTO {
	traceabilityId: string
	userId: string
	invitedBy: string
}

export interface TraceabilityInvitation {
	traceabilityId: string
	title: string
	description: string | null
	chatId: string | null
	agentId: string | null
	createdAt: string
}
