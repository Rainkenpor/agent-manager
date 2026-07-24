import type { IProyectoRepository } from '@domain/repositories/proyecto.repository.js'
import { AppDataSource } from '@infra/db/database.js'
import { AgentEntity, ConversationEntity } from '@infra/db/entities.js'
import { v4 as uuidv4 } from 'uuid'

type Result<T> = { success: true; data: T } | { success: false; error: string }

export interface ProyectoChatConversation {
	id: string
	title: string
	agentId: string
	proyectoId: string
}

/**
 * Obtiene la conversación de chat del proyecto para el usuario, o la crea si no existe,
 * ligándola al `proyectoId` y al agente configurado en el proyecto (o el primero disponible).
 */
export class GetOrCreateProyectoChatUseCase {
	constructor(private readonly repo: IProyectoRepository) {}

	async execute(proyectoId: string, userId: string): Promise<Result<ProyectoChatConversation>> {
		try {
			const proyecto = await this.repo.findById(proyectoId)
			if (!proyecto) return { success: false, error: 'Proyecto no encontrado' }

			const convRepo = AppDataSource.getRepository(ConversationEntity)
			const existing = await convRepo.findOne({ where: { proyectoId, userId }, order: { updatedAt: 'DESC' } })
			if (existing) {
				return { success: true, data: { id: existing.id, title: existing.title, agentId: existing.agentId, proyectoId } }
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
			return { success: true, data: { id: conv.id, title: conv.title, agentId, proyectoId } }
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
		}
	}
}
