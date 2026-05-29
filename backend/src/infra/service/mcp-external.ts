/**
 * mcp-external.ts — Cliente MCP externo para el agente interno
 *
 * Gestiona conexiones a servidores MCP registrados en la base de datos:
 *   - Servidores HTTP (Streamable HTTP / SSE)  → type: 'http', url: '...'
 *   - Servidores stdio (child_process)          → type: 'stdio', command: '...'
 *
 * Convención de nombres de herramientas:  mcp__<serverName>__<toolName>
 */
import { type ChildProcess, spawn } from 'node:child_process'
import jwt from 'jsonwebtoken'
import type { ZodRawShape } from 'zod'
import type { IMcpCredentialProvider } from '../../domain/repositories/mcp-credential-provider.repository.js'
import { agentLogger } from '../service/logger.service.js'
import { JWT_SECRET } from './passport.service.js'

// ── MCP config types ──────────────────────────────────────────────────────────

interface McpServerHttpConfig {
	url: string
	headers?: Record<string, string>
}

interface McpServerStdioConfig {
	command: string
	args?: string[]
	env?: Record<string, string>
	type?: 'stdio'
}

type McpServerConfig = McpServerHttpConfig | McpServerStdioConfig

// ── MCP Protocol types ────────────────────────────────────────────────────────

interface McpTool {
	name: string
	description?: string
	inputSchema?: Record<string, unknown>
}

interface JsonRpcRequest {
	jsonrpc: '2.0'
	method: string
	id: number
	params?: Record<string, unknown>
}

interface JsonRpcNotification {
	jsonrpc: '2.0'
	method: string
	params?: Record<string, unknown>
}

interface JsonRpcResponse {
	jsonrpc: '2.0'
	id: number
	result?: unknown
	error?: { code: number; message: string }
}

export interface AgentTool {
	type: 'function'
	function: {
		name: string
		description: string
		parameters: Record<string, unknown>
	}
}

/** Imagen devuelta por una tool MCP (bloque content de tipo 'image'). */
export interface McpImage {
	mimeType: string
	data: string
}

/** Callback invocado por cada bloque de imagen presente en el resultado de una tool. */
export type OnMcpImage = (image: McpImage) => void

type McpContentBlock = { type: string; text?: string; data?: string; mimeType?: string }

/**
 * Procesa el `content` de un resultado tools/call: une los bloques de texto y
 * reenvía cada bloque de imagen a `onImage`. Las imágenes no se incluyen en el
 * string devuelto (que va al historial del LLM); solo se deja un placeholder.
 */
function processToolContent(content: McpContentBlock[], isError: boolean | undefined, onImage?: OnMcpImage): string {
	const parts: string[] = []
	let imageCount = 0
	for (const block of content) {
		if (block.type === 'text' && block.text) {
			parts.push(block.text)
		} else if (block.type === 'image' && block.data) {
			imageCount++
			onImage?.({ mimeType: block.mimeType ?? 'image/png', data: block.data })
		}
	}
	if (imageCount > 0) {
		parts.push(`[${imageCount} imagen(es) generada(s) y mostrada(s) al usuario en el chat]`)
	}
	const text = parts.join('\n')
	return isError ? `MCP tool error: ${text}` : text || 'OK'
}

// ── Tool ID convention ────────────────────────────────────────────────────────

const MCP_PREFIX = 'mcp__'

// ── Resiliency tuning ─────────────────────────────────────────────────────────

/** Tiempo máximo para una petición HTTP a un MCP externo antes de abortar. */
const MCP_HTTP_TIMEOUT_MS = 30_000

export function buildMcpToolId(serverName: string, toolName: string): string {
	return `${MCP_PREFIX}${serverName}__${toolName}`
}

export function parseMcpToolId(id: string): { serverName: string; toolName: string } | null {
	if (!id.startsWith(MCP_PREFIX)) return null
	const rest = id.slice(MCP_PREFIX.length)
	const sep = rest.indexOf('__')
	if (sep === -1) return null
	return { serverName: rest.slice(0, sep), toolName: rest.slice(sep + 2) }
}

