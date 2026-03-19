import express, {
	type NextFunction,
	type Request,
	type Response,
} from "express";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z, type ZodRawShape, type ZodTypeAny } from "zod";
import { registry } from "@applicationService/registry.service.js";
import type { McpOAuthService } from "@infra/service/mcp-oauth.service.js";
import { mcpTokenAuthMiddleware } from "./middlewares/mcp-token-auth.middleware.js";
import type { HttpContext } from "@application/interfaces/route.interface.js";
import { mcpExternalManager } from "@infra/service/mcp-external.js";
import { envs } from "../../envs.js";

let oauthService: McpOAuthService | null = null;

const router = express.Router();
const transports: Record<string, StreamableHTTPServerTransport> = {};
const sessionContexts: Record<string, HttpContext> = {};
// still routed to their existing session.
const userSessionMap: Record<string, string> = {};

declare global {
	var __mcpSessionContexts: Record<string, HttpContext>;
}
globalThis.__mcpSessionContexts = sessionContexts;

// ── JSON Schema → ZodRawShape converter ──────────────────────────────────────

function jsonSchemaPropertyToZod(
	prop: Record<string, unknown>,
	required: boolean,
): ZodTypeAny {
	let schema: ZodTypeAny;

	const type = prop.type as string | undefined;

	if (type === "string" || (!type && !prop.properties && !prop.items)) {
		schema = z.string();
	} else if (type === "number" || type === "integer") {
		schema = z.number();
	} else if (type === "boolean") {
		schema = z.boolean();
	} else if (type === "array") {
		const items = prop.items as Record<string, unknown> | undefined;
		const itemSchema = items
			? jsonSchemaPropertyToZod(items, true)
			: z.unknown();
		schema = z.array(itemSchema);
	} else if (type === "object" || prop.properties) {
		const nestedShape = jsonSchemaToZodShape(
			prop as Record<string, unknown>,
		);
		schema = z.object(nestedShape);
	} else {
		schema = z.unknown();
	}

	if (prop.description) {
		schema = schema.describe(prop.description as string);
	}

	return required ? schema : schema.optional();
}

function jsonSchemaToZodShape(
	jsonSchema: Record<string, unknown>,
): ZodRawShape {
	const properties = (jsonSchema.properties ?? {}) as Record<
		string,
		Record<string, unknown>
	>;
	const required = new Set<string>(
		Array.isArray(jsonSchema.required)
			? (jsonSchema.required as string[])
			: [],
	);

	const shape: ZodRawShape = {};
	for (const [key, prop] of Object.entries(properties)) {
		shape[key] = jsonSchemaPropertyToZod(prop, required.has(key));
	}
	return shape;
}

// ── Role-based tool injection ─────────────────────────────────────────────────

/**
 * Applies external MCP proxy tools and agent tools for the given user's roles.
 * Called once per MCP session after the McpServer instance is created.
 */
