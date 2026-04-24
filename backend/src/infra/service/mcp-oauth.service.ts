import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "./passport.service.js";
import type { IUserRepository } from "@domain/repositories/user.repository.js";
import { AppDataSource } from "@infra/db/database.js";
import { OAuthClientEntity, OAuthCodeEntity, OAuthRefreshTokenEntity } from "@infra/db/entities.js";

export interface OAuthClientRecord {
	client_id: string;
	client_secret?: string;
	client_name: string;
	redirect_uris: string[];
	grant_types: string[];
	scope?: string;
}

interface AccessToken {
	access_token: string;
	token_type: string;
	expires_in: number;
	refresh_token?: string;
	scope?: string;
}

export class McpOAuthService {
	constructor(private userRepository: IUserRepository) {
		this.seedDefaultClient();
	}

	private get clientRepo() {
		return AppDataSource.getRepository(OAuthClientEntity)
	}

	private get codeRepo() {
		return AppDataSource.getRepository(OAuthCodeEntity)
	}

	private get tokenRepo() {
		return AppDataSource.getRepository(OAuthRefreshTokenEntity)
	}

	// ── Client management ────────────────────────────────────────────────────

	private async seedDefaultClient() {
		const existing = await this.clientRepo.findOneBy({ id: "agent-manager-mcp-client" });
		if (existing) return;
		await this.clientRepo.save(this.clientRepo.create({
			id: "agent-manager-mcp-client",
			secret: "change-in-production",
			name: "Agent Manager MCP Client",
			redirectUris: ["http://localhost:3000/callback", "http://localhost:8090/callback"],
			grantTypes: ["authorization_code", "refresh_token"],
			scope: "mcp:all",
			createdAt: new Date().toISOString()
		}));
	}

	async registerClient(data: Omit<OAuthClientRecord, "client_id" | "client_secret">): Promise<OAuthClientRecord> {
		const client_id = `mcp-client-${randomBytes(16).toString("hex")}`;
		const client_secret = randomBytes(32).toString("hex");
		await this.clientRepo.save(this.clientRepo.create({
			id: client_id,
			secret: client_secret,
			name: data.client_name,
			redirectUris: data.redirect_uris,
			grantTypes: data.grant_types,
			scope: data.scope ?? null,
			createdAt: new Date().toISOString()
		}));
		return { client_id, client_secret, ...data };
	}

	async getClient(client_id: string): Promise<OAuthClientRecord | undefined> {
		const r = await this.clientRepo.findOneBy({ id: client_id });
		if (!r) return undefined;
		return {
			client_id: r.id,
			client_secret: r.secret ?? undefined,
			client_name: r.name,
			redirect_uris: r.redirectUris,
			grant_types: r.grantTypes,
			scope: r.scope ?? undefined,
		};
	}

	async validateClient(client_id: string, client_secret?: string): Promise<boolean> {
		const client = await this.getClient(client_id);
		if (!client) return false;
		if (client.client_secret) return client.client_secret === client_secret;
		return true;
	}

	// ── Authorization codes ───────────────────────────────────────────────────

	async createAuthorizationCode(
		client_id: string,
		redirect_uri: string,
		userId: string,
		scope?: string,
		codeChallenge?: string,
		codeChallengeMethod?: string,
	): Promise<string> {
		const code = randomBytes(32).toString("hex");
		const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
		await this.codeRepo.save(this.codeRepo.create({
			code,
			clientId: client_id,
			userId,
			redirectUri: redirect_uri,
			scope: scope ?? null,
			codeChallenge: codeChallenge ?? null,
			codeChallengeMethod: codeChallengeMethod ?? null,
			expiresAt,
			createdAt: new Date().toISOString()
		}));
		return code;
	}

	async validateAuthorizationCode(code: string, redirect_uri: string): Promise<string | null> {
		const authCode = await this.codeRepo.findOneBy({ code });
		if (!authCode) return null;

		if (new Date(authCode.expiresAt) < new Date()) {
			await this.codeRepo.delete({ code });
			return null;
		}
		if (authCode.redirectUri !== redirect_uri) return null;

		await this.codeRepo.delete({ code });
		return authCode.userId;
	}

	// ── Access tokens ─────────────────────────────────────────────────────────

	async createAccessToken(userId: string, clientId: string, scope?: string): Promise<AccessToken> {
		const user = await this.userRepository.findById(userId);
		if (!user) throw new Error("Usuario no encontrado");

		const access_token = jwt.sign(
			{ userId, username: user.username, scope: scope || "mcp:all" },
			JWT_SECRET,
			{ expiresIn: "1h" },
		);

		const refresh_token = randomBytes(32).toString("hex");
		const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
		await this.tokenRepo.save(this.tokenRepo.create({
			token: refresh_token,
			clientId,
			userId,
			scope: scope ?? null,
			expiresAt,
			createdAt: new Date().toISOString()
		}));

		return { access_token, token_type: "Bearer", expires_in: 3600, refresh_token, scope: scope || "mcp:all" };
	}

	async refreshAccessToken(refresh_token: string, clientId: string): Promise<AccessToken | null> {
		const rt = await this.tokenRepo.findOneBy({ token: refresh_token, clientId });
		if (!rt) return null;

		if (new Date(rt.expiresAt) < new Date()) {
			await this.tokenRepo.delete({ token: refresh_token });
			return null;
		}

		await this.tokenRepo.delete({ token: refresh_token });
		return this.createAccessToken(rt.userId, clientId, rt.scope ?? undefined);
	}

	async revokeRefreshToken(token: string): Promise<boolean> {
		await this.tokenRepo.delete({ token });
		return true;
	}

	verifyAccessToken(token: string): Record<string, unknown> | null {
		try {
			const payload = jwt.verify(token, JWT_SECRET);
			if (typeof payload === "string") return null;
			return payload as Record<string, unknown>;
		} catch {
			return null;
		}
	}

	// ── Well-known metadata ───────────────────────────────────────────────────

	getAuthorizationServerMetadata(baseUrl: string) {
		return {
			issuer: baseUrl,
			authorization_endpoint: `${baseUrl}/oauth/authorize`,
			token_endpoint: `${baseUrl}/oauth/token`,
			registration_endpoint: `${baseUrl}/oauth/register`,
			token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic", "none"],
			grant_types_supported: ["authorization_code", "refresh_token"],
			response_types_supported: ["code"],
			response_modes_supported: ["query"],
			code_challenge_methods_supported: ["S256", "plain"],
			scopes_supported: ["mcp:all", "mcp:tools", "mcp:resources", "mcp:prompts"],
			revocation_endpoint: `${baseUrl}/oauth/revoke`,
		};
	}

	getProtectedResourceMetadata(baseUrl: string, authServerUrl: string) {
		return {
			resource: `${baseUrl}/mcp`,
			authorization_servers: [authServerUrl],
			scopes_supported: ["mcp:all", "mcp:tools", "mcp:resources", "mcp:prompts"],
			bearer_methods_supported: ["header"],
		};
	}
}
