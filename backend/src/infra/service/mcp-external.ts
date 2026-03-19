/**
 * mcp-external.ts — Cliente MCP externo para el agente interno
 *
 * Gestiona conexiones a servidores MCP definidos en mcp.json:
 *   - Servidores HTTP (Streamable HTTP / SSE)  → { "url": "http://..." }
 *   - Servidores stdio (child_process)          → { "command": "npx", "args": [...] }
 *
 * Convención de nombres de herramientas:  mcp__<serverName>__<toolName>
 */
import fs from "node:fs";
import nodePath from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { agentLogger } from "../service/logger.service.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ── MCP config types ──────────────────────────────────────────────────────────

interface McpServerHttpConfig {
	url: string;
	headers?: Record<string, string>;
}

interface McpServerStdioConfig {
	command: string;
	args?: string[];
	env?: Record<string, string>;
	type?: "stdio";
}

type McpServerConfig = McpServerHttpConfig | McpServerStdioConfig;

interface McpJsonFile {
	servers: Record<string, McpServerConfig>;
}

// ── MCP Protocol types ────────────────────────────────────────────────────────

interface McpTool {
	name: string;
	description?: string;
	inputSchema?: Record<string, unknown>;
}

interface JsonRpcRequest {
	jsonrpc: "2.0";
	method: string;
	id: number;
	params?: Record<string, unknown>;
}

interface JsonRpcNotification {
	jsonrpc: "2.0";
	method: string;
	params?: Record<string, unknown>;
}

interface JsonRpcResponse {
	jsonrpc: "2.0";
	id: number;
	result?: unknown;
	error?: { code: number; message: string };
}

export interface AgentTool {
	type: "function";
	function: {
		name: string;
		description: string;
		parameters: Record<string, unknown>;
	};
}

// ── Tool ID convention ────────────────────────────────────────────────────────

const MCP_PREFIX = "mcp__";

export function buildMcpToolId(serverName: string, toolName: string): string {
	return `${MCP_PREFIX}${serverName}__${toolName}`;
}

function parseMcpToolId(
	id: string,
): { serverName: string; toolName: string } | null {
	if (!id.startsWith(MCP_PREFIX)) return null;
	const rest = id.slice(MCP_PREFIX.length);
	const sep = rest.indexOf("__");
	if (sep === -1) return null;
	return { serverName: rest.slice(0, sep), toolName: rest.slice(sep + 2) };
}

// ── HTTP MCP Client (Streamable HTTP) ─────────────────────────────────────────

class McpHttpClient {
	private sessionId?: string;
	private nextId = 1;

	constructor(
		private readonly url: string,
		private readonly extraHeaders: Record<string, string> = {},
	) {}

	private buildHeaders(): Record<string, string> {
		const h: Record<string, string> = {
			"content-type": "application/json",
			accept: "application/json, text/event-stream",
			...this.extraHeaders,
		};
		if (this.sessionId) h["mcp-session-id"] = this.sessionId;
		return h;
	}

	private async post(payload: unknown): Promise<Response> {
		return fetch(this.url, {
			method: "POST",
			headers: this.buildHeaders(),
			body: JSON.stringify(payload),
		});
	}

	private async sendRequest(
		method: string,
		params?: Record<string, unknown>,
	): Promise<unknown> {
		const id = this.nextId++;
		const body: JsonRpcRequest = {
			jsonrpc: "2.0",
			method,
			id,
			params: params ?? {},
		};

		const res = await this.post(body);

		const newSession = res.headers.get("mcp-session-id");
		if (newSession) this.sessionId = newSession;

		if (!res.ok) {
			const text = await res.text();
			throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
		}

		const contentType = res.headers.get("content-type") ?? "";

		if (contentType.includes("text/event-stream")) {
			return this.readSSEResult(await res.text(), id);
		}

		const json = (await res.json()) as
			| JsonRpcResponse
			| JsonRpcResponse[]
			| null;
		const response = Array.isArray(json)
			? json.find((r) => r.id === id)
			: (json ?? undefined);

		if (!response) throw new Error(`No JSON-RPC response for id=${id}`);
		if (response.error) throw new Error(`MCP: ${response.error.message}`);
		return response.result;
	}

