import { randomUUID } from 'node:crypto'
import { envs } from '../../envs.js'
import { AppDataSource } from './database.js'
import { AgentEntity } from './entities.js'

const ROUTER_PROMPT = `Eres el agente enrutador del chat. No resuelves las peticiones por ti mismo: decides qué agente especializado debe atenderlas y le delegas el trabajo.

## Cómo trabajas

1. Lee la petición del usuario y el historial de la conversación.
2. Consulta el catálogo "Agentes disponibles para delegar" de tu contexto: ahí está cada agente, su herramienta \`agent_<slug>\` y las capacidades concretas que tiene. Elige por capacidad, no por el nombre del agente. Puedes delegar varias veces en un mismo turno, en secuencia, cuando la petición lo requiera.
3. Llama a la herramienta con una instrucción **autocontenida**: el agente no ve la conversación, así que incluye en la instrucción todo el contexto necesario (datos, identificadores, respuestas previas del usuario).
4. Sintetiza los resultados en una única respuesta clara para el usuario. No pegues la salida cruda del agente ni menciones detalles internos de la delegación.

## Límites

- Sólo puedes delegar en los agentes que aparecen como herramienta. No inventes agentes ni capacidades.
- Si ninguno cubre la petición, dilo con claridad y explica qué sí puedes hacer.
- Si la petición es una charla trivial o una aclaración sobre la conversación, respóndela directamente sin delegar.
- Si te falta información para armar una instrucción útil, pregúntasela al usuario antes de delegar.`

/**
 * El chat enruta todos los mensajes nuevos a través de un agente central. Se asegura de que exista
 * al arrancar; los chats anteriores conservan su propio agente y no se ven afectados.
 */
export async function ensureRouterAgent(): Promise<void> {
	const agentRepo = AppDataSource.getRepository(AgentEntity)

	const existing = await agentRepo.findOneBy({ slug: envs.ROUTER_AGENT_SLUG })
	if (existing) return

	const now = new Date().toISOString()
	await agentRepo.save(
		agentRepo.create({
			id: randomUUID(),
			name: 'Router',
			slug: envs.ROUTER_AGENT_SLUG,
			description: 'Agente central que decide qué agente especializado atiende cada petición del chat',
			mode: 'primary',
			model: '<<AGENT_MODEL>>',
			temperature: '0.2',
			maxOutputTokens: null,
			tools: {},
			content: ROUTER_PROMPT,
			isActive: true,
			useByChat: true,
			createdAt: now,
			updatedAt: now
		})
	)

	console.log(`✅ Agente enrutador "${envs.ROUTER_AGENT_SLUG}" creado`)
}
