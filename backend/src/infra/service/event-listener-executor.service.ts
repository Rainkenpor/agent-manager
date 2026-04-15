import type { IEventListenerRepository } from '../../domain/repositories/event-listener.repository.js'
import type { EventListener } from '../../domain/entities/event-listener.entity.js'
import { registry } from '../../application/services/registry.service.js'
import { getNextCronRun } from './cron-parser.js'
import { evaluateCondition } from './field-accessor.js'
import { executeToolCall } from '@infra/utils/tools.js'

/**
 * EventListenerExecutorService
 *
 * Loads all enabled event listeners from the DB, schedules each one according
 * to its cron expression, and on each tick:
 *   1. Calls the source tool with the configured params.
 *   2. Evaluates the condition against the result.
 *   3. If the condition is met → calls every action tool → deletes the listener.
 *   4. Updates last_run_at / last_run_result.
 */
export class EventListenerExecutorService {
	private jobs: Map<string, NodeJS.Timeout> = new Map()

	constructor(private readonly repository: IEventListenerRepository) {}

	/** Load all enabled listeners and schedule them. Call once at startup. */
	async initialize(): Promise<void> {
		const listeners = await this.repository.findEnabled()
		for (const listener of listeners) {
			this.scheduleListener(listener)
		}
		console.log(`📡 Event Listener Executor: scheduled ${listeners.length} listener(s)`)
	}

	/** Schedule (or re-schedule) a single listener. */
	scheduleListener(listener: EventListener): void {
		this.cancelListener(listener.id)
		if (!listener.enabled) return

		const tick = async () => {
			await this.executeListener(listener.id)
			// Re-schedule only if the listener still exists and is enabled
			const current = await this.repository.findById(listener.id)
			if (current?.enabled) {
				this.setNextTimeout(current.id, current.schedule, tick)
			}
		}

		this.setNextTimeout(listener.id, listener.schedule, tick)
	}

	/** Cancel a scheduled job without deleting the DB record. */
	cancelListener(id: string): void {
		const t = this.jobs.get(id)
		if (t) {
			clearTimeout(t)
			this.jobs.delete(id)
		}
	}

	/** Execute one listener tick: source → condition check → action → (auto-delete). */
	async executeListener(listenerId: string): Promise<{ conditionMet: boolean; error?: string }> {
		const listener = await this.repository.findById(listenerId)
		if (!listener) return { conditionMet: false, error: 'Listener not found' }

		try {
			// 1. Call source tool

			const sourceResult = await executeToolCall(() => {}, listener.source.function_name, listener.source.params, {
				agentSlug: 'event-listener',
				query: '',
				userId: 'a4c29a8c-2925-463b-be7f-821c7606d958'
			})

			// 2. Extract data payload
			const parseJson = typeof sourceResult === 'string' ? JSON.parse(sourceResult) : sourceResult
			const payload = (parseJson as any)?.data ?? parseJson

			// 3. Evaluate condition
			let conditionMet = false
			let matchedElement: unknown = null

			if (Array.isArray(payload)) {
				for (const item of payload) {
					if (evaluateCondition({ element: item }, listener.condition)) {
						conditionMet = true
						matchedElement = item
						break
					}
				}
			} else {
				conditionMet = evaluateCondition({ element: payload }, listener.condition)
				matchedElement = payload
			}

			// 4. If condition met → execute actions → self-delete
			if (conditionMet) {
				for (const action of listener.action) {
					await executeToolCall(
						() => {},
						action.function_name,
						{
							...action.params,
							_matchedElement: matchedElement
						},
						{
							agentSlug: 'event-listener',
							query: ''
						}
					)
				}
				// Auto-delete
				this.cancelListener(listenerId)
				await this.repository.delete(listenerId)
				console.log(`✅ EventListener "${listener.name}" (${listenerId}): condition met → actions executed → deleted`)
				return { conditionMet: true }
			}

			// 5. Update last run (only when NOT deleted)
			await this.repository.updateLastRun(listenerId, 'condition_not_met')
			return { conditionMet: false }
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err)
			console.error(`❌ EventListener "${listener.name}" (${listenerId}): ${message}`)
			try {
				await this.repository.updateLastRun(listenerId, `error: ${message}`)
			} catch {
				// ignore secondary errors
			}
			return { conditionMet: false, error: message }
		}
	}

	// ──────────────────────────────────────────────────────────────────────────
	// Private helpers
	// ──────────────────────────────────────────────────────────────────────────

	private setNextTimeout(id: string, schedule: string, tick: () => Promise<void>): void {
		try {
			const next = getNextCronRun(schedule)
			const delay = Math.max(0, next.getTime() - Date.now())
			const t = setTimeout(() => {
				setImmediate(() => tick().catch((e) => console.error(`EventListener tick error:`, e)))
			}, delay)
			this.jobs.set(id, t)
		} catch (err) {
			console.error(`EventListener schedule error for ${id}:`, err)
		}
	}
}
