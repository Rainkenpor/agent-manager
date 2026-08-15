import fs from 'node:fs'
import nodePath from 'node:path'
import { registry } from '@applicationService/registry.service.js'
import type { DelegatableAgent, IAgentServiceExecute, ToolCallbacks } from '@domain/entities/agent.entity.js'
import type { NextFunction, Request, Response } from 'express'
import { type ZodRawShape, z } from 'zod'
import { agentLogger } from '../service/logger.service.js'
import { mcpExternalManager, parseMcpToolId } from '../service/mcp-external.js'

interface Tool {
	type: 'function'
	function: {
		name: string
		description: string
		parameters: Record<string, unknown>
	}
}

/** Resolve a path — absolute paths pass through, relative ones are joined to basePath */
function resolvePath(basePath: string, filePath: string): string {
	if (nodePath.isAbsolute(filePath)) return filePath
	return nodePath.join(basePath, filePath)
}

/** Minimalistic glob: resolves files matching a simple pattern with wildcards */
function walkFiles(
	dir: string,
	pattern: string,
	results: string[],
	maxResults: number,
	skipDirs: string[] = ['node_modules', '.git', 'dist', 'build']
): void {
	if (!fs.existsSync(dir) || results.length >= maxResults) return

	const parts = pattern.split('/')
	const head = parts[0]
	const tail = parts.slice(1).join('/')

	let entries: fs.Dirent[]
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true })
	} catch {
		return
	}

	for (const entry of entries) {
		if (results.length >= maxResults) break
		if (entry.isDirectory() && skipDirs.includes(entry.name)) continue

		const fullPath = nodePath.join(dir, entry.name)

		if (head === '**') {
			// Descend into subdirectory
			if (entry.isDirectory()) {
				walkFiles(fullPath, pattern, results, maxResults, skipDirs)
			}
			// Also try matching the rest of the pattern at current level
			if (tail) {
				walkFiles(dir, tail, results, maxResults, skipDirs)
			} else if (entry.isFile()) {
				results.push(fullPath)
			}
		} else {
			const regex = new RegExp(
				`^${head
					.replace(/[.+^${}()|[\]\\]/g, '\\$&')
					.replace(/\*/g, '.*')
					.replace(/\?/g, '.')}$`
			)
			if (regex.test(entry.name)) {
				if (tail) {
					if (entry.isDirectory()) {
						walkFiles(fullPath, tail, results, maxResults, skipDirs)
					}
				} else if (entry.isFile()) {
					results.push(fullPath)
				}
			}
		}
	}
}

/** Search for text/regex in files recursively */
function grepDirectory(
	dir: string,
	pattern: string,
	includePattern: string | undefined,
	isRegex: boolean,
	results: string[],
	maxResults: number,
	skipDirs = ['node_modules', '.git', 'dist', 'build', '.opencode']
): void {
	if (!fs.existsSync(dir) || results.length >= maxResults) return

	let entries: fs.Dirent[]
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true })
	} catch {
		return
	}

	const regex = isRegex ? new RegExp(pattern, 'i') : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')

	const includeRegex = includePattern
		? new RegExp(`^${includePattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`, 'i')
		: null

	for (const entry of entries) {
		if (results.length >= maxResults) break
		const fullPath = nodePath.join(dir, entry.name)

		if (entry.isDirectory()) {
			if (skipDirs.includes(entry.name)) continue
			grepDirectory(fullPath, pattern, includePattern, isRegex, results, maxResults, skipDirs)
		} else if (entry.isFile()) {
			if (includeRegex && !includeRegex.test(entry.name)) continue
			try {
				const content = fs.readFileSync(fullPath, 'utf-8')
				const lines = content.split('\n')
				for (let i = 0; i < lines.length; i++) {
					if (results.length >= maxResults) break
					if (regex.test(lines[i])) {
						results.push(`${fullPath}:${i + 1}: ${lines[i].trimEnd()}`)
					}
				}
			} catch {
				// Skip binary or unreadable files
			}
		}
	}
}

/** Invoke a registered MCP tool via the in-process registry */
async function callRegisteredTool(toolName: string, params: Record<string, unknown>, userId?: string | null): Promise<string> {
	const routes = registry.getRoutes()
	const route = routes.find(
		(r) =>
			(r.useBy?.includes('mcp') &&
				(r.toolName === toolName || r.toolName === `agent-manager_${toolName}` || toolName === `agent-manager_${r.toolName}`)) ||
			toolName === `mcp__agent-manager__${r.toolName}`
	)

	if (!route?.handler) {
		const available = routes
			.filter((r) => r.toolName && r.useBy?.includes('mcp'))
			.map((r) => r.toolName)
			.join(', ')
		return `MCP tool '${toolName}' not found. Available: ${available}`
	}

	try {
		const result = await route.handler({
			input: params as never,
			context: {
				req: userId ? ({ user: { id: userId } } as any as Request) : ({} as Request),
				res: {} as Response,
				next: (() => {}) as NextFunction,
				signal: new AbortController().signal // Proporcionar una señal de aborto vacía para herramientas que la requieran, aunque no se pueda abortar realmente en este contexto
			},
			oauthService: null as never
		})
		return JSON.stringify(result, null, 2)
	} catch (err) {
		return `MCP tool error: ${err instanceof Error ? err.message : String(err)}`
	}
}