// ── HTTP MCP Client (Streamable HTTP) ─────────────────────────────────────────

class McpHttpClient {
	private sessionId?: string
	private nextId = 1

	constructor(
		private readonly url: string,
		private readonly extraHeaders: Record<string, string> = {}
	) {}

	private buildHeaders(additional?: Record<string, string>): Record<string, string> {
		const h: Record<string, string> = {
			'content-type': 'application/json',
			accept: 'application/json, text/event-stream',
			...this.extraHeaders,
			...(additional ?? {})
		}
		if (this.sessionId) h['mcp-session-id'] = this.sessionId
		return h
	}

	private async post(payload: unknown, additionalHeaders?: Record<string, string>): Promise<Response> {
		try {
			return await fetch(this.url, {
				method: 'POST',
				headers: this.buildHeaders(additionalHeaders),
				body: JSON.stringify(payload),
				signal: AbortSignal.timeout(MCP_HTTP_TIMEOUT_MS)
			})
		} catch (err) {
			if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
				throw new Error(`MCP HTTP request to ${this.url} timed out after ${MCP_HTTP_TIMEOUT_MS}ms`)
			}
			throw err
		}
	}

	private async sendRequest(
		method: string,
		params?: Record<string, unknown>,
		additionalHeaders?: Record<string, string>
	): Promise<unknown> {
		const id = this.nextId++
		const body: JsonRpcRequest = {
			jsonrpc: '2.0',
			method,
			id,
			params: params ?? {}
		}

		const res = await this.post(body, additionalHeaders)

		const newSession = res.headers.get('mcp-session-id')
		if (newSession) this.sessionId = newSession

		if (!res.ok) {
			const text = await res.text()
			throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`)
		}

		const contentType = res.headers.get('content-type') ?? ''

		if (contentType.includes('text/event-stream')) {
			return this.readSSEResult(await res.text(), id)
		}

		const json = (await res.json()) as JsonRpcResponse | JsonRpcResponse[] | null
		const response = Array.isArray(json) ? json.find((r) => r.id === id) : (json ?? undefined)

		if (!response) throw new Error(`No JSON-RPC response for id=${id}`)
		if (response.error) throw new Error(`MCP: ${response.error.message}`)
		return response.result
	}

	private readSSEResult(text: string, targetId: number): unknown {
		for (const line of text.split('\n')) {
			if (!line.startsWith('data: ')) continue
			const data = line.slice(6).trim()
			if (data === '[DONE]') break
			try {
				const json = JSON.parse(data) as JsonRpcResponse
				if (json.id !== targetId) continue
				if (json.error) throw new Error(`MCP: ${json.error.message}`)
				if (json.result !== undefined) return json.result
			} catch {
				// skip non-JSON
			}
		}
		return null
	}

	async initialize(): Promise<void> {
		await this.sendRequest('initialize', {
			protocolVersion: '2024-11-05',
			capabilities: {},
			clientInfo: { name: 'agent-manager-internal-agent', version: '1.0.0' }
		})
		// Initialized notification (fire-and-forget)
		const notif: JsonRpcNotification = {
			jsonrpc: '2.0',
			method: 'notifications/initialized'
		}
		await this.post(notif).catch(() => {})
	}

	async listTools(): Promise<McpTool[]> {
		const result = (await this.sendRequest('tools/list')) as {
			tools?: McpTool[]
		} | null
		return result?.tools ?? []
	}

	async callTool(
		toolName: string,
		args: Record<string, unknown>,
		additionalHeaders?: Record<string, string>,
		onImage?: OnMcpImage
	): Promise<string> {
		const result = (await this.sendRequest(
			'tools/call',
			{
				name: toolName,
				arguments: args
			},
			additionalHeaders
		)) as {
			content?: McpContentBlock[]
			isError?: boolean
		} | null

		if (!result?.content) return 'Tool returned no content'
		return processToolContent(result.content, result.isError, onImage)
	}
}

// ── stdio MCP Client ──────────────────────────────────────────────────────────

class McpStdioClient {
	private process?: ChildProcess
	private buffer = ''
	private nextId = 1
	private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()

	constructor(
		private readonly serverName: string,
		private readonly command: string,
		private readonly args: string[],
		private readonly extraEnv: Record<string, string> = {}
	) {}

	private spawnProcess(): void {
		const isWindows = process.platform === 'win32'
		this.process = spawn(this.command, this.args, {
			env: { ...process.env, ...this.extraEnv },
			stdio: ['pipe', 'pipe', 'pipe'],
			shell: isWindows
		})

		this.process.stdout?.on('data', (chunk: Buffer) => {
			this.buffer += chunk.toString()
			this.drainBuffer()
		})

		this.process.stderr?.on('data', (data: Buffer) => {
			agentLogger.debug(`[MCP stdio:${this.serverName}] ${data.toString().trimEnd()}`)
		})

		this.process.on('exit', (code) => {
			agentLogger.info(`[MCP stdio:${this.serverName}] exited code=${code ?? 'null'}`)
			for (const { reject } of this.pending.values()) {
				reject(new Error(`MCP server '${this.serverName}' exited unexpectedly`))
			}
			this.pending.clear()
		})

		this.process.on('error', (err) => {
			agentLogger.error(`[MCP stdio:${this.serverName}] spawn error: ${err.message}`)
		})
	}

	private drainBuffer(): void {
		const lines = this.buffer.split('\n')
		this.buffer = lines.pop() ?? ''
		for (const line of lines) {
			if (!line.trim()) continue
			try {
				const json = JSON.parse(line) as JsonRpcResponse
				const entry = this.pending.get(json.id)
				if (!entry) continue
				this.pending.delete(json.id)
				if (json.error) {
					entry.reject(new Error(`MCP: ${json.error.message}`))
				} else {
					entry.resolve(json.result)
				}
			} catch {
				// skip
			}
		}
	}

	private writeLine(data: unknown): void {
		this.process?.stdin?.write(JSON.stringify(data) + '\n')
	}

	private sendRequest(method: string, params?: Record<string, unknown>): Promise<unknown> {
		const id = this.nextId++
		return new Promise<unknown>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(id)
				reject(new Error(`MCP stdio '${this.serverName}' timeout: ${method}`))
			}, 30_000)
			this.pending.set(id, {
				resolve: (v) => {
					clearTimeout(timer)
					resolve(v)
				},
				reject: (e) => {
					clearTimeout(timer)
					reject(e)
				}
			})
			this.writeLine({ jsonrpc: '2.0', method, id, params: params ?? {} })
		})
	}

	async initialize(): Promise<void> {
		this.spawnProcess()
		await this.sendRequest('initialize', {
			protocolVersion: '2024-11-05',
			capabilities: {},
			clientInfo: { name: 'agent-manager-internal-agent', version: '1.0.0' }
		})
		this.writeLine({ jsonrpc: '2.0', method: 'notifications/initialized' })
	}

	async listTools(): Promise<McpTool[]> {
		const result = (await this.sendRequest('tools/list')) as {
			tools?: McpTool[]
		} | null
		return result?.tools ?? []
	}

	async callTool(toolName: string, args: Record<string, unknown>, onImage?: OnMcpImage): Promise<string> {
		const result = (await this.sendRequest('tools/call', {
			name: toolName,
			arguments: args
		})) as {
			content?: McpContentBlock[]
			isError?: boolean
		} | null

		if (!result?.content) return 'Tool returned no content'
		return processToolContent(result.content, result.isError, onImage)
	}

	cleanup(): void {
		try {
			this.process?.kill()
		} catch {
			// ignore
		}
	}
}

// ── McpExternalManager ────────────────────────────────────────────────────────

interface StoredServerConfig {
	type: 'http' | 'stdio' | 'local'
	url?: string
	command?: string
	args?: string[]
	baseEnv?: Record<string, string>
	baseHeaders?: Record<string, string>
}

export class McpExternalManager {
	private httpClients = new Map<string, McpHttpClient>()
	private stdioClients = new Map<string, McpStdioClient>()
	private toolMap = new Map<string, { serverName: string; toolName: string }>()
	private tools: AgentTool[] = []
	/** Maps serverName → DB primary key, set when initialized from DB */
	private serverDbIds = new Map<string, string>()
	/** Stores base config per serverName for credential injection */
	private serverConfigs = new Map<string, StoredServerConfig>()
	/** Puerto para resolver credenciales de usuario (inyectado desde la capa de aplicación) */
	private credentialProvider?: IMcpCredentialProvider

	/** Inyecta el proveedor de credenciales (llamar desde el contenedor IoC). */
	setCredentialProvider(provider: IMcpCredentialProvider): void {
		this.credentialProvider = provider
	}

	/** Carga todos los servidores activos desde la base de datos e inicializa cada uno */
	async initializeFromDatabase(
		servers: Array<{
			id: string
			name: string
			type: 'http' | 'stdio' | 'local'
			url?: string | null
			command?: string | null
			args?: string[] | null
			headers?: Record<string, string> | null
			active: boolean
		}>
	): Promise<void> {
		const active = servers.filter((s) => s.active)
		agentLogger.info(`[McpExternal] Initializing ${active.length} MCP server(s) from database`)

		const results = await Promise.allSettled(
			active.map((s) => {
				this.serverDbIds.set(s.name, s.id)
				if (s.type === 'http' && s.url) {
					return this.initServer(s.name, { url: s.url, headers: s.headers ?? {} })
				} else if (s.type === 'stdio' && s.command) {
					return this.initServer(s.name, { command: s.command, args: s.args ?? [] })
				}
				agentLogger.warn(`[McpExternal] Skipping server '${s.name}': missing url/command`)
				return Promise.resolve()
			})
		)

		const failed = results.filter((r) => r.status === 'rejected')
		if (failed.length) {
			agentLogger.warn(`[McpExternal] ${failed.length} server(s) failed to initialize`)
		}
		agentLogger.info(`[McpExternal] Ready — ${this.tools.length} external MCP tool(s) available`)
	}

	async initServer(name: string, cfg: McpServerConfig): Promise<void> {
		let tools: McpTool[]

		if ('url' in cfg && cfg.url) {
			const headers = cfg.headers ?? {}
			const client = new McpHttpClient(cfg.url, headers)
			await client.initialize()
			tools = await client.listTools()
			this.httpClients.set(name, client)
			this.serverConfigs.set(name, { type: 'http', url: cfg.url, baseHeaders: headers })
			agentLogger.info(`[McpExternal] '${name}' (HTTP) → ${tools.length} tool(s)`)
		} else if ('command' in cfg && cfg.command) {
			const env = cfg.env ?? {}
			const client = new McpStdioClient(name, cfg.command, cfg.args ?? [], env)
			await client.initialize()
			tools = await client.listTools()
			this.stdioClients.set(name, client)
			this.serverConfigs.set(name, { type: 'stdio', command: cfg.command, args: cfg.args ?? [], baseEnv: env })
			agentLogger.info(`[McpExternal] '${name}' (stdio) → ${tools.length} tool(s)`)
		} else {
			agentLogger.warn(`[McpExternal] Unknown config for server '${name}'`)
			return
		}

		this.setServerTools(name, tools)
	}

	/** Limpia las entradas cacheadas de un servidor y las reconstruye desde la lista de tools dada. */
	private setServerTools(name: string, tools: McpTool[]): void {
		const prefix = `${MCP_PREFIX}${name}__`
		for (const toolId of [...this.toolMap.keys()]) {
			if (toolId.startsWith(prefix)) this.toolMap.delete(toolId)
		}
		this.tools = this.tools.filter((t) => !t.function.name.startsWith(prefix))

		for (const tool of tools) {
			const toolId = buildMcpToolId(name, tool.name)
			this.toolMap.set(toolId, { serverName: name, toolName: tool.name })

			const schema = {
				...(tool.inputSchema ?? { type: 'object', properties: {} })
			}
			delete (schema as Record<string, unknown>)['$schema']

			this.tools.push({
				type: 'function',
				function: {
					name: toolId,
					description: `[${name}] ${tool.description ?? tool.name}`,
					parameters: schema as Record<string, unknown>
				}
			})
		}
	}

	/** Re-consulta la lista de tools en vivo desde un servidor ya conectado y reconstruye su caché. */
	async refreshServerTools(serverName: string): Promise<void> {
		const client = this.httpClients.get(serverName) ?? this.stdioClients.get(serverName)
		if (!client) return
		const tools = await client.listTools()
		this.setServerTools(serverName, tools)
		agentLogger.info(`[McpExternal] '${serverName}' refreshed → ${tools.length} tool(s)`)
	}

	/**
	 * Ensures a DB-registered MCP server is initialized (idempotent).
	 * Config shape matches McpServerEntity fields.
	 */
	async ensureServerInitialized(
		serverName: string,
		config: {
			type: 'http' | 'stdio' | 'local'
			url?: string | null
			command?: string | null
			args?: string[] | null
			headers?: Record<string, string> | null
		},
		serverId?: string
	): Promise<void> {
		if (this.httpClients.has(serverName) || this.stdioClients.has(serverName)) {
			if (serverId) this.serverDbIds.set(serverName, serverId)
			return // already up
		}
		if (serverId) this.serverDbIds.set(serverName, serverId)
		if (config.type === 'http' && config.url) {
			await this.initServer(serverName, {
				url: config.url,
				headers: config.headers ?? {}
			})
		} else if (config.type === 'stdio' && config.command) {
			await this.initServer(serverName, {
				command: config.command,
				args: config.args ?? []
			})
		}
	}

	/** Returns the DB primary key for a server initialized from the DB, if known. */
	getServerDbId(serverName: string): string | undefined {
		return this.serverDbIds.get(serverName)
	}

	/** Returns true if the server has an active client connection. */
	isConnected(serverName: string): boolean {
		return this.httpClients.has(serverName) || this.stdioClients.has(serverName)
	}

	/** Disconnects a server and removes its tools from the registry. */
	disconnect(serverName: string): void {
		const stdio = this.stdioClients.get(serverName)
		if (stdio) {
			stdio.cleanup()
			this.stdioClients.delete(serverName)
		}
		this.httpClients.delete(serverName)

		const prefix = `${MCP_PREFIX}${serverName}__`
		for (const toolId of [...this.toolMap.keys()]) {
			if (toolId.startsWith(prefix)) this.toolMap.delete(toolId)
		}
		this.tools = this.tools.filter((t) => !t.function.name.startsWith(prefix))
	}

	/**
	 * Returns tools belonging to a specific server, with parsed metadata.
	 */
	getToolsForServer(serverName: string): Array<{
		toolId: string
		toolName: string
		description: string
		inputSchema: ZodRawShape
	}> {
		const prefix = `${MCP_PREFIX}${serverName}__`
		return this.tools
			.filter((t) => t.function.name.startsWith(prefix))
			.map((t) => ({
				toolId: t.function.name,
				toolName: t.function.name.slice(prefix.length),
				description: t.function.description,
				inputSchema: t.function.parameters as ZodRawShape
			}))
	}

	isMcpTool(toolId: string): boolean {
		return toolId.startsWith(MCP_PREFIX) && !toolId.startsWith('mcp__agent-manager')
	}

	getTools(): AgentTool[] {
		return this.tools
	}

	/**
	 * Llama a una herramienta MCP.
	 * Si se proporciona `userId` y hay un `credentialProvider` inyectado, las credenciales
	 * del usuario se inyectan automáticamente:
	 *   - Servidores HTTP → como cabeceras adicionales en la petición
	 *   - Servidores stdio → como variables de entorno en un proceso temporal
	 *
	 * Además, si hay `userId`, se firma un JWT corto (5 min) con claim `sub: userId`
	 * y se propaga como header `x-agent-manager-token` a TODOS los MCPs HTTP. Esto
	 * permite que el MCP llame de vuelta a agent-manager (p.ej. para leer un
	 * traceability_document) en nombre del usuario, sin tokens estáticos.
	 */
	async callTool(toolId: string, args: Record<string, unknown>, userId?: string, onImage?: OnMcpImage): Promise<string> {
		const entry = this.toolMap.get(toolId) ?? parseMcpToolId(toolId) ?? undefined
		if (!entry) {
			agentLogger.warn(`[McpExternal] Attempt to call unknown MCP tool '${toolId}'`)
			return `External MCP tool not found: ${toolId}`
		}

		const { serverName, toolName } = entry

		const credentials = await this.resolveCredentials(serverName, userId)
		const propagated = this.buildPropagatedHeaders(userId)
		const httpHeaders = { ...credentials, ...propagated }

		const http = this.httpClients.get(serverName)
		if (http) {
			try {
				return await http.callTool(toolName, args, httpHeaders, onImage)
			} catch (err) {
				throw new Error(`MCP HTTP error (${serverName}/${toolName}): ${err instanceof Error ? err.message : String(err)}`)
			}
		}

		const stdio = this.stdioClients.get(serverName)
		if (stdio) {
			if (Object.keys(credentials).length > 0) {
				// Spawn proceso temporal con credenciales en env para no contaminar el proceso persistente
				const cfg = this.serverConfigs.get(serverName)
				if (cfg?.type === 'stdio' && cfg.command) {
					const tempClient = new McpStdioClient(serverName, cfg.command, cfg.args ?? [], {
						...cfg.baseEnv,
						...credentials
					})
					try {
						await tempClient.initialize()
						return await tempClient.callTool(toolName, args, onImage)
					} catch (err) {
						throw new Error(`MCP stdio error (${serverName}/${toolName}): ${err instanceof Error ? err.message : String(err)}`)
					} finally {
						tempClient.cleanup()
					}
				}
			}
			try {
				return await stdio.callTool(toolName, args, onImage)
			} catch (err) {
				throw new Error(`MCP stdio error (${serverName}/${toolName}): ${err instanceof Error ? err.message : String(err)}`)
			}
		}

		throw new Error(`No active client for MCP server '${serverName}'`)
	}

	/** Resuelve las credenciales del usuario para el servidor dado (vacío si no aplica). */
	private async resolveCredentials(serverName: string, userId?: string): Promise<Record<string, string>> {
		if (!userId || !this.credentialProvider) return {}
		const serverId = this.serverDbIds.get(serverName)
		if (!serverId) return {}
		try {
			return await this.credentialProvider.getCredentials(userId, serverId, true)
		} catch (err) {
			agentLogger.warn(`[McpExternal] Failed to resolve credentials for user=${userId} server=${serverName}: ${err}`)
			return {}
		}
	}

	/**
	 * Construye headers que agent-manager propaga a todos los MCPs HTTP de forma
	 * transparente. Hoy: un JWT corto firmado con `sub: userId` para que el MCP
	 * pueda llamar de vuelta a agent-manager en nombre del usuario.
	 */
	private buildPropagatedHeaders(userId?: string): Record<string, string> {
		if (!userId) return {}
		try {
			const token = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '5m' })
			return { 'x-agent-manager-token': token }
		} catch (err) {
			agentLogger.warn(`[McpExternal] Failed to sign propagated JWT for user=${userId}: ${err}`)
			return {}
		}
	}
}

const manager = new McpExternalManager()
export const mcpExternalManager = manager