async function applyRoleBasedTools(
	server: McpServer,
	user: Record<string, unknown>,
): Promise<void> {
	const { container } = await import("@application/container.js");

	const userId = user.userId as string | undefined;
	if (!userId) return;

	const userRoles = await container.userRepository.getRoles(userId);
	const roleIds = userRoles.map((r) => r.id).filter(Boolean);

	if (!roleIds.length) return;

	// Accumulate MCP tools and agents across all roles (union)
	const serverToolMap = new Map<
		string,
		{ mcpServer: { name: string; type: "http" | "stdio"; url?: string | null; command?: string | null; args?: string[] | null; headers?: Record<string, string> | null }; allowedTools: Set<string> }
	>();
	const seenAgents = new Set<string>();
	const agentList: Array<{ id: string; name: string; slug: string }> = [];

	for (const roleId of roleIds) {
		const [mcpServers, roleAgents] = await Promise.all([
			container.mcpServerRepository.getByRole(roleId),
			container.mcpServerRepository.getAgentsByRole(roleId),
		]);

		for (const mcp of mcpServers) {
			if (!mcp.active) continue;
			const allowed = await container.mcpServerRepository.getRoleMcpTools(roleId, mcp.id);
			if (serverToolMap.has(mcp.id)) {
				for (const t of allowed) serverToolMap.get(mcp.id)!.allowedTools.add(t);
			} else {
				serverToolMap.set(mcp.id, { mcpServer: mcp, allowedTools: new Set(allowed) });
			}
		}

		for (const agent of roleAgents) {
			if (!seenAgents.has(agent.id)) {
				seenAgents.add(agent.id);
				agentList.push(agent);
			}
		}
	}

	// Register external MCP proxy tools
	for (const [, { mcpServer, allowedTools }] of serverToolMap) {
		try {
			await mcpExternalManager.ensureServerInitialized(mcpServer.name, mcpServer);
			const serverTools = mcpExternalManager.getToolsForServer(mcpServer.name);

			for (const tool of serverTools) {
				// Empty allowedTools means "all tools allowed"
				if (allowedTools.size > 0 && !allowedTools.has(tool.toolName)) continue;

				const inputSchema = jsonSchemaToZodShape(
					tool.inputSchema as Record<string, unknown>,
				);

				server.tool(
					tool.toolId,
					tool.description,
					inputSchema,
					async (args: Record<string, unknown>) => {
						const result = await mcpExternalManager.callTool(tool.toolId, args);
						return { content: [{ type: "text" as const, text: result }] };
					},
				);
			}
		} catch (err) {
			console.warn(`[MCP] Failed to init server ${mcpServer.name}:`, err);
		}
	}

	// Register platform agents as tools
	for (const agent of agentList) {
		server.tool(
			`agent_${agent.slug}`,
			`Platform agent: ${agent.name}. Send it instructions to get assistance.`,
			{ instruction: z.string().describe("The instruction or task for the agent") },
			async (args: { instruction: string }) => {
				// Forward to internal agent service (basic invocation — extend for streaming)
				try {
					const { container } = await import("@application/container.js");
					const agentEntity = await container.getAgentUseCase.execute(agent.id);
					return {
						content: [
							{
								type: "text" as const,
								text: `Agent "${agent.name}" received instruction. Execute via /api/agents/${agent.id} with: ${args.instruction}`,
							},
						],
					};
				} catch {
					return { content: [{ type: "text" as const, text: `Agent ${agent.slug} unavailable` }] };
				}
			},
		);
	}
}

// ── MCP Session factory ───────────────────────────────────────────────────────

class CreateMcpServer {
	sessionId: string;
	constructor(sessionId?: string) {
		this.sessionId = sessionId ?? randomUUID();
	}

	async initializeTransport() {
		if (transports[this.sessionId]) return transports[this.sessionId];

		const transport = new StreamableHTTPServerTransport({
			sessionIdGenerator: () => this.sessionId,
			onsessioninitialized: (id) => {
				transports[id] = transport;
				console.log(`[MCP] Session initialized: ${id}`);
			},
		});

		transport.onclose = () => {
			if (transport.sessionId) {
				delete transports[transport.sessionId];
				delete sessionContexts[transport.sessionId];
				// Remove user → session mapping if it still points to this session
				for (const [uid, sid] of Object.entries(userSessionMap)) {
					if (sid === transport.sessionId) delete userSessionMap[uid];
				}
				console.log(`[MCP] Session closed: ${transport.sessionId}`);
			}
		};

		return transport;
	}

	async connect({ context }: { context: HttpContext }) {
		const server = new McpServer({
			name: "agent-manager-mcp",
			version: "1.0.0",
		});

		sessionContexts[this.sessionId] = context;

		// Register platform tools from registry
		if (oauthService) {
			registry.applyToMcpServer({ server, sessionId: this.sessionId });
		}

		// Register role-based tools for authenticated user
		const user = context.req.user as Record<string, unknown> | undefined;
		if (user) {
			await applyRoleBasedTools(server, user).catch((err) =>
				console.warn("[MCP] applyRoleBasedTools error:", err),
			);
		}

		const transport = await this.initializeTransport();
		await server.connect(transport);
		return transport;
	}
}

// ── Authentication middleware ─────────────────────────────────────────────────

