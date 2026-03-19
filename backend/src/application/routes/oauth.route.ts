import { z } from "zod";
import { registry } from "@application/services/registry.service.js";
import { envs } from "../../envs.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@infra/service/passport.service.js";

/**
 * Registers OAuth 2.0 endpoints (RFC 6749) and well-known discovery documents.
 * These routes live on the API server so the MCP server can reference them.
 */
export function registerOAuthRoutes(): void {
	// ── Discovery: Authorization Server Metadata (RFC 8414) ──────────────────
	registry.register({
		useBy: ["server"],
		method: "GET",
		path: "/.well-known/oauth-authorization-server",
		handler: async ({ context: { req, res }, oauthService }) => {
			if (!oauthService) return res.status(503).json({ error: "OAuth not configured" });
			const baseUrl = `${req.protocol}://${req.get("host")}`;
			return oauthService.getAuthorizationServerMetadata(baseUrl);
		},
	});

	// ── Discovery: Protected Resource Metadata ────────────────────────────────
	registry.register({
		useBy: ["server"],
		method: "GET",
		path: "/.well-known/oauth-protected-resource",
		handler: async ({ context: { req, res }, oauthService }) => {
			if (!oauthService) return res.status(503).json({ error: "OAuth not configured" });
			const apiBase = `${req.protocol}://${req.get("host")}`;
			const mcpBase = `${req.protocol}://${req.hostname}:${envs.MCP_PORT}`;
			return oauthService.getProtectedResourceMetadata(mcpBase, apiBase);
		},
	});

	// ── GET /oauth/authorize — redirect to frontend consent page ─────────────
	registry.register({
		useBy: ["server"],
		method: "GET",
		path: "/oauth/authorize",
		inputSchema: z.object({
			client_id: z.string(),
			redirect_uri: z.string(),
			response_type: z.string(),
			state: z.string().optional(),
			scope: z.string().optional(),
			code_challenge: z.string().optional(),
			code_challenge_method: z.string().optional(),
		}).partial({ state: true, scope: true, code_challenge: true, code_challenge_method: true }),
		handler: async ({ context: { req, res }, oauthService }) => {
			if (!oauthService) return res.status(503).json({ error: "OAuth not configured" });

			const { client_id, redirect_uri, response_type } = req.query as Record<string, string>;

			if (response_type !== "code") {
				return res.redirect(`${redirect_uri}?error=unsupported_response_type&state=${req.query.state ?? ""}`);
			}

			const client = await oauthService.getClient(client_id);
			if (!client) {
				return res.redirect(`${redirect_uri}?error=invalid_client&state=${req.query.state ?? ""}`);
			}
			if (!client.redirect_uris.includes(redirect_uri)) {
				return res.status(400).json({ error: "Invalid redirect_uri" });
			}

			// Forward all query params to the frontend consent page
			const params = new URLSearchParams(req.query as Record<string, string>);
			params.set("client_name", client.client_name);
			return res.redirect(`${envs.FRONTEND_URL}/oauth/authorize/mcp?${params.toString()}`);
		},
	});

	// ── POST /oauth/authorize — user approves and we issue the auth code ──────
	registry.register({
		useBy: ["server"],
		method: "POST",
		path: "/api/oauth/authorize",
		inputSchema: z.object({
			client_id: z.string(),
			redirect_uri: z.string(),
			state: z.string().optional(),
			scope: z.string().optional(),
			username: z.string().optional(),
			password: z.string().optional(),
			token: z.string().optional(),
			approved: z.boolean(),
		}),
		handler: async ({ input, context: { req, res }, oauthService }) => {
			if (!oauthService) return res.status(503).json({ error: "OAuth not configured" });

			const { client_id, redirect_uri, state, scope, username, password, token, approved } = input as any;

			const deniedUrl = `${redirect_uri}?error=access_denied${state ? `&state=${state}` : ""}`;
			if (!approved) {
				return { redirect: deniedUrl };
			}

			const client = await oauthService.getClient(client_id);
			if (!client || !client.redirect_uris.includes(redirect_uri)) {
				return res.status(400).json({ error: "Invalid client or redirect_uri" });
			}

			// Authenticate user — either via JWT token (Azure) or username/password
			const { container } = await import("@application/container.js");
			let user: any;

			if (token) {
				try {
					const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
					user = await container.userRepository.findById(payload.sub);
				} catch {
					return { error: "invalid_credentials" };
				}
			} else {
				if (!username || !password) {
					return { error: "invalid_credentials" };
				}
				user = await container.userRepository.findByUsername(username)
					?? await container.userRepository.findByEmail(username);
				if (!user) {
					return { error: "invalid_credentials" };
				}
				const validPassword = await bcrypt.compare(password, user.password);
				if (!validPassword) {
					return { error: "invalid_credentials" };
				}
			}

			if (!user || !user.active) {
				return { error: "invalid_credentials" };
			}

			const code = await oauthService.createAuthorizationCode(
				client_id,
				redirect_uri,
				user.id,
				scope,
			);

			const redirectUrl = `${redirect_uri}?code=${code}${state ? `&state=${encodeURIComponent(state)}` : ""}`;
			return { redirect: redirectUrl };
		},
	});

	// ── POST /oauth/token — exchange code for tokens ──────────────────────────
	registry.register({
		useBy: ["server"],
		method: "POST",
		path: "/oauth/token",
		inputSchema: z.object({
			grant_type: z.string(),
			code: z.string().optional(),
			redirect_uri: z.string().optional(),
			client_id: z.string().optional(),
			client_secret: z.string().optional(),
			refresh_token: z.string().optional(),
		}),
		handler: async ({ input, context: { req, res }, oauthService }) => {
			if (!oauthService) return res.status(503).json({ error: "OAuth not configured" });

			// Support client credentials in Authorization header (Basic auth)
			let { client_id, client_secret } = input as any;
			const authHeader = req.headers.authorization;
			if (authHeader?.startsWith("Basic ")) {
				const decoded = Buffer.from(authHeader.slice(6), "base64").toString();
				const [id, secret] = decoded.split(":");
				client_id = id;
				client_secret = secret;
			}

			const { grant_type, code, redirect_uri, refresh_token } = input as any;

			const valid = await oauthService.validateClient(client_id, client_secret);
			if (!valid) {
				return res.status(401).json({ error: "invalid_client" });
			}

			if (grant_type === "authorization_code") {
				if (!code || !redirect_uri) {
					return res.status(400).json({ error: "invalid_request" });
				}
				const userId = await oauthService.validateAuthorizationCode(code, redirect_uri);
				if (!userId) {
					return res.status(400).json({ error: "invalid_grant" });
				}
				const tokenData = await oauthService.createAccessToken(userId, client_id);
				return tokenData;
			}

			if (grant_type === "refresh_token") {
				if (!refresh_token) {
					return res.status(400).json({ error: "invalid_request" });
				}
				const tokenData = await oauthService.refreshAccessToken(refresh_token, client_id);
				if (!tokenData) {
					return res.status(400).json({ error: "invalid_grant" });
				}
				return tokenData;
			}

			return res.status(400).json({ error: "unsupported_grant_type" });
		},
	});

	// ── POST /oauth/register — dynamic client registration (RFC 7591) ─────────
	registry.register({
		useBy: ["server"],
		method: "POST",
		path: "/oauth/register",
		inputSchema: z.object({
			client_name: z.string(),
			redirect_uris: z.array(z.string()),
			grant_types: z.array(z.string()).optional(),
			scope: z.string().optional(),
		}),
		handler: async ({ input, context: { req, res }, oauthService }) => {
			if (!oauthService) return res.status(503).json({ error: "OAuth not configured" });
			const { client_name, redirect_uris, grant_types, scope } = input as any;
			const client = await oauthService.registerClient({
				client_name,
				redirect_uris,
				grant_types: grant_types ?? ["authorization_code", "refresh_token"],
				scope,
			});
			return res.status(201).json({
				client_id: client.client_id,
				client_secret: client.client_secret,
				client_name: client.client_name,
				redirect_uris: client.redirect_uris,
				grant_types: client.grant_types,
				scope: client.scope,
			});
		},
	});

	// ── POST /oauth/revoke — token revocation (RFC 7009) ─────────────────────
	registry.register({
		useBy: ["server"],
		method: "POST",
		path: "/oauth/revoke",
		inputSchema: z.object({
			token: z.string(),
			token_type_hint: z.string().optional(),
		}),
		handler: async ({ input, oauthService }) => {
			if (!oauthService) return { success: false };
			await oauthService.revokeRefreshToken((input as any).token);
			return {}; // RFC 7009: always return 200
		},
	});

	// ── GET /oauth/clients — list registered clients (admin) ─────────────────
	registry.register({
		useBy: ["server"],
		method: "GET",
		path: "/api/oauth/clients",
		requiresAuth: true,
		handler: async ({ context: { req, res } }) => {
			const { db } = await import("@infra/db/database.js");
			const { oauthClients } = await import("@infra/db/schema.js");
			const clients = await db.select().from(oauthClients);
			return {
				success: true,
				data: clients.map((c) => ({
					client_id: c.id,
					client_name: c.name,
					redirect_uris: c.redirectUris,
					grant_types: c.grantTypes,
					scope: c.scope,
					createdAt: c.createdAt,
				})),
			};
		},
	});
}
