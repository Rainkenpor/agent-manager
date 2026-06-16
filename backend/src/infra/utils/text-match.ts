import type { PresetQnaRecord } from '../../domain/entities/preset-qna.entity.js'

/** Umbral mínimo de similitud para considerar que una pregunta coincide con una preestablecida. */
export const MATCH_THRESHOLD = 0.62

const STOPWORDS = new Set([
	'que',
	'cual',
	'cuales',
	'como',
	'cuando',
	'donde',
	'quien',
	'porque',
	'por',
	'para',
	'una',
	'uno',
	'unos',
	'unas',
	'los',
	'las',
	'del',
	'con',
	'sin',
	'sobre',
	'entre',
	'y',
	'o',
	'a',
	'al',
	'de',
	'en',
	'el',
	'la',
	'lo',
	'es',
	'son',
	'se',
	'su',
	'sus',
	'mi',
	'me',
	'le',
	'si',
	'no',
	'hay'
])

/** lowercase, sin diacríticos, sin puntuación, espacios colapsados. */
export function normalize(s: string): string {
	return s
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
}

function tokens(s: string): string[] {
	return normalize(s)
		.split(' ')
		.filter((t) => t.length > 1 && !STOPWORDS.has(t))
}

function trigrams(s: string): Set<string> {
	const n = normalize(s).replace(/\s/g, '')
	const grams = new Set<string>()
	for (let i = 0; i < n.length - 2; i++) grams.add(n.slice(i, i + 3))
	return grams
}

function jaccard(a: string[], b: string[]): number {
	if (!a.length || !b.length) return 0
	const setA = new Set(a)
	const setB = new Set(b)
	let inter = 0
	for (const t of setA) if (setB.has(t)) inter++
	return inter / (setA.size + setB.size - inter)
}

function dice(a: Set<string>, b: Set<string>): number {
	if (!a.size || !b.size) return 0
	let inter = 0
	for (const g of a) if (b.has(g)) inter++
	return (2 * inter) / (a.size + b.size)
}

/** Similitud 0..1 combinando Jaccard de tokens y Dice de trigramas. */
export function similarity(a: string, b: string): number {
	const tok = jaccard(tokens(a), tokens(b))
	const tri = dice(trigrams(a), trigrams(b))
	return 0.6 * tok + 0.4 * tri
}

/** Mejor coincidencia entre la query y las variantes (+ pregunta canónica) de cada grupo. */
export function findBestMatch(query: string, groups: PresetQnaRecord[]): { group: PresetQnaRecord; score: number } | null {
	let best: { group: PresetQnaRecord; score: number } | null = null
	for (const group of groups) {
		const candidates = [group.canonicalQuestion, ...group.questions]
		let score = 0
		for (const c of candidates) score = Math.max(score, similarity(query, c))
		if (!best || score > best.score) best = { group, score }
	}
	return best
}

/** Sugerencias para el typeahead: preguntas que comparten tokens con el texto parcial. */
export function suggest(partial: string, groups: PresetQnaRecord[], limit = 6): Array<{ id: string; question: string }> {
	const qTokens = tokens(partial)
	if (!qTokens.length) return []
	const scored: Array<{ id: string; question: string; score: number }> = []
	const seen = new Set<string>()
	for (const group of groups) {
		const candidates = [group.canonicalQuestion, ...group.questions]
		let best = ''
		let bestScore = 0
		for (const c of candidates) {
			const cTokens = tokens(c)
			const matched = qTokens.filter((t) => cTokens.some((ct) => ct.startsWith(t) || t.startsWith(ct))).length
			const score = matched / qTokens.length + 0.001 * similarity(partial, c)
			if (score > bestScore) {
				bestScore = score
				best = c
			}
		}
		if (bestScore >= 0.5 && best && !seen.has(best)) {
			seen.add(best)
			scored.push({ id: group.id, question: best, score: bestScore })
		}
	}
	scored.sort((a, b) => b.score - a.score)
	return scored.slice(0, limit).map(({ id, question }) => ({ id, question }))
}
