/**
 * auth.ts — Login interactivo para GitHub Copilot y OpenAI (Codex)
 *
 * Uso:
 *   npm run login    → seleccionar proveedor y autenticar
 *   npm run models   → listar modelos por empresa
 */

import fs from 'node:fs'
import http from 'node:http'
import { createHash, randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { platform } from 'node:os'
import { join } from 'node:path'
import { envs } from '../backend/src/envs.js'

// ── Config ────────────────────────────────────────────────────────────────────

const AUTH_PATH = envs.SERVER_AUTH_PATH

const COPILOT_CLIENT_ID = process.env.AGENT_COPILOT_CLIENT_ID || 'Ov23li8tweQw6odWQebz'
const COPILOT_SCOPE = process.env.AGENT_COPILOT_OAUTH_SCOPE || 'read:user'
const COPILOT_MODELS_URL = process.env.AGENT_COPILOT_MODELS_URL || 'https://api.githubcopilot.com/models'

const OPENAI_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann'
const OPENAI_VERSION = '1.0.0'

// ── Types ─────────────────────────────────────────────────────────────────────

type Provider = 'copilot' | 'openai'

interface TokenResponse {
	id_token: string
	access_token: string
	refresh_token: string
	expires_in?: number
}

interface StoredToken extends Partial<TokenResponse> {
	provider: Provider
	accessToken: string
	createdAt: string
	updatedAt: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

// ── PKCE helpers ──────────────────────────────────────────────────────────────

function generateVerifier(): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
	const bytes = randomBytes(43)
	return Array.from(bytes)
		.map((b) => chars[b % chars.length])
		.join('')
}

function generateChallenge(verifier: string): string {
	return createHash('sha256').update(verifier).digest().toString('base64url')
}

function generateState(): string {
	return randomBytes(32).toString('base64url')
}

// ── Local callback server ─────────────────────────────────────────────────────

function callbackHtml(message: string, success: boolean): string {
	const color = success ? '#22c55e' : '#ef4444'
	return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Clarify Auth</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0a0a0a;color:#fff}
h1{color:${color};font-size:1.4rem;text-align:center}</style></head>
<body><h1>${message}</h1></body></html>`
}

function startCallbackServer(expectedState: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(
			() => {
				server.close()
				reject(new Error('Timeout de autorización (5 minutos)'))
			},
			5 * 60 * 1000
		)

		const server = http.createServer((req, res) => {
			const url = new URL(req.url ?? '/', 'http://localhost:1455')

			if (url.pathname === '/cancel') {
				clearTimeout(timeout)
				res.writeHead(200, { 'Content-Type': 'text/html' })
				res.end(callbackHtml('Autenticación cancelada', false))
				server.close()
				reject(new Error('Autenticación cancelada por el usuario'))
				return
			}

			if (url.pathname === '/auth/callback') {
				const code = url.searchParams.get('code')
				const state = url.searchParams.get('state')
				clearTimeout(timeout)

				if (state !== expectedState) {
					res.writeHead(400, { 'Content-Type': 'text/html' })
					res.end(callbackHtml('Estado inválido (posible ataque CSRF)', false))
					server.close()
					reject(new Error('State mismatch — posible ataque CSRF'))
					return
				}

				if (!code) {
					res.writeHead(400, { 'Content-Type': 'text/html' })
					res.end(callbackHtml('Código de autorización no recibido', false))
					server.close()
					reject(new Error('Missing authorization code'))
					return
				}

				res.writeHead(200, { 'Content-Type': 'text/html' })
				res.end(callbackHtml('✅ Autenticación completada. Puedes cerrar esta ventana.', true))
				server.close()
				resolve(code)
				return
			}

			res.writeHead(404)
			res.end()
		})

		server.listen(1455, '127.0.0.1')
		server.on('error', (err) => {
			clearTimeout(timeout)
			reject(err)
		})
	})
}

function openBrowser(url: string): void {
	try {
		const os = platform()
		let child: ReturnType<typeof spawn>
		if (os === 'win32') {
			child = spawn('cmd', ['/c', 'start', '', url], {
				detached: true,
				stdio: 'ignore'
			})
		} else if (os === 'darwin') {
			child = spawn('open', [url], { detached: true, stdio: 'ignore' })
		} else {
			child = spawn('xdg-open', [url], { detached: true, stdio: 'ignore' })
		}
		child.unref()
	} catch {
		// noop — el usuario puede abrir la URL manualmente
	}
}

// ── Token storage ─────────────────────────────────────────────────────────────

function getTokenPath(provider: Provider): string {
	return join(AUTH_PATH, `${provider}-token.json`)
}

function readToken(provider: Provider): string | undefined {
	try {
		const path = getTokenPath(provider)
		if (!fs.existsSync(path)) return undefined
		const data = JSON.parse(fs.readFileSync(path, 'utf-8')) as Partial<StoredToken>
		return typeof data.accessToken === 'string' && data.accessToken.trim() ? data.accessToken : undefined
	} catch {
		return undefined
	}
}

function saveToken(provider: Provider, accessToken: string, args?: Partial<TokenResponse>): void {
	fs.mkdirSync(AUTH_PATH, { recursive: true })
	const now = new Date().toISOString()
	const payload: StoredToken = {
		provider,
		accessToken,
		createdAt: now,
		updatedAt: now,
		...args
	}
	fs.writeFileSync(getTokenPath(provider), JSON.stringify(payload, null, 2), 'utf-8')
}

// ── Interactive arrow-key menu ────────────────────────────────────────────────

function renderMenu(title: string, items: string[], selected: number): void {
	process.stdout.write('\x1B[2J\x1B[H') // limpiar pantalla
	console.log(`\n  ${title}\n`)
	for (let i = 0; i < items.length; i++) {
		if (i === selected) {
			console.log(`  \x1B[36m❯ ${items[i]}\x1B[0m`)
		} else {
			console.log(`    ${items[i]}`)
		}
	}
	console.log('\n  (↑ ↓ navegar · Enter seleccionar · Ctrl+C salir)')
}

async function selectFromMenu(title: string, items: string[]): Promise<number> {
	return new Promise((resolve) => {
		let selected = 0
		renderMenu(title, items, selected)

		process.stdin.setRawMode(true)
		process.stdin.resume()
		process.stdin.setEncoding('utf8')

		const handler = (key: string) => {
			if (key === '\x1B[A') {
				// flecha arriba
				selected = (selected - 1 + items.length) % items.length
				renderMenu(title, items, selected)
			} else if (key === '\x1B[B') {
				// flecha abajo
				selected = (selected + 1) % items.length
				renderMenu(title, items, selected)
			} else if (key === '\r' || key === '\n') {
				// Enter
				process.stdin.setRawMode(false)
				process.stdin.pause()
				process.stdin.removeListener('data', handler)
				process.stdout.write('\x1B[2J\x1B[H')
				resolve(selected)
			} else if (key === '\x03') {
				// Ctrl+C
				process.exit(0)
			}
		}

		process.stdin.on('data', handler)
	})
}

// ── GitHub Copilot — Device Flow ──────────────────────────────────────────────

async function loginCopilot(): Promise<string> {
	const deviceRes = await fetch('https://github.com/login/device/code', {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			'User-Agent': `opencode/1.2.22`
		},
		body: JSON.stringify({
			client_id: COPILOT_CLIENT_ID,
			scope: COPILOT_SCOPE
		})
	})

	if (!deviceRes.ok) {
		throw new Error(`GitHub device code error: ${deviceRes.status} ${await deviceRes.text()}`)
	}

	const dev = (await deviceRes.json()) as {
		device_code: string
		user_code: string
		verification_uri: string
		verification_uri_complete?: string
		expires_in: number
		interval?: number
	}

	const url = dev.verification_uri_complete ?? dev.verification_uri
	console.log('\n  Autorización GitHub Copilot')
	console.log(`  URL   : ${url}`)
	console.log(`  Código: \x1B[33m${dev.user_code}\x1B[0m`)
	console.log('  Abriendo el navegador...\n')
	openBrowser(url)

	const expiresAt = Date.now() + dev.expires_in * 1000
	let interval = Math.max(dev.interval ?? 5, 1)

	while (Date.now() < expiresAt) {
		await delay(interval * 1000)
		process.stdout.write('  Esperando autorización...\r')

		const res = await fetch('https://github.com/login/oauth/access_token', {
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				'User-Agent': `opencode/1.2.22`
			},
			body: JSON.stringify({
				client_id: COPILOT_CLIENT_ID,
				device_code: dev.device_code,
				grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
			})
		})

		if (!res.ok) {
			throw new Error(`Token error: ${res.status} ${await res.text()}`)
		}

		const data = (await res.json()) as {
			access_token?: string
			error?: string
			error_description?: string
		}

		if (data.access_token) return data.access_token
		if (data.error === 'authorization_pending') continue
		if (data.error === 'slow_down') {
			interval += 5
			continue
		}
		throw new Error(data.error_description ?? data.error ?? 'Error desconocido')
	}

	throw new Error('Tiempo de autorización agotado')
}

// ── OpenAI — Browser PKCE Flow ───────────────────────────────────────────────

async function loginOpenAIBrowser(): Promise<TokenResponse> {
	const verifier = generateVerifier()
	const challenge = generateChallenge(verifier)
	const state = generateState()

	const serverPromise = startCallbackServer(state)

	const params = new URLSearchParams({
		response_type: 'code',
		client_id: OPENAI_CLIENT_ID,
		redirect_uri: 'http://localhost:1455/auth/callback',
		scope: 'openid profile email offline_access',
		code_challenge: challenge,
		code_challenge_method: 'S256',
		id_token_add_organizations: 'true',
		codex_cli_simplified_flow: 'true',
		state,
		originator: 'opencode'
	})

	const authUrl = `https://auth.openai.com/oauth/authorize?${params}`
	console.log('\n  Autorización OpenAI (Browser)')
	console.log('  Abriendo el navegador...')
	console.log(`  Si no se abre, visita:\n  ${authUrl}\n`)
	// openBrowser(authUrl)

	const code = await serverPromise

	// Paso 5 — intercambiar código por tokens
	const tokenRes = await fetch('https://auth.openai.com/oauth/token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'User-Agent': `opencode/${OPENAI_VERSION}`
		},
		body: new URLSearchParams({
			grant_type: 'authorization_code',
			code,
			redirect_uri: 'http://localhost:1455/auth/callback',
			client_id: OPENAI_CLIENT_ID,
			code_verifier: verifier
		})
	})

	if (!tokenRes.ok) {
		throw new Error(`Token exchange error: ${tokenRes.status} ${await tokenRes.text()}`)
	}

	const tokenData = (await tokenRes.json()) as TokenResponse
	return tokenData
}

// ── OpenAI Codex — Device Authorization Flow ─────────────────────────────────

async function loginOpenAI(): Promise<string> {
	// Paso 1 — solicitar user code
	const codeRes = await fetch('https://auth.openai.com/api/accounts/deviceauth/usercode', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'User-Agent': `opencode/${OPENAI_VERSION}`
		},
		body: JSON.stringify({ client_id: OPENAI_CLIENT_ID })
	})

	if (!codeRes.ok) {
		throw new Error(`OpenAI device code error: ${codeRes.status} ${await codeRes.text()}`)
	}

	const codeData = (await codeRes.json()) as {
		device_auth_id: string
		user_code: string
		interval: string
	}

	const activationUrl = 'https://auth.openai.com/codex/device'
	console.log('\n  Autorización OpenAI Codex')
	console.log(`  URL   : ${activationUrl}`)
	console.log(`  Código: \x1B[33m${codeData.user_code}\x1B[0m`)
	console.log('  Introduce el código en la página que se abrirá...\n')
	openBrowser(activationUrl)

	// Paso 3 — polling
	const intervalMs = Math.max(Number.parseInt(codeData.interval, 10) || 5, 1) * 1000 + 3000

	for (let attempt = 0; attempt < 120; attempt++) {
		await delay(intervalMs)
		process.stdout.write('  Esperando autorización...\r')

		const pollRes = await fetch('https://auth.openai.com/api/accounts/deviceauth/token', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'User-Agent': `opencode/${OPENAI_VERSION}`
			},
			body: JSON.stringify({
				device_auth_id: codeData.device_auth_id,
				user_code: codeData.user_code
			})
		})

		if (pollRes.status === 200) {
			const pollData = (await pollRes.json()) as {
				authorization_code: string
				code_verifier: string
			}

			// Paso 4 — intercambiar authorization_code por access_token
			const tokenRes = await fetch('https://auth.openai.com/oauth/token', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					'User-Agent': `opencode/${OPENAI_VERSION}`
				},
				body: new URLSearchParams({
					grant_type: 'authorization_code',
					code: pollData.authorization_code,
					redirect_uri: 'https://auth.openai.com/deviceauth/callback',
					client_id: OPENAI_CLIENT_ID,
					code_verifier: pollData.code_verifier
				})
			})

			if (!tokenRes.ok) {
				throw new Error(`Token exchange error: ${tokenRes.status} ${await tokenRes.text()}`)
			}

			const tokenData = (await tokenRes.json()) as { access_token: string }
			return tokenData.access_token
		}

		// 403 / 404 = autorización pendiente → reintentar
		if (pollRes.status === 403 || pollRes.status === 404) continue

		throw new Error(`OpenAI polling error: ${pollRes.status} ${await pollRes.text()}`)
	}

	throw new Error('Tiempo de autorización agotado')
}

