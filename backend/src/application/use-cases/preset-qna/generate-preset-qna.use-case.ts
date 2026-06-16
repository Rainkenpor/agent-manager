import type { IAgentRepository } from '@domain/repositories/agent.repository.js'
import type { IPresetQnaRepository } from '@domain/repositories/preset-qna.repository.js'
import { findBestMatch, MATCH_THRESHOLD } from '@infra/utils/text-match.js'
import { PUBLIC_CHAT_AGENT_SLUG } from '../chat/create-public-conversation.use-case.js'
import { generateAnonymizedQna } from './anonymize.js'

export class GeneratePresetQnaUseCase {
	constructor(
		private readonly repo: IPresetQnaRepository,
		private readonly agentRepository: IAgentRepository
	) {}

	async execute(input: { question: string; answer: string }): Promise<void> {
		const question = input.question?.trim()
		const answer = input.answer?.trim()
		if (!question || !answer) return

		const agent = await this.agentRepository.findBySlug(PUBLIC_CHAT_AGENT_SLUG)
		if (!agent) return

		// Evita duplicados: si la pregunta ya coincide con un grupo activo, no crea otro.
		const existing = await this.repo.findAllActive()
		const best = findBestMatch(question, existing)
		if (best && best.score >= MATCH_THRESHOLD) return

		const generated = await generateAnonymizedQna({ id: agent.id, name: agent.name, slug: agent.slug }, question, answer)
		if (!generated || generated.skip) return

		await this.repo.create({
			canonicalQuestion: generated.canonicalQuestion,
			questions: generated.questions,
			answer: generated.answer,
			agentSlug: agent.slug
		})
	}
}