const mcpAuthMiddleware = async (
	req: express.Request,
	res: express.Response,
	next: express.NextFunction,
) => {
	// MCP-Token header takes priority (internal service-to-service)
	const mcpToken =
		req.headers["x-mcp-token"] ||
		req.headers["mcp-token"] ||
		req.query.token ||
		req.query.mcp_token;

	if (mcpToken) {
		return mcpTokenAuthMiddleware(req, res, next);
	}

	// OAuth Bearer token — required for ALL requests including initialize.
	// The MCP Inspector handles 401 on initialize to trigger OAuth discovery.
	const authHeader = req.headers.authorization;
	if (!authHeader?.startsWith("Bearer ")) {
		const mcpServerBase = `${req.protocol}://${req.get("host")}`;
		res.setHeader(
			"WWW-Authenticate",
			`Bearer realm="MCP Server", resource_metadata="${mcpServerBase}/.well-known/oauth-protected-resource"`,
		);
		return res.status(401).json({
			jsonrpc: "2.0",
			error: { code: -32000, message: "Authentication required" },
			id: req.body?.id || null,
		});
	}

	const token = authHeader.substring(7);
	if (oauthService) {
		const payload = oauthService.verifyAccessToken(token);
		if (!payload) {
			res.setHeader(
				"WWW-Authenticate",
				'Bearer realm="MCP Server", error="invalid_token"',
			);
			return res.status(401).json({
				jsonrpc: "2.0",
				error: { code: -32000, message: "Invalid or expired token" },
				id: req.body?.id || null,
			});
		}
		req.user = payload as any;
	}

	next();
};

// ── Route registration ────────────────────────────────────────────────────────

export function registerMCPRoutes(oauth?: McpOAuthService): express.Router {
	if (oauth) oauthService = oauth;

	router.use(mcpAuthMiddleware);

	// POST /mcp — Initialize or handle requests
	router.post("/", async (req, res, next) => {
		const sessionId = req.headers["mcp-session-id"] as string | undefined;
		let transport: StreamableHTTPServerTransport;

		if (sessionId && transports[sessionId]) {
			transport = transports[sessionId];
			sessionContexts[sessionId] = { req, res, next };
		} else if (!sessionId && isInitializeRequest(req.body)) {
			const mcpServer = new CreateMcpServer(sessionId);
			transport = await mcpServer.connect({ context: { req, res, next } });
		} else {
			res.status(400).json({
				jsonrpc: "2.0",
				error: { code: -32000, message: "Invalid session or missing session ID" },
				id: null,
			});
			return;
		}
		transport.handleRequest(req, res, req.body);
	});

	// GET /mcp — SSE stream for existing sessions
	router.get("/", async (req, res) => {
		const sessionId = req.headers["mcp-session-id"] as string;
		const transport = transports[sessionId];
		if (transport) {
			await transport.handleRequest(req, res);
		} else {
			res.status(400).json({
				jsonrpc: "2.0",
				error: { code: -32000, message: "Invalid session" },
				id: null,
			});
		}
	});

	// DELETE /mcp — Close session
	router.delete("/", async (req, res) => {
		const sessionId = req.headers["mcp-session-id"] as string;
		const transport = transports[sessionId];
		if (transport) {
			await transport.handleRequest(req, res);
		} else {
			res.status(400).json({
				jsonrpc: "2.0",
				error: { code: -32000, message: "Invalid session" },
				id: null,
			});
		}
	});

	// GET /mcp/tools — list tools (debug)
	router.get("/tools", (_req, res) => {
		res.json({ success: true, tools: registry.getRegisteredTools() });
	});

	// GET /mcp/prompts — list prompts (debug)
	router.get("/prompts", (_req, res) => {
		res.json({ success: true, prompts: [] });
	});

	return router;
}

export function registerMCPOauthRoutes(
	oauthService: McpOAuthService,
): express.Router {
	const router = express.Router();

	for (const route of registry
		.getRoutes()
		.filter((r) => r.useBy.includes("server"))) {
		const expressMethod = route.method.toLowerCase() as
			| "get"
			| "post"
			| "put"
			| "delete"
			| "patch";

		const middlewares: any[] = [];
		middlewares.push(
			async (req: Request, res: Response, next: NextFunction) => {
				try {
					const rawInput = { ...req.params, ...req.query, ...req.body };
					const { z } = await import("zod");
					const inputSchema =
						route.inputSchema instanceof z.ZodObject
							? route.inputSchema
							: z.object(route.inputSchema);
					const parseResult = inputSchema.safeParse(rawInput);
					if (!parseResult.success) {
						return res.status(400).json({
							error: "Validation error",
							details: parseResult.error.flatten(),
						});
					}
					const result = await route.handler({
						input: parseResult.data,
						context: { req, res, next },
						oauthService,
					});
					if (result !== null) res.json(result);
				} catch (error) {
					next(error);
				}
			},
		);

		router[expressMethod](route.path, ...middlewares);
	}

	return router;
}
