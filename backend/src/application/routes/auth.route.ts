import { z } from 'zod'
import { LoginSchema } from '@domain/entities/user.entity.js'
import passport from 'passport'
import { registry } from '@application/services/registry.service.js'
import { randomUUID, randomBytes, createHash } from 'crypto'
import jwt from 'jsonwebtoken'
import NodeCache from 'node-cache'
import { envs } from '../../envs.js'
import { JWT_SECRET } from '@infra/service/passport.service.js'
import { container } from '../container.js'

// Cache para CSRF state del flujo OAuth (TTL 10 min)
const oauthStateCache = new NodeCache({ stdTTL: 600 })

/** Genera un code_verifier aleatorio para PKCE (RFC 7636) */
function generateCodeVerifier(): string {
	return randomBytes(32).toString('base64url')
}

/** Computa code_challenge = BASE64URL(SHA256(verifier)) */
function generateCodeChallenge(verifier: string): string {
	return createHash('sha256').update(verifier).digest().toString('base64url')
}

export function registerAuthRoutes() {
	// Login
	registry.register({
		useBy: ['server'],
		path: '/api/auth/login',
		method: 'POST',
		handler: async ({ context: { req, res, next } }) => {
			return new Promise((resolve) => {
				passport.authenticate('local', { session: false }, async (err: any, user: any, info: any) => {
					if (err) {
						res.status(500).json({ error: 'Error de autenticación' })
						return resolve(null)
					}

					if (!user) {
						res.status(401).json({
							error: info?.message || 'Credenciales inválidas'
						})
						return resolve(null)
					}

					try {
						const loginUseCase = container.loginUseCase
						const result = await loginUseCase.execute(user)

						res.json(result)
						resolve(null)
					} catch (error: any) {
						res.status(500).json({ error: error.message })
						resolve(null)
					}
				})(req, res, next)
			})
		},
		inputSchema: LoginSchema
	})

	// Obtener perfil del usuario actual
	registry.register({
		useBy: ['server'],
		path: '/api/auth/me',
		method: 'GET',
		handler: async ({ context: { req, res, next } }) => {
			if (!req.user) {
				return res.status(401).json({ error: 'No autorizado' })
			}

			const userRepository = container.userRepository

			try {
				const roles = await userRepository.getRoles(req.user.id)
				const permissions = await userRepository.getPermissions(req.user.id)

				const { password, ...userWithoutPassword } = req.user

				return {
					...userWithoutPassword,
					roles,
					permissions
				}
			} catch (error: any) {
				res.status(500).json({ error: error.message })
			}
		},
		requiresAuth: true
	})

	// ==========================================
	// Azure AD OAuth2 - Iniciar flujo
	// ==========================================
	registry.register({
		useBy: ['server'],
		path: '/api/auth/azure',
		method: 'GET',
		handler: async ({ context: { req, res } }) => {
			const { AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_REDIRECT_URI } = envs

			if (!AZURE_CLIENT_ID || !AZURE_TENANT_ID) {
				return res.status(500).json({ error: 'Azure AD no está configurado' })
			}

			const state = randomUUID()
			const codeVerifier = generateCodeVerifier()
			const codeChallenge = generateCodeChallenge(codeVerifier)
			const returnTo = (req.query.return_to as string) || null
			oauthStateCache.set(state, { codeVerifier, returnTo })

			const params = new URLSearchParams({
				client_id: AZURE_CLIENT_ID,
				response_type: 'code',
				redirect_uri: AZURE_REDIRECT_URI,
				response_mode: 'query',
				scope: 'openid profile email User.Read',
				state,
				code_challenge: codeChallenge,
				code_challenge_method: 'S256'
			})

			const authUrl = `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/authorize?${params.toString()}`
			res.redirect(authUrl)
		}
	})

	// ==========================================
	// Azure AD OAuth2 - Callback
	// ==========================================
	registry.register({
		useBy: ['server'],
		path: '/api/auth/azure/callback',
		method: 'GET',
		handler: async ({ context: { req, res } }) => {
			const { AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID, AZURE_REDIRECT_URI, FRONTEND_URL } = envs

			const { code, state, error: azureError } = req.query as Record<string, string>

			if (azureError) {
				return res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent(azureError)}`)
			}

			// Validar state CSRF y recuperar code_verifier
			const cached = oauthStateCache.get<{ codeVerifier: string; returnTo: string | null }>(state)
			if (!state || !cached) {
				return res.redirect(`${FRONTEND_URL}/login?error=invalid_state`)
			}
			oauthStateCache.del(state)
			const { codeVerifier, returnTo } = cached

			try {
				// Intercambiar code por tokens (con PKCE code_verifier)
				const tokenRes = await fetch(`https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
					body: new URLSearchParams({
						client_id: AZURE_CLIENT_ID,
						client_secret: AZURE_CLIENT_SECRET,
						code,
						redirect_uri: AZURE_REDIRECT_URI,
						grant_type: 'authorization_code',
						code_verifier: codeVerifier
					})
				})

				const tokens = (await tokenRes.json()) as Record<string, string>

				if (!tokenRes.ok) {
					console.error('Azure token exchange error:', tokens)
					return res.redirect(`${FRONTEND_URL}/login?error=token_exchange_failed`)
				}

				// Obtener perfil del usuario desde Microsoft Graph
				const graphRes = await fetch('https://graph.microsoft.com/v1.0/me', {
					headers: { Authorization: `Bearer ${tokens.access_token}` }
				})

				const azureUser = (await graphRes.json()) as Record<string, string>

				if (!graphRes.ok) {
					console.error('Microsoft Graph error:', azureUser)
					return res.redirect(`${FRONTEND_URL}/login?error=graph_api_failed`)
				}

				const email = azureUser.mail || azureUser.userPrincipalName || ''

				if (!email) {
					return res.redirect(`${FRONTEND_URL}/login?error=no_email`)
				}


				const userRepository = container.userRepository

				// Buscar o crear usuario
				let user = await userRepository.findByEmail(email)

				if (!user) {
					const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_')
					let username = baseUsername
					let existing = await userRepository.findByUsername(username)
					let suffix = 1
					while (existing) {
						username = `${baseUsername}_${suffix++}`
						existing = await userRepository.findByUsername(username)
					}

					user = await userRepository.create({
						email,
						username,
						password: randomUUID(), // contraseña aleatoria — nunca se usará
						firstName: azureUser.givenName || undefined,
						lastName: azureUser.surname || undefined
					})
				}

				await userRepository.updateLastLogin(user.id)

				// Emitir JWT
				const token = jwt.sign({ sub: user.id, username: user.username, email: user.email }, JWT_SECRET, { expiresIn: '7d' })

				const tokenParam = `azureToken=${encodeURIComponent(token)}`
				const destination = returnTo
					? `${returnTo}${returnTo.includes('?') ? '&' : '?'}${tokenParam}`
					: `${FRONTEND_URL}/login?${tokenParam}`
				res.redirect(destination)
			} catch (err: any) {
				console.error('Azure callback error:', err)
				res.redirect(`${FRONTEND_URL}/login?error=server_error`)
			}
		}
	})

	// Verificar permiso específico
	registry.register({
		useBy: ['server'],
		path: '/api/auth/check-permission',
		method: 'POST',
		handler: async ({ context: { req, res, next } }) => {
			if (!req.user) {
				return res.status(401).json({ error: 'No autorizado' })
			}

			const checkPermissionUseCase = container.checkPermissionUseCase

			try {
				const hasPermission = await checkPermissionUseCase.execute({
					userId: req.user.id,
					resource: req.body.resource,
					action: req.body.action
				})

				res.json({ hasPermission })
			} catch (error: any) {
				res.status(500).json({ error: error.message })
			}
		},
		inputSchema: z.object({
			resource: z.string(),
			action: z.string()
		}),
		requiresAuth: true
	})
}