// ── Models ────────────────────────────────────────────────────────────────────

async function fetchCopilotModels(token: string): Promise<string[]> {
	const res = await fetch(COPILOT_MODELS_URL, {
		headers: {
			Accept: 'application/json',
			Authorization: `Bearer ${token}`,
			'X-GitHub-Api-Version': '2025-05-01'
		}
	})

	if (!res.ok) {
		throw new Error(`Copilot models error: ${res.status} ${await res.text()}`)
	}

	const payload = (await res.json()) as {
		data: {
			id: string
			billing?: { is_premium?: boolean; multiplier?: number }
		}[]
	}

	return (payload.data ?? [])
		.sort((a, b) => (a.billing?.multiplier ?? 0) - (b.billing?.multiplier ?? 0))
		.map((m) => {
			const tag = m.billing?.is_premium ? `\x1B[33m⭐ ${m.billing.multiplier}x\x1B[0m ` : '      '
			return `${tag}${m.id}`
		})
}

async function fetchOpenAIModels(token: string): Promise<string[]> {
	const res = await fetch('https://api.openai.com/v1/models', {
		headers: {
			Accept: 'application/json',
			Authorization: `Bearer ${token}`
		}
	})

	if (!res.ok) {
		throw new Error(`OpenAI models error: ${res.status} ${await res.text()}`)
	}

	const payload = (await res.json()) as {
		data: { id: string; owned_by: string }[]
	}

	return (payload.data ?? [])
		.filter((m) => m.owned_by === 'openai' || m.owned_by?.startsWith('openai'))
		.sort((a, b) => a.id.localeCompare(b.id))
		.map((m) => m.id)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
	const mode = (process.argv[2] ?? 'provider').toLowerCase()
	const force = process.argv.includes('--force')

	// ── provider ──────────────────────────────────────────────────────────────────
	if (mode === 'provider') {
		const idx = await selectFromMenu('Seleccionar proveedor de autenticación:', [
			'GitHub Copilot        (Device Flow)',
			'OpenAI / ChatGPT      (Browser · PKCE)',
			'OpenAI / Codex        (Device Flow · headless)'
		])

		const provider: Provider = idx === 0 ? 'copilot' : 'openai'

		if (!force) {
			const existing = readToken(provider)
			if (existing) {
				console.log(`\n  ✅ Ya existe token de ${provider}.`)
				console.log(`     Ruta: ${getTokenPath(provider)}`)
				console.log('     Usa --force para re-autenticar.\n')
				return
			}
		}

		let token: string
		let args: Partial<TokenResponse> = {}
		if (idx === 0) {
			token = await loginCopilot()
		} else if (idx === 1) {
			const tokenResponse = await loginOpenAIBrowser()
			token = tokenResponse.access_token
			args = tokenResponse
		} else {
			token = await loginOpenAI()
		}

		saveToken(provider, token, args)
		console.log(`\n  ✅ Token de ${provider} guardado correctamente.`)
		console.log(`     Ruta: ${getTokenPath(provider)}\n`)
		return
	}

	// ── models ─────────────────────────────────────────────────────────────────
	if (mode === 'models') {
		const copilotToken = readToken('copilot')
		const openaiToken = readToken('openai')

		if (!copilotToken && !openaiToken) {
			console.error("\n  ❌ No hay tokens guardados. Ejecuta 'npm run login' primero.\n")
			process.exit(1)
		}

		console.log('\n  Modelos disponibles\n')

		if (copilotToken) {
			console.log('  ── GitHub Copilot ─────────────────────────────────────')
			try {
				const models = await fetchCopilotModels(copilotToken)
				for (const m of models) console.log(`    ${m}`)
			} catch (e) {
				console.log(`    ⚠️  ${e instanceof Error ? e.message : String(e)}`)
			}
			console.log()
		}

		if (openaiToken) {
			console.log('  ── OpenAI ─────────────────────────────────────────────')
			try {
				const models = await fetchOpenAIModels(openaiToken)
				for (const m of models) console.log(`    ${m}`)
			} catch (e) {
				console.log(`    ⚠️  ${e instanceof Error ? e.message : String(e)}`)
			}
			console.log()
		}

		return
	}

	console.error('  Uso: tsx shared/scripts/auth.ts [login|models] [--force]')
	process.exit(1)
}

main().catch((err) => {
	console.error(`\n  ❌ Error: ${err instanceof Error ? err.message : String(err)}\n`)
	process.exit(1)
})