	private readSSEResult(text: string, targetId: number): unknown {
		for (const line of text.split("\n")) {
			if (!line.startsWith("data: ")) continue;
			const data = line.slice(6).trim();
			if (data === "[DONE]") break;
			try {
				const json = JSON.parse(data) as JsonRpcResponse;
				if (json.id !== targetId) continue;
				if (json.error) throw new Error(`MCP: ${json.error.message}`);
				if (json.result !== undefined) return json.result;
			} catch {
				// skip non-JSON
			}
		}
		return null;
	}

	async initialize(): Promise<void> {
		await this.sendRequest("initialize", {
			protocolVersion: "2024-11-05",
			capabilities: {},
			clientInfo: { name: "clarify-internal-agent", version: "1.0.0" },
		});
		// Initialized notification (fire-and-forget)
		const notif: JsonRpcNotification = {
			jsonrpc: "2.0",
			method: "notifications/initialized",
		};
		await this.post(notif).catch(() => {});
	}

	async listTools(): Promise<McpTool[]> {
		const result = (await this.sendRequest("tools/list")) as {
			tools?: McpTool[];
		} | null;
		return result?.tools ?? [];
	}

	async callTool(
		toolName: string,
		args: Record<string, unknown>,
	): Promise<string> {
		const result = (await this.sendRequest("tools/call", {
			name: toolName,
			arguments: args,
		})) as {
			content?: Array<{ type: string; text?: string }>;
			isError?: boolean;
		} | null;

		if (!result?.content) return "Tool returned no content";
		const text = result.content
			.filter(
				(c): c is { type: string; text: string } =>
					c.type === "text" && !!c.text,
			)
			.map((c) => c.text)
			.join("\n");
		return result.isError ? `MCP tool error: ${text}` : text || "OK";
	}
}

// ── stdio MCP Client ──────────────────────────────────────────────────────────

class McpStdioClient {
	private process?: ChildProcess;
	private buffer = "";
	private nextId = 1;
	private pending = new Map<
		number,
		{ resolve: (v: unknown) => void; reject: (e: Error) => void }
	>();

	constructor(
		private readonly serverName: string,
		private readonly command: string,
		private readonly args: string[],
		private readonly extraEnv: Record<string, string> = {},
	) {}

	private spawnProcess(): void {
		const isWindows = process.platform === "win32";
		this.process = spawn(this.command, this.args, {
			env: { ...process.env, ...this.extraEnv },
			stdio: ["pipe", "pipe", "pipe"],
			shell: isWindows,
		});

		this.process.stdout?.on("data", (chunk: Buffer) => {
			this.buffer += chunk.toString();
			this.drainBuffer();
		});

		this.process.stderr?.on("data", (data: Buffer) => {
			agentLogger.debug(
				`[MCP stdio:${this.serverName}] ${data.toString().trimEnd()}`,
			);
		});

		this.process.on("exit", (code) => {
			agentLogger.info(
				`[MCP stdio:${this.serverName}] exited code=${code ?? "null"}`,
			);
			for (const { reject } of this.pending.values()) {
				reject(
					new Error(`MCP server '${this.serverName}' exited unexpectedly`),
				);
			}
			this.pending.clear();
		});

		this.process.on("error", (err) => {
			agentLogger.error(
				`[MCP stdio:${this.serverName}] spawn error: ${err.message}`,
			);
		});
	}

	private drainBuffer(): void {
		const lines = this.buffer.split("\n");
		this.buffer = lines.pop() ?? "";
		for (const line of lines) {
			if (!line.trim()) continue;
			try {
				const json = JSON.parse(line) as JsonRpcResponse;
				const entry = this.pending.get(json.id);
				if (!entry) continue;
				this.pending.delete(json.id);
				if (json.error) {
					entry.reject(new Error(`MCP: ${json.error.message}`));
				} else {
					entry.resolve(json.result);
				}
			} catch {
				// skip
			}
		}
	}

	private writeLine(data: unknown): void {
		this.process?.stdin?.write(JSON.stringify(data) + "\n");
	}

