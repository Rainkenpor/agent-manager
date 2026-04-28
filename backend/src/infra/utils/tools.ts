import type { IAgentServiceExecute, ToolCallbacks } from '@domain/entities/agent.entity.js'
import { z, type ZodRawShape } from 'zod'
import { registry } from '@applicationService/registry.service.js'
import { agentLogger } from '../service/logger.service.js'
import nodePath from 'node:path'
import fs from 'node:fs'
import { NextFunction, Request, Response } from 'express'
import { mcpExternalManager } from '../service/mcp-external.js'

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

/** Tool definitions for function-calling */
export function buildToolDefinitions(
	mcpExternal?: typeof mcpExternalManager,
	allowedTools?: Set<string>,
	toolsCallbacks?: ToolCallbacks
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

	if (allowedTools && allowedTools.size > 0) {
		const filterBaseTools = baseTools.filter((t) => allowedTools.has(t.function.name))
		const filteredMcp = mcpTools.filter((t) => allowedTools.has(`agent-manager_${t.function.name}`))
		const filteredExternal = externalMcpTools.filter((t) => allowedTools.has(t.function.name))
		return [...filterBaseTools, ...filteredMcp, ...filteredExternal]
	}

	if (!allowedTools || allowedTools.size === 0) {
		return []
	}

	return [...baseTools, ...mcpTools, ...externalMcpTools]
}

/** Execute a single tool call and return a string result */
export async function executeToolCall(
	newAgentService: () => any,
	toolName: string,
	args: Record<string, unknown>,
	originalParams: IAgentServiceExecute
): Promise<string> {
	try {
		originalParams.toolsCallbacks?.onToolCall(toolName, args) // Notificar a callbacks de herramienta invocada, si existe
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
					const data = await mcpExternalManager.callTool(toolName, args, originalParams.userId)
					return data
				}

				// Si no es una herramienta externa, intenta llamar a una herramienta registrada en el registry de la aplicación. Esto permite que las herramientas definidas en el código sean accesibles para los agentes.
				return await callRegisteredTool(toolName, args, originalParams.userId)
		}
	} catch (err) {
		return `Error in tool '${toolName}': ${err instanceof Error ? err.message : String(err)}`
	}
}
