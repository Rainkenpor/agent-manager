import express, {
	type NextFunction,
	type Request,
	type Response,
} from "express";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registry } from "@applicationService/registry.service.js";
import type { McpOAuthService } from "@infra/service/mcp-oauth.service.js";
import { mcpTokenAuthMiddleware } from "./middlewares/mcp-token-auth.middleware.js";
import { z } from "zod";
import type { HttpContext } from "@application/interfaces/route.interface.js";

let oauthService: McpOAuthService | null = null;

const router = express.Router();
// Store active transports by session ID
const transports: Record<string, StreamableHTTPServerTransport> = {};
// Store current context by session ID
const sessionContexts: Record<string, HttpContext> = {};

// Expose sessionContexts globally for registry.service.ts
declare global {
	var __mcpSessionContexts: Record<string, HttpContext>;
}
globalThis.__mcpSessionContexts = sessionContexts;

// Factory function to create MCP server instances
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
				console.log(`[MCP] Session closed: ${transport.sessionId}`);
			}
		};

		return transport;
	}

	async connect({ context }: { context: HttpContext }) {
		const server = new McpServer({
			name: "clarify-server",
			version: "1.0.0",
		});
		// Initialize context for this session
		sessionContexts[this.sessionId] = context;
		if (oauthService)
			registry.applyToMcpServer({ server, sessionId: this.sessionId });
		const transport = await this.initializeTransport();
		await server.connect(transport);
		return transport;
	}
}

/**
 * Middleware de autenticación combinado para MCP
 * Soporta tanto OAuth (Bearer token) como MCP Token (x-mcp-token header)
 */
const mcpAuthMiddleware = async (
	req: express.Request,
	res: express.Response,
	next: express.NextFunction,
) => {
	// Permitir initialize sin auth (el cliente descubrirá OAuth después)
	if (isInitializeRequest(req.body)) {
		return next();
	}

	// Verificar si viene con MCP Token (header x-mcp-token o mcp-token)
	const mcpToken =
		req.headers["x-mcp-token"] ||
		req.headers["mcp-token"] ||
		req.query.token ||
		req.query.mcp_token;

	if (mcpToken) {
		// Usar autenticación por token MCP
		return mcpTokenAuthMiddleware(req, res, next);
	}

	// Si no hay MCP Token, intentar OAuth
	const authHeader = req.headers.authorization;
	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		// Responder con WWW-Authenticate header según RFC 6750
		res.setHeader(
			"WWW-Authenticate",
			`Bearer realm="MCP Server", scope="mcp:all", resource="${req.protocol}://${req.get("host")}/mcp", authorization_servers="${req.protocol}://${req.get("host")}"`,
		);
		return res.status(401).json({
			jsonrpc: "2.0",
			error: {
				code: -32000,
				message: "Authentication required",
			},
			id: req.body?.id || null,
		});
	}

	const token = authHeader.substring(7); // Remover "Bearer "

	// Verificar token con OAuth service
	if (oauthService) {
		const payload = oauthService.verifyAccessToken(token);
		if (!payload) {
			res.setHeader(
				"WWW-Authenticate",
				'Bearer realm="MCP Server", error="invalid_token", error_description="The access token is invalid or expired"',
			);
			return res.status(401).json({
				jsonrpc: "2.0",
				error: {
					code: -32000,
					message: "Invalid or expired token",
				},
				id: req.body?.id || null,
			});
		}

		// Adjuntar info del usuario al request
		req.user = payload;
	}

	next();
};

export function registerMCPRoutes(oauth?: McpOAuthService): express.Router {
	if (oauth) {
		oauthService = oauth;
	}

	// Aplicar middleware de autenticación combinado (OAuth + MCP Token)
	router.use(mcpAuthMiddleware);

	// POST /mcp - Handle MCP requests (initialize and messages)
	router.post("/", async (req, res, next) => {
		const sessionId = req.headers["mcp-session-id"] as string | undefined;
		let transport: StreamableHTTPServerTransport;

		if (sessionId && transports[sessionId]) {
			transport = transports[sessionId];
			// Update context for this session with current authenticated request
			sessionContexts[sessionId] = { req, res, next };
		} else if (!sessionId && isInitializeRequest(req.body)) {
			const mcpServer = new CreateMcpServer(sessionId);
			transport = await mcpServer.connect({ context: { req, res, next } });
		} else {
			res.status(400).json({
				jsonrpc: "2.0",
				error: {
					code: -32000,
					message: "Invalid session or missing session ID",
				},
				id: null,
			});
			return;
		}
		transport.handleRequest(req, res, req.body);
	});

	// GET /mcp - Handle SSE streams for existing sessions
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

	// DELETE /mcp - Close session
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

	// Endpoint to list available tools
	router.get("/tools", (_req, res) => {
		res.json({
			success: true,
			tools: registry.getRegisteredTools(),
		});
	});

	// Endpoint to list available prompts (for debugging)
	router.get("/prompts", (_req, res) => {
		res.json({
			success: true,
			prompts: [
				{
					name: "guias_documentacion",
					title: "Guías de Documentación",
					description: "Guías para documentación del proyecto",
				},
				{
					name: "documentar_tareas_pendientes",
					title: "Documentar Tareas Pendientes",
					description:
						"Automatización para documentar y resolver tareas pendientes",
				},
			],
		});
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

		// Preparar middlewares
		const middlewares: any[] = [];

		// Agregar handler principal
		middlewares.push(
			async (req: Request, res: Response, next: NextFunction) => {
				try {
					// Combine params, query, and body for input
					const rawInput = {
						...req.params,
						...req.query,
						...req.body,
					};

					// Validate input with Zod
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

					// Execute handler with context
					const result = await route.handler({
						input: parseResult.data,
						context: {
							req,
							res,
							next,
						},
						oauthService,
					});

					// Only send response if handler didn't handle it (result is not null)
					if (result !== null) {
						res.json(result);
					}
				} catch (error) {
					next(error);
				}
			},
		);

		router[expressMethod](route.path, ...middlewares);
	}

	console.log(
		`🌐 API Router created with ${registry.getRoutes().length} routes`,
	);

	return router;
}
