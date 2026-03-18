import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "./passport.service.js";
import type { IUserRepository } from "@domain/repositories/user.repository.js";

interface OAuthClient {
	client_id: string;
	client_secret?: string;
	client_name: string;
	redirect_uris: string[];
	grant_types: string[];
	response_types: string[];
	token_endpoint_auth_method: string;
	scope?: string;
}

interface AuthorizationCode {
	code: string;
	client_id: string;
	redirect_uri: string;
	userId: string;
	scope?: string;
	expiresAt: number;
	codeChallenge?: string;
	codeChallengeMethod?: string;
}

interface AccessToken {
	access_token: string;
	token_type: string;
	expires_in: number;
	refresh_token?: string;
	scope?: string;
}

/**
 * Servicio OAuth para MCP siguiendo RFC 6749 y especificación MCP
 * Gestiona el flujo de autenticación OAuth 2.0 para el servidor MCP
 */
export class McpOAuthService {
	// Almacenamiento en memoria (en producción usar Redis o DB)
	private clients: Map<string, OAuthClient> = new Map();
	private authorizationCodes: Map<string, AuthorizationCode> = new Map();
	private refreshTokens: Map<string, string> = new Map(); // refresh_token -> userId

	constructor(private userRepository: IUserRepository) {
		// Registrar cliente de prueba automáticamente
		this.registerDefaultClient();
	}

	/**
	 * Registra un cliente OAuth por defecto para desarrollo
	 */
	private registerDefaultClient() {
		const defaultClient: OAuthClient = {
			client_id: "clarify-mcp-client",
			client_secret: "clarify-secret-change-in-production",
			client_name: "Clarify MCP Client",
			redirect_uris: [
				"http://localhost:3000/callback",
				"http://localhost:8090/callback",
			],
			grant_types: ["authorization_code", "refresh_token"],
			response_types: ["code"],
			token_endpoint_auth_method: "client_secret_post",
			scope: "mcp:all",
		};

		this.clients.set(defaultClient.client_id, defaultClient);
	}

	/**
	 * Registro dinámico de clientes OAuth (RFC 7591)
	 */
	registerClient(
		clientData: Omit<OAuthClient, "client_id" | "client_secret">,
	): OAuthClient {
		const client_id = `mcp-client-${randomBytes(16).toString("hex")}`;
		const client_secret = randomBytes(32).toString("hex");

		const client: OAuthClient = {
			...clientData,
			client_id,
			client_secret,
		};

		this.clients.set(client_id, client);
		return client;
	}

	/**
	 * Obtiene información del cliente
	 */
	getClient(client_id: string): OAuthClient | undefined {
		return this.clients.get(client_id);
	}

	/**
	 * Valida las credenciales del cliente
	 */
	validateClient(client_id: string, client_secret?: string): boolean {
		const client = this.clients.get(client_id);
		if (!client) return false;

		// Si el cliente tiene secret, debe coincidir
		if (client.client_secret) {
			return client.client_secret === client_secret;
		}

		// Cliente público (sin secret)
		return true;
	}

	/**
	 * Genera un código de autorización
	 */
	createAuthorizationCode(
		client_id: string,
		redirect_uri: string,
		userId: string,
		scope?: string,
		codeChallenge?: string,
		codeChallengeMethod?: string,
	): string {
		const code = randomBytes(32).toString("hex");
		const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutos

		this.authorizationCodes.set(code, {
			code,
			client_id,
			redirect_uri,
			userId,
			scope,
			expiresAt,
			codeChallenge,
			codeChallengeMethod,
		});

		// Limpiar código después de expiración
		setTimeout(
			() => {
				this.authorizationCodes.delete(code);
			},
			10 * 60 * 1000,
		);

		return code;
	}

