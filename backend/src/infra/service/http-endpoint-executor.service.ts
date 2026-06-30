/**
 * http-endpoint-executor.service.ts
 *
 * Único punto de salida HTTP genérica del proyecto: llama endpoints externos
 * registrados, enviándoles datos (body plantilla u override). Soporta ejecución
 * manual (devuelve la respuesta) y ejecución programada por cron.
 *
 * Reutiliza getNextCronRun (cron-parser) y replica el patrón de timers de
 * EventListenerExecutorService.
 */

import type { HttpEndpointEntity, HttpMethod } from '../../domain/entities/http-endpoint.entity.js'
import type { IHttpEndpointRepository } from '../../domain/repositories/http-endpoint.repository.js'
import { getNextCronRun } from './cron-parser.js'
import { logger } from './logger.service.js'

const HTTP_TIMEOUT_MS = 30_000
const RESULT_PREVIEW_LIMIT = 2000
const METHODS_WITHOUT_BODY: ReadonlySet<HttpMethod> = new Set<HttpMethod>(['GET', 'DELETE'])

export interface HttpEndpointResult {
	status: number
	ok: boolean
	body: string
}

export class HttpEndpointExecutorService {
	private jobs: Map<string, NodeJS.Timeout> = new Map()

	constructor(private readonly repository: IHttpEndpointRepository) {}

	/** Load all active endpoints with a schedule and schedule them. Call once at startup. */
	async initialize(): Promise<void> {
		const endpoints = await this.repository.findScheduled()
		for (const endpoint of endpoints) {
			this.scheduleEndpoint(endpoint)
		}
		logger.info(`HttpEndpoint Executor: scheduled ${endpoints.length} endpoint(s)`)
	}

	/** Schedule (or re-schedule) a single endpoint based on its cron expression. */
	scheduleEndpoint(endpoint: HttpEndpointEntity): void {
		this.cancelEndpoint(endpoint.id)
		if (!endpoint.active || !endpoint.schedule) return

		const tick = async () => {
			const current = await this.repository.findById(endpoint.id)
			if (!current?.active || !current.schedule) return
			await this.execute(current)
			this.setNextTimeout(current.id, current.schedule, tick)
		}

		this.setNextTimeout(endpoint.id, endpoint.schedule, tick)
	}

	/** Cancel a scheduled job without deleting the DB record. */
	cancelEndpoint(id: string): void {
		const t = this.jobs.get(id)
		if (t) {
			clearTimeout(t)
			this.jobs.delete(id)
		}
	}

	/** Perform the outbound HTTP call. Persists the run result and returns the response. */
	async execute(endpoint: HttpEndpointEntity, overrideBody?: string): Promise<HttpEndpointResult> {
		const headers = this.buildHeaders(endpoint)
		const method = endpoint.method
		const init: RequestInit = { method, headers, signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) }

		if (!METHODS_WITHOUT_BODY.has(method)) {
			const body = overrideBody ?? endpoint.bodyTemplate
			if (body) init.body = body
		}

		try {
			const res = await fetch(endpoint.url, init)
			const text = await res.text()
			const preview = text.slice(0, RESULT_PREVIEW_LIMIT)
			await this.repository.updateLastRun(endpoint.id, res.status, preview)
			logger.info(`HttpEndpoint "${endpoint.name}": ${method} ${endpoint.url} → ${res.status}`)
			return { status: res.status, ok: res.ok, body: text }
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err)
			await this.repository.updateLastRun(endpoint.id, null, `error: ${message}`)
			logger.error(`HttpEndpoint "${endpoint.name}": ${message}`)
			return { status: 0, ok: false, body: message }
		}
	}

	// ──────────────────────────────────────────────────────────────────────────
	// Private helpers
	// ──────────────────────────────────────────────────────────────────────────

	private buildHeaders(endpoint: HttpEndpointEntity): Record<string, string> {
		const headers: Record<string, string> = { 'Content-Type': endpoint.contentType || 'application/json' }
		if (endpoint.headers) {
			for (const [key, value] of Object.entries(endpoint.headers)) headers[key] = value
		}
		if (endpoint.authType === 'bearer' && endpoint.authToken) {
			headers.Authorization = `Bearer ${endpoint.authToken}`
		} else if (endpoint.authType === 'api_key' && endpoint.apiKeyHeader && endpoint.apiKeyValue) {
			headers[endpoint.apiKeyHeader] = endpoint.apiKeyValue
		}
		return headers
	}

	private setNextTimeout(id: string, schedule: string, tick: () => Promise<void>): void {
		try {
			const next = getNextCronRun(schedule)
			const delay = Math.max(0, next.getTime() - Date.now())
			const t = setTimeout(() => {
				setImmediate(() => tick().catch((e) => logger.error(`HttpEndpoint tick error: ${e}`)))
			}, delay)
			this.jobs.set(id, t)
		} catch (err) {
			logger.error(`HttpEndpoint schedule error for ${id}: ${err}`)
		}
	}
}