export const DELEGATION_TOOL_PREFIX = 'agent_'

const MAX_DESCRIBED_TOOLS = 40

/**
 * El router elige a quién delegar sólo con lo que lee en la descripción de la tool, así que
 * además del perfil del agente se listan sus capacidades reales.
 */
function describeAgent(agent: DelegatableAgent): string {
	const lines = [`Agente de plataforma: ${agent.name}.${agent.description ? ` ${agent.description}` : ''}`]

	const tools = agent.tools ?? []
	if (tools.length > 0) {
		lines.push('Capacidades:')
		for (const tool of tools.slice(0, MAX_DESCRIBED_TOOLS)) {
			lines.push(`- ${tool.name}${tool.description ? `: ${tool.description.slice(0, 160)}` : ''}`)
		}
		if (tools.length > MAX_DESCRIBED_TOOLS) lines.push(`- …y ${tools.length - MAX_DESCRIBED_TOOLS} capacidades más`)
	}

	return lines.join('\n')
}

/** Tools de delegación: un `agent_<slug>` por cada agente que el usuario tiene permitido */
function buildDelegationTools(agents: DelegatableAgent[]): Tool[] {
	return agents.map((agent) => ({
		type: 'function' as const,
		function: {
			name: `${DELEGATION_TOOL_PREFIX}${agent.slug}`,
			description: describeAgent(agent),
			parameters: {
				type: 'object',
				properties: {
					instruction: {
						type: 'string',
						description:
							'Instrucción autocontenida para el agente. Debe incluir todo el contexto necesario: el agente no ve la conversación.'
					}
				},
				required: ['instruction']
			}
		}
	}))
}

/** Tool definitions for function-calling */
export function buildToolDefinitions(
	mcpExternal?: typeof mcpExternalManager,
	allowedTools?: Set<string>,
	toolsCallbacks?: ToolCallbacks,
	delegatableAgents?: DelegatableAgent[]
): Tool[] {
	const mcpRoutes = registry.getRoutes().filter((r) => r.useBy?.includes('mcp'))

	const baseTools: Tool[] = [
		{
			type: 'function',
			function: {
				name: 'spawn_subagent',
				description:
					'Spawn a specialised sub-agent to complete a focused documentation task. The sub-agent runs in the same project directory with its own instructions and tool access.',
				parameters: {
					type: 'object',
					properties: {
						agent_type: {
							type: 'string',
							description:
								"Sub-agent identifier matching a .md file in .opencode/agent/ or the server agent directory (e.g. 'analyzer', 'business-rules', 'diagrams', 'examples', 'technical-concepts', 'pending', 'commits')."
						},
						query: {
							type: 'string',
							description: 'Detailed task for the sub-agent.'
						},
						artifacts: {
							type: 'array',
							description: 'Optional files to provide as context to the sub-agent.',
							items: {
								type: 'object',
								properties: {
									name: { type: 'string' },
									content: { type: 'string' }
								},
								required: ['name', 'content']
							}
						}
					},
					required: ['agent_type', 'query']
				}
			}
		}
	]

	const mcpTools: Tool[] = mcpRoutes
		.filter((r) => r.toolName && r.toolDescription && r.inputSchema)
		.map((r) => {
			const zodSchema = r.inputSchema instanceof z.ZodObject ? r.inputSchema : z.object(r.inputSchema as ZodRawShape)
			const jsonSchema = z.toJSONSchema(zodSchema) as Record<string, unknown>
			// Remove top-level $schema key not needed by LLM APIs
			delete jsonSchema['$schema']
			return {
				type: 'function' as const,
				function: {
					name: r.toolName as string,
					description: r.toolDescription as string,
					parameters: jsonSchema
				}
			}
		})

	const externalMcpTools: Tool[] = mcpExternal ? (mcpExternal.getTools() as Tool[]) : []

	// La autorización de los agentes delegables ya se resolvió por rol al construir la lista,
	// por eso no pasan por el filtro de allowedTools.
	const delegationTools = buildDelegationTools(delegatableAgents ?? [])

	if (allowedTools && allowedTools.size > 0) {
		const filterBaseTools = baseTools.filter((t) => allowedTools.has(t.function.name))
		const filteredMcp = mcpTools.filter((t) => allowedTools.has(`agent-manager_${t.function.name}`))
		const filteredExternal = externalMcpTools.filter((t) => allowedTools.has(t.function.name))
		return [...delegationTools, ...filterBaseTools, ...filteredMcp, ...filteredExternal]
	}

	return delegationTools
}

