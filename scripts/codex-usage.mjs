/**
 * codex-usage.mjs — Sonda los endpoints de uso/rate-limit de Codex usando curl.
 *
 * Lee el token de ChatGPT/OpenAI desde ~/.codex/auth.json (o CODEX_AUTH_PATH),
 * extrae el access_token y el account_id, y llama por curl a los endpoints
 * candidatos para descubrir cuál responde 200 y con qué shape.
 *
 * Uso:
 *   node scripts/codex-usage.mjs
 *
 * Requisitos: curl en el PATH (no usa librerías externas).
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const AUTH_PATH = process.env.CODEX_AUTH_PATH || path.join(os.homedir(), '.codex', 'auth.json')

const ENDPOINTS = ['https://chatgpt.com/backend-api/wham/usage', 'https://chatgpt.com/backend-api/codex/usage']

function decodeJwtClaims(token) {
	try {
		return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
	} catch {
		return {}
	}
}

function loadCredentials() {
	if (!fs.existsSync(AUTH_PATH)) {
		throw new Error(`No se encontró ${AUTH_PATH}. Define CODEX_AUTH_PATH si está en otra ruta.`)
	}
	const auth = JSON.parse(fs.readFileSync(AUTH_PATH, 'utf8'))
	const tokens = auth.tokens || auth
	const accessToken = tokens.access_token || tokens.accessToken
	if (!accessToken) throw new Error('No se encontró access_token en el archivo de auth.')

	const claims = decodeJwtClaims(tokens.id_token || accessToken)
	const accountId =
		tokens.account_id ||
		claims.chatgpt_account_id ||
		claims['https://api.openai.com/auth']?.chatgpt_account_id ||
		claims.organizations?.[0]?.id ||
		''

	return { accessToken, accountId }
}

function callUsage(url, accessToken, accountId) {
	const args = [
		'-s',
		'-w',
		'\n__HTTP_STATUS__:%{http_code}',
		url,
		'-H',
		`Authorization: Bearer ${accessToken}`,
		'-H',
		`ChatGPT-Account-Id: ${accountId}`,
		'-H',
		'Accept: application/json',
		'-H',
		'User-Agent: codex-cli',
		'-H',
		'Origin: https://chatgpt.com',
		'-H',
		'Referer: https://chatgpt.com/'
	]
	const res = spawnSync('curl', args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
	if (res.error) return { status: 0, body: `curl error: ${res.error.message}` }

	const raw = res.stdout || ''
	const marker = raw.lastIndexOf('\n__HTTP_STATUS__:')
	const status = marker >= 0 ? Number(raw.slice(marker + '\n__HTTP_STATUS__:'.length).trim()) : 0
	const body = marker >= 0 ? raw.slice(0, marker) : raw
	return { status, body, stderr: res.stderr }
}

function main() {
	const { accessToken, accountId } = loadCredentials()
	console.log(`auth.json: ${AUTH_PATH}`)
	console.log(`account_id: ${accountId || '(vacío)'}`)
	console.log('')

	for (const url of ENDPOINTS) {
		console.log(`════════════════════════════════════════════════════════`)
		console.log(`GET ${url}`)
		const { status, body, stderr } = callUsage(url, accessToken, accountId)
		console.log(`HTTP ${status}`)
		if (stderr?.trim()) console.log(`stderr: ${stderr.trim()}`)
		try {
			console.log(JSON.stringify(JSON.parse(body), null, 2))
		} catch {
			console.log(body)
		}
		console.log('')
	}
}

main()