	private sendRequest(
		method: string,
		params?: Record<string, unknown>,
	): Promise<unknown> {
		const id = this.nextId++;
		return new Promise<unknown>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(id);
				reject(new Error(`MCP stdio '${this.serverName}' timeout: ${method}`));
			}, 30_000);
			this.pending.set(id, {
				resolve: (v) => {
					clearTimeout(timer);
					resolve(v);
				},
				reject: (e) => {
					clearTimeout(timer);
					reject(e);
				},
			});
			this.writeLine({ jsonrpc: "2.0", method, id, params: params ?? {} });
		});
	}

	async initialize(): Promise<void> {
		this.spawnProcess();
		await this.sendRequest("initialize", {
			protocolVersion: "2024-11-05",
			capabilities: {},
			clientInfo: { name: "clarify-internal-agent", version: "1.0.0" },
		});
		this.writeLine({ jsonrpc: "2.0", method: "notifications/initialized" });
	}

	async listTools(): Promise<McpTool[]> {
		const result = (await this.sendRequest("tools/list")) as {
			tools?: McpTool[];
		} | null;
		return result?.tools ?? [];
	}

	async callTool(
		toolName: string,
		args: Record<string, unknown>,
	): Promise<string> {
		const result = (await this.sendRequest("tools/call", {
			name: toolName,
			arguments: args,
		})) as {
			content?: Array<{ type: string; text?: string }>;
			isError?: boolean;
		} | null;

		if (!result?.content) return "Tool returned no content";
		const text = result.content
			.filter(
				(c): c is { type: string; text: string } =>
					c.type === "text" && !!c.text,
			)
			.map((c) => c.text)
			.join("\n");
		return result.isError ? `MCP tool error: ${text}` : text || "OK";
	}

	cleanup(): void {
		try {
			this.process?.kill();
		} catch {
			// ignore
		}
	}
}

// ── McpExternalManager ────────────────────────────────────────────────────────

export class McpExternalManager {
	private httpClients = new Map<string, McpHttpClient>();
	private stdioClients = new Map<string, McpStdioClient>();
	private toolMap = new Map<string, { serverName: string; toolName: string }>();
	private tools: AgentTool[] = [];

	/** Busca mcp.json subiendo desde el directorio dado hasta la raíz */
	static findMcpJson(startPath: string): string | undefined {
		let dir = fs.existsSync(startPath)
			? fs.statSync(startPath).isDirectory()
				? startPath
				: nodePath.dirname(startPath)
			: nodePath.dirname(startPath);

		for (let i = 0; i < 6; i++) {
			const candidate = nodePath.join(dir, "mcp.json");
			if (fs.existsSync(candidate)) return candidate;
			const parent = nodePath.dirname(dir);
			if (parent === dir) break;
			dir = parent;
		}
		return undefined;
	}

	async initializeServer(basePath: string) {
		const mcpJsonPath = McpExternalManager.findMcpJson(basePath);
		await this.initialize(mcpJsonPath).catch(() => {});
	}

	/** Carga mcp.json e inicializa todos los servidores configurados */
	async initialize(mcpJsonPath?: string): Promise<void> {
		let config: McpJsonFile;

		if (!mcpJsonPath) {
			agentLogger.info(
				`[McpExternal] No mcp.json found, skipping MCP server initialization`,
			);
			return;
		}

		try {
			const raw = fs.readFileSync(mcpJsonPath, "utf-8");
			config = JSON.parse(raw) as McpJsonFile;
		} catch (err) {
			agentLogger.warn(
				`[McpExternal] Cannot read mcp.json at ${mcpJsonPath}: ${err}`,
			);
			return;
		}

		const entries = Object.entries(config.servers ?? {});
		agentLogger.info(
			`[McpExternal] Initializing ${entries.length} MCP server(s) from ${mcpJsonPath}`,
		);

		const results = await Promise.allSettled(
			entries.map(([name, cfg]) => this.initServer(name, cfg)),
		);

		const failed = results.filter((r) => r.status === "rejected");
		if (failed.length) {
			agentLogger.warn(
				`[McpExternal] ${failed.length} server(s) failed to initialize`,
			);
		}
		agentLogger.info(
			`[McpExternal] Ready — ${this.tools.length} external MCP tool(s) available`,
		);
	}

