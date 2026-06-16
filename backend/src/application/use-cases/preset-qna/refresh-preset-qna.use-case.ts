import type { PresetQnaRecord } from '@domain/entities/preset-qna.entity.js'
import type { IAgentRepository } from '@domain/repositories/agent.repository.js'
import type { IPresetQnaRepository } from '@domain/repositories/preset-qna.repository.js'
import { MCPAgentService } from '@infra/service/mcp-agent.service'
import { PUBLIC_CHAT_AGENT_SLUG } from '../chat/create-public-conversation.use-case.js'
import { generateAnonymizedQna } from './anonymize.js'

export class RefreshPresetQnaUseCase {
	constructor(
		private readonly repo: IPresetQnaRepository,
		private readonly agentRepository: IAgentRepository
	) {}

	async execute(id: string): Promise<{ success: true; data: PresetQnaRecord } | { success: false; error: string }> {
		try {
			const group = await this.repo.findById(id)
			if (!group) return { success: false, error: 'Grupo de preguntas no encontrado' }

			const agent = await this.agentRepository.findBySlug(group.agentSlug || PUBLIC_CHAT_AGENT_SLUG)
			if (!agent) return { success: false, error: 'El asistente no está disponible' }

			const res = await MCPAgentService.call({ id: agent.id, name: agent.name, slug: agent.slug }, { instruction: group.canonicalQuestion })
			const rawAnswer = (res.content?.[0]?.text ?? '').trim()
			if (!rawAnswer) return { success: false, error: 'El asistente no devolvió una respuesta' }

			const generated = await generateAnonymizedQna(
				{ id: agent.id, name: agent.name, slug: agent.slug },
				group.canonicalQuestion,
				rawAnswer
			)
			if (!generated || generated.skip) return { success: false, error: 'No se pudo regenerar la entrada' }

			const updated = await this.repo.update({
				id,
				canonicalQuestion: generated.canonicalQuestion,
				questions: generated.questions,
				answer: generated.answer
			})
			if (!updated) return { success: false, error: 'No se pudo actualizar' }
			return { success: true, data: updated }
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Error desconocido'
			return { success: false, error: `Error al actualizar: ${message}` }
		}
	}
}
