import type { ProyectoParticipante, ProyectoRecord } from '@domain/entities/proyecto.entity.js'
import type { IProyectoRepository } from '@domain/repositories/proyecto.repository.js'
import { AppDataSource } from '@infra/db/database.js'
import { AgentEntity, ConversationEntity, MessageEntity, UserEntity } from '@infra/db/entities.js'
import { v4 as uuidv4 } from 'uuid'

type Result<T> = { success: true; data: T } | { success: false; error: string }

function fail(error: unknown): { success: false; error: string } {
	return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
}

export interface ParticipanteView extends ProyectoParticipante {
	username: string | null
	email: string | null
	firstName: string | null
	lastName: string | null
}

export class ListParticipantesUseCase {
	constructor(private readonly repo: IProyectoRepository) {}
	async execute(proyectoId: string): Promise<Result<ParticipanteView[]>> {
		try {
			const participantes = await this.repo.findParticipantes(proyectoId)
			const userRepo = AppDataSource.getRepository(UserEntity)
			const enriched = await Promise.all(
				participantes.map(async (p) => {
					const u = await userRepo.findOneBy({ id: p.userId })
					return {
						...p,
						username: u?.username ?? null,
						email: u?.email ?? null,
						firstName: u?.firstName ?? null,
						lastName: u?.lastName ?? null
					}
				})
			)
			return { success: true, data: enriched }
		} catch (error) {
			return fail(error)
		}
	}
}

export class AddParticipanteUseCase {
	constructor(private readonly repo: IProyectoRepository) {}
	async execute(data: {
		proyectoId: string
		userId: string
		role?: string | null
		invitedBy?: string | null
	}): Promise<Result<ProyectoParticipante>> {
		try {
			const proyecto = await this.repo.findById(data.proyectoId)
			if (!proyecto) return { success: false, error: 'Proyecto no encontrado' }
			const user = await AppDataSource.getRepository(UserEntity).findOneBy({ id: data.userId })
			if (!user) return { success: false, error: 'Usuario no encontrado' }
			const existing = await this.repo.findParticipante(data.proyectoId, data.userId)
			if (existing) return { success: true, data: existing }
			return { success: true, data: await this.repo.addParticipante(data) }
		} catch (error) {
			return fail(error)
		}
	}
}

export class RemoveParticipanteUseCase {
	constructor(private readonly repo: IProyectoRepository) {}
	async execute(proyectoId: string, userId: string): Promise<Result<{ proyectoId: string; userId: string }>> {
		try {
			const participante = await this.repo.findParticipante(proyectoId, userId)
			if (participante?.chatId) {
				await AppDataSource.getRepository(MessageEntity).delete({ conversationId: participante.chatId })
				await AppDataSource.getRepository(ConversationEntity).delete({ id: participante.chatId })
			}
			await this.repo.removeParticipante(proyectoId, userId)
			return { success: true, data: { proyectoId, userId } }
		} catch (error) {
			return fail(error)
		}
	}
}

export interface ParticipanteChat {
	id: string
	title: string
	agentId: string
	proyectoId: string
	userId: string
}

export class OpenParticipanteChatUseCase {
	constructor(private readonly repo: IProyectoRepository) {}
	async execute(proyectoId: string, userId: string): Promise<Result<ParticipanteChat>> {
		try {
			const proyecto = await this.repo.findById(proyectoId)
			if (!proyecto) return { success: false, error: 'Proyecto no encontrado' }
			const participante = await this.repo.findParticipante(proyectoId, userId)
			if (!participante) return { success: false, error: 'El usuario no es interesado del proyecto' }

			const convRepo = AppDataSource.getRepository(ConversationEntity)
			if (participante.chatId) {
				const conv = await convRepo.findOneBy({ id: participante.chatId })
				if (conv) return { success: true, data: { id: conv.id, title: conv.title, agentId: conv.agentId, proyectoId, userId } }
			}

			let agentId = proyecto.chatAgentId
			if (!agentId) {
				const agents = await AppDataSource.getRepository(AgentEntity).find({ take: 1 })
				if (agents.length === 0) return { success: false, error: 'No hay agentes disponibles para el chat del proyecto' }
				agentId = agents[0].id
			}

			const now = new Date().toISOString()
			const conv = convRepo.create({
				id: uuidv4(),
				title: `Proyecto: ${proyecto.name}`,
				agentId,
				userId,
				draft: null,
				proyectoId,
				createdAt: now,
				updatedAt: now
			})
			await convRepo.save(conv)
			await this.repo.updateParticipante(participante.id, { chatId: conv.id })
			return { success: true, data: { id: conv.id, title: conv.title, agentId, proyectoId, userId } }
		} catch (error) {
			return fail(error)
		}
	}
}

export class ListMisProyectosUseCase {
	constructor(private readonly repo: IProyectoRepository) {}
	async execute(userId: string): Promise<Result<ProyectoRecord[]>> {
		try {
			return { success: true, data: await this.repo.findProyectosByParticipant(userId) }
		} catch (error) {
			return fail(error)
		}
	}
}
