/**
 * image-marker.ts — Marcador embebido para persistir miniaturas de imágenes
 * generadas por tools MCP dentro del contenido de un mensaje de chat.
 *
 * Formato: al final del contenido se agrega una línea
 *   <!--am:images:<base64(JSON)>-->
 * donde el JSON es un arreglo de PersistedImage. El marcador es invisible al
 * renderizar texto plano y se elimina antes de enviar el historial al LLM.
 */

import type { PersistedImage } from '../../domain/entities/chat.entity.js'

export type { PersistedImage }

const MARKER_RE = /\n?<!--am:images:([A-Za-z0-9+/=]+)-->\s*$/

export function buildImageMarker(images: PersistedImage[]): string {
	const json = JSON.stringify(images)
	const base64 = Buffer.from(json, 'utf8').toString('base64')
	return `\n<!--am:images:${base64}-->`
}

export function parseImageMarker(content: string): { text: string; images: PersistedImage[] } {
	const match = content.match(MARKER_RE)
	if (!match) return { text: content, images: [] }
	try {
		const json = Buffer.from(match[1], 'base64').toString('utf8')
		const images = JSON.parse(json) as PersistedImage[]
		return { text: content.slice(0, match.index).trimEnd(), images }
	} catch {
		return { text: content, images: [] }
	}
}

export function stripImageMarker(content: string): string {
	return content.replace(MARKER_RE, '').trimEnd()
}