	/**
	 * Valida y consume un código de autorización
	 */
	validateAuthorizationCode(
		code: string,
		redirect_uri: string,
		codeVerifier?: string,
	): string | null {
		const authCode = this.authorizationCodes.get(code);

		if (!authCode) {
			return null; // Código no existe
		}

		if (authCode.expiresAt < Date.now()) {
			this.authorizationCodes.delete(code);
			return null; // Código expirado
		}

		if (authCode.redirect_uri !== redirect_uri) {
			return null; // Redirect URI no coincide
		}

		// Validar PKCE si se usó
		if (authCode.codeChallenge && codeVerifier) {
			// TODO: Implementar validación PKCE
			// const challenge = base64urlEncode(sha256(codeVerifier));
			// if (challenge !== authCode.codeChallenge) return null;
		}

		// Consumir código (solo puede usarse una vez)
		this.authorizationCodes.delete(code);

		return authCode.userId;
	}

	/**
	 * Genera un access token JWT
	 */
	async createAccessToken(
		userId: string,
		scope?: string,
	): Promise<AccessToken> {
		const user = await this.userRepository.findById(userId);
		if (!user) {
			throw new Error("Usuario no encontrado");
		}

		// Obtener roles y permisos
		const roles = await this.userRepository.getRoles(userId);
		const permissions = await this.userRepository.getPermissions(userId);

		// Generar access token
		const access_token = jwt.sign(
			{
				sub: userId,
				username: user.username,
				email: user.email,
				roles: roles.map((r) => r.name),
				permissions: permissions.map((p) => `${p.resource}:${p.action}`),
				scope: scope || "mcp:all",
			},
			JWT_SECRET,
			{ expiresIn: "1h" },
		);

		// Generar refresh token
		const refresh_token = randomBytes(32).toString("hex");
		this.refreshTokens.set(refresh_token, userId);

		return {
			access_token,
			token_type: "Bearer",
			expires_in: 3600,
			refresh_token,
			scope: scope || "mcp:all",
		};
	}

	/**
	 * Renueva un access token usando refresh token
	 */
	async refreshAccessToken(refresh_token: string): Promise<AccessToken | null> {
		const userId = this.refreshTokens.get(refresh_token);
		if (!userId) {
			return null;
		}

		return this.createAccessToken(userId);
	}

	/**
	 * Revoca un refresh token
	 */
	revokeRefreshToken(refresh_token: string): boolean {
		return this.refreshTokens.delete(refresh_token);
	}

	/**
	 * Verifica un access token JWT
	 */
	verifyAccessToken(token: string): Record<string, unknown> | null {
		try {
			const payload = jwt.verify(token, JWT_SECRET);
			if (typeof payload === "string") {
				return null;
			}
			return payload as Record<string, unknown>;
		} catch (error) {
			return null;
		}
	}

	/**
	 * Metadata del servidor de autorización (RFC 8414)
	 */
	getAuthorizationServerMetadata(baseUrl: string) {
		return {
			issuer: baseUrl,
			authorization_endpoint: `${baseUrl}/oauth/authorize`,
			token_endpoint: `${baseUrl}/oauth/token`,
			registration_endpoint: `${baseUrl}/oauth/register`,
			token_endpoint_auth_methods_supported: [
				"client_secret_post",
				"client_secret_basic",
				"none",
			],
			grant_types_supported: ["authorization_code", "refresh_token"],
			response_types_supported: ["code"],
			response_modes_supported: ["query"],
			code_challenge_methods_supported: ["S256", "plain"],
			scopes_supported: [
				"mcp:all",
				"mcp:tools",
				"mcp:resources",
				"mcp:prompts",
			],
			revocation_endpoint: `${baseUrl}/oauth/revoke`,
		};
	}

	/**
	 * Metadata del recurso protegido MCP
	 */
	getProtectedResourceMetadata(baseUrl: string, authServerUrl: string) {
		return {
			resource: `${baseUrl}/mcp`,
			authorization_servers: [authServerUrl],
			scopes_supported: [
				"mcp:all",
				"mcp:tools",
				"mcp:resources",
				"mcp:prompts",
			],
			bearer_methods_supported: ["header"],
		};
	}
}