	async initServer(name: string, cfg: McpServerConfig): Promise<void> {
		let tools: McpTool[];

		if ("url" in cfg && cfg.url) {
			const client = new McpHttpClient(cfg.url, cfg.headers ?? {});
			await client.initialize();
			tools = await client.listTools();
			this.httpClients.set(name, client);
			agentLogger.info(
				`[McpExternal] '${name}' (HTTP) → ${tools.length} tool(s)`,
			);
		} else if ("command" in cfg && cfg.command) {
			const client = new McpStdioClient(
				name,
				cfg.command,
				cfg.args ?? [],
				cfg.env ?? {},
			);
			await client.initialize();
			tools = await client.listTools();
			this.stdioClients.set(name, client);
			agentLogger.info(
				`[McpExternal] '${name}' (stdio) → ${tools.length} tool(s)`,
			);
		} else {
			agentLogger.warn(`[McpExternal] Unknown config for server '${name}'`);
			return;
		}

		for (const tool of tools) {
			const toolId = buildMcpToolId(name, tool.name);
			this.toolMap.set(toolId, { serverName: name, toolName: tool.name });

			const schema = {
				...(tool.inputSchema ?? { type: "object", properties: {} }),
			};
			delete (schema as Record<string, unknown>)["$schema"];

			this.tools.push({
				type: "function",
				function: {
					name: toolId,
					description: `[${name}] ${tool.description ?? tool.name}`,
					parameters: schema as Record<string, unknown>,
				},
			});
		}
	}

	/**
	 * Ensures a DB-registered MCP server is initialized (idempotent).
	 * Config shape matches McpServerEntity fields.
	 */
	async ensureServerInitialized(
		serverName: string,
		config: {
			type: "http" | "stdio";
			url?: string | null;
			command?: string | null;
			args?: string[] | null;
			headers?: Record<string, string> | null;
		},
	): Promise<void> {
		if (this.httpClients.has(serverName) || this.stdioClients.has(serverName)) {
			return; // already up
		}
		if (config.type === "http" && config.url) {
			await this.initServer(serverName, {
				url: config.url,
				headers: config.headers ?? {},
			});
		} else if (config.type === "stdio" && config.command) {
			await this.initServer(serverName, {
				command: config.command,
				args: config.args ?? [],
			});
		}
	}

	/**
	 * Returns tools belonging to a specific server, with parsed metadata.
	 */
	getToolsForServer(
		serverName: string,
	): Array<{
		toolId: string;
		toolName: string;
		description: string;
		inputSchema: unknown;
	}> {
		const prefix = `${MCP_PREFIX}${serverName}__`;
		return this.tools
			.filter((t) => t.function.name.startsWith(prefix))
			.map((t) => ({
				toolId: t.function.name,
				toolName: t.function.name.slice(prefix.length),
				description: t.function.description,
				inputSchema: t.function.parameters,
			}));
	}

	isMcpTool(toolId: string): boolean {
		return toolId.startsWith(MCP_PREFIX);
	}

	getTools(): AgentTool[] {
		return this.tools;
	}

	async callTool(
		toolId: string,
		args: Record<string, unknown>,
	): Promise<string> {
		const entry =
			this.toolMap.get(toolId) ?? parseMcpToolId(toolId) ?? undefined;
		if (!entry) return `External MCP tool not found: ${toolId}`;

		const { serverName, toolName } = entry;

		const http = this.httpClients.get(serverName);
		if (http) {
			try {
				return await http.callTool(toolName, args);
			} catch (err) {
				return `MCP HTTP error (${serverName}/${toolName}): ${err instanceof Error ? err.message : String(err)}`;
			}
		}

		const stdio = this.stdioClients.get(serverName);
		if (stdio) {
			try {
				return await stdio.callTool(toolName, args);
			} catch (err) {
				return `MCP stdio error (${serverName}/${toolName}): ${err instanceof Error ? err.message : String(err)}`;
			}
		}

		return `No active client for MCP server '${serverName}'`;
	}

	/** Libera todos los recursos (mata procesos stdio) */
	// cleanup(): void {
	// 	for (const client of this.stdioClients.values()) {
	// 		client.cleanup();
	// 	}
	// 	this.stdioClients.clear();
	// 	this.httpClients.clear();
	// 	this.toolMap.clear();
	// 	this.tools = [];
	// }
}

const manager = new McpExternalManager();
export const mcpExternalManager = manager;