/**
 * Delega la instrucción en otro agente de plataforma y devuelve su respuesta como resultado de tool.
 * Las acciones internas del subagente se reportan al chat etiquetadas con su agentId.
 */
async function delegateToAgent(
	agent: DelegatableAgent,
	instruction: string,
	callId: string,
	originalParams: IAgentServiceExecute
): Promise<string> {
	const { MCPAgentService } = await import('../service/mcp-agent.service.js')
	const parent = originalParams.toolsCallbacks

	await parent?.onAgentStart?.({ callId, id: agent.id, slug: agent.slug, name: agent.name, instruction })

	const nestedCallbacks: ToolCallbacks | undefined = parent && {
		...parent,
		onToolCall: (toolName, toolArgs, meta) => parent.onToolCall(toolName, toolArgs, { ...meta, agentId: agent.id })
	}

	const chunks: string[] = []
	try {
		for await (const chunk of MCPAgentService.asyncCall(agent, {
			instruction,
			toolsCallbacks: nestedCallbacks,
			userId: originalParams.userId,
			signal: originalParams.signal,
			auditSourceType: 'chat'
		})) {
			// Los marcadores de tool (<<id::name>>) son ruido para el agente que delega
			if (!chunk.startsWith('<<')) chunks.push(chunk)
		}
	} catch (err) {
		await parent?.onAgentEnd?.(callId, false)
		return `Error del agente '${agent.slug}': ${err instanceof Error ? err.message : String(err)}`
	}

	await parent?.onAgentEnd?.(callId, true)
	return chunks.join('').trim()
}

/** Execute a single tool call and return a string result */
export async function executeToolCall(
	newAgentService: () => any,
	toolName: string,
	args: Record<string, unknown>,
	originalParams: IAgentServiceExecute,
	callId?: string
): Promise<string> {
	const resolvedCallId = callId ?? `${toolName}-${Date.now()}`

	if (toolName.startsWith(DELEGATION_TOOL_PREFIX) && originalParams.delegatableAgents?.length) {
		const slug = toolName.slice(DELEGATION_TOOL_PREFIX.length)
		const agent = originalParams.delegatableAgents.find((a) => a.slug === slug)
		if (!agent) return `Agente no disponible: ${slug}`
		return await delegateToAgent(agent, String(args.instruction ?? ''), resolvedCallId, originalParams)
	}

	try {
		originalParams.toolsCallbacks?.onToolCall(toolName, args, { callId: resolvedCallId }) // Notificar a callbacks de herramienta invocada, si existe
		const result = await runTool(newAgentService, toolName, args, originalParams)
		await originalParams.toolsCallbacks?.onToolResult?.(resolvedCallId, true)
		return result
	} catch (err) {
		await originalParams.toolsCallbacks?.onToolResult?.(resolvedCallId, false)
		return `Error in tool '${toolName}': ${err instanceof Error ? err.message : String(err)}`
	}
}

async function runTool(
	newAgentService: () => any,
	toolName: string,
	args: Record<string, unknown>,
	originalParams: IAgentServiceExecute
): Promise<string> {
	switch (toolName) {
		case 'spawn_subagent': {
			const subType = args.agent_type as string
			agentLogger.info(`[InternalAgent] Spawning sub-agent: ${subType}`)
			const newAgentFactory = newAgentService()
			if (typeof newAgentFactory !== 'function') {
				return `Error: spawn_subagent requires a newAgentService factory bound via .bind()`
			}
			const subService = newAgentFactory()
			const subResult = await subService.executeAgent({
				agentType: subType as IAgentServiceExecute['agentSlug'],
				query: args.query as string,
				artifacts: args.artifacts as { name: string; content: string }[] | undefined
			})
			return `Sub-agent '${subType}' completed.\n${typeof subResult === 'string' ? subResult : ''}`
		}
		default:
			// Primero intenta herramientas externas MCP, luego las registradas en el registry. Las herramientas externas tienen prioridad si hay nombres coincidentes, asumiendo que son más específicas para el contexto de agentes.
			if (mcpExternalManager?.isMcpTool(toolName)) {
				const onToolImage = originalParams.toolsCallbacks?.onToolImage
				const parsed = parseMcpToolId(toolName)
				const onImage = onToolImage
					? (image: { mimeType: string; data: string }) => {
							void onToolImage({
								serverName: parsed?.serverName ?? '',
								serverId: parsed ? mcpExternalManager.getServerDbId(parsed.serverName) : undefined,
								toolName: parsed?.toolName ?? toolName,
								args,
								mimeType: image.mimeType,
								data: image.data
							})
						}
					: undefined
				const data = await mcpExternalManager.callTool(toolName, args, originalParams.userId, onImage)
				return data
			}

			// Si no es una herramienta externa, intenta llamar a una herramienta registrada en el registry de la aplicación. Esto permite que las herramientas definidas en el código sean accesibles para los agentes.
			return await callRegisteredTool(toolName, args, originalParams.userId)
	}
}
