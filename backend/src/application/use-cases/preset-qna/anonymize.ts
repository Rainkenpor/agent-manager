import { agentLogger } from '@infra/service/logger.service.js'
import { MCPAgentService } from '@infra/service/mcp-agent.service'

/** Mínimo de variantes de pregunta que debe tener cada entrada de la base de FAQ. */
export const MIN_QUESTION_VARIANTS = 5

export interface GeneratedQna {
	skip: boolean
	canonicalQuestion: string
	questions: string[]
	answer: string
}

function buildInstruction(question: string, answer: string): string {
	return [
		'A partir de la PREGUNTA y la RESPUESTA siguientes, genera una entrada genérica y reutilizable para una base de preguntas frecuentes.',
		'',
		'REGLAS OBLIGATORIAS DE PRIVACIDAD:',
		'- Elimina por completo nombres de personas, apodos, direcciones, lugares específicos, fechas y cualquier dato que identifique o incrimine a alguien.',
		'- Reformula cualquier incidente concreto como una situación GENÉRICA. Ejemplo: "la compañera Carolina se besó con el compañero Juan, ¿qué procede?" -> "¿Qué procede cuando se da una situación inapropiada entre compañeros de trabajo?".',
		'- La respuesta debe expresarse como guía o política general, sin referirse a personas o hechos concretos.',
		'- Si la consulta es un caso puramente personal SIN valor generalizable para otros, marca "skip": true.',
		'',
		'Devuelve EXCLUSIVAMENTE un objeto JSON válido (sin texto adicional ni markdown) con esta forma:',
		'{"skip": boolean, "canonicalQuestion": string, "questions": string[], "answer": string}',
		`donde "questions" contiene OBLIGATORIAMENTE al menos ${MIN_QUESTION_VARIANTS} (idealmente entre 5 y 8) formas distintas y genéricas de preguntar lo mismo, en español, sin repetirse.`,
		'',
		`PREGUNTA: ${question}`,
		`RESPUESTA: ${answer}`
	].join('\n')
}

function parseGenerated(text: string): GeneratedQna | null {
	const start = text.indexOf('{')
	const end = text.lastIndexOf('}')
	if (start === -1 || end === -1 || end <= start) return null
	try {
		const obj = JSON.parse(text.slice(start, end + 1))
		if (typeof obj !== 'object' || obj === null) return null
		return {
			skip: obj.skip === true,
			canonicalQuestion: typeof obj.canonicalQuestion === 'string' ? obj.canonicalQuestion.trim() : '',
			questions: Array.isArray(obj.questions)
				? obj.questions.filter((q: unknown) => typeof q === 'string' && q.trim()).map((q: string) => q.trim())
				: [],
			answer: typeof obj.answer === 'string' ? obj.answer.trim() : ''
		}
	} catch {
		return null
	}
}

function dedupeQuestions(questions: string[]): string[] {
	const seen = new Set<string>()
	const out: string[] = []
	for (const q of questions) {
		const key = q.toLowerCase().replace(/\s+/g, ' ').trim()
		if (key && !seen.has(key)) {
			seen.add(key)
			out.push(q)
		}
	}
	return out
}

/**
 * Llama al agente (no-streaming) para producir una entrada FAQ genérica y anonimizada.
 * Garantiza al menos MIN_QUESTION_VARIANTS variantes (reintenta una vez si el modelo entrega menos).
 */
export async function generateAnonymizedQna(
	agent: { id: string; name: string; slug: string },
	question: string,
	answer: string
): Promise<GeneratedQna | null> {
	const reinforce = `Recuerda: "questions" DEBE incluir al menos ${MIN_QUESTION_VARIANTS} variantes distintas.`
	try {
		for (let attempt = 0; attempt < 2; attempt++) {
			const instruction = attempt === 0 ? buildInstruction(question, answer) : `${buildInstruction(question, answer)}\n\n${reinforce}`
			const res = await MCPAgentService.call({ id: agent.id, name: agent.name, slug: agent.slug }, { instruction })
			const generated = parseGenerated(res.content?.[0]?.text ?? '')
			if (!generated) continue
			if (generated.skip) return generated
			generated.questions = dedupeQuestions(generated.questions)
			if (!generated.canonicalQuestion || !generated.answer) continue
			if (generated.questions.length >= MIN_QUESTION_VARIANTS) return generated
		}
		agentLogger.warn(`[PresetQna] no se alcanzaron ${MIN_QUESTION_VARIANTS} variantes; se omite la entrada`)
		return null
	} catch (e) {
		agentLogger.warn(`[PresetQna] anonymization failed: ${e instanceof Error ? e.message : String(e)}`)
		return null
	}
}
