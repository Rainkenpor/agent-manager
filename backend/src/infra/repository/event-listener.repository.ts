import { db } from '../db/database.js'
import { eventListeners } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import type { IEventListenerRepository } from '../../domain/repositories/event-listener.repository.js'
import type {
	EventListener,
	CreateEventListenerDTO,
	UpdateEventListenerDTO
} from '../../domain/entities/event-listener.entity.js'

export class EventListenerRepository implements IEventListenerRepository {
	async findAll(): Promise<EventListener[]> {
		const rows = await db.select().from(eventListeners)
		return rows as unknown as EventListener[]
	}

	async findEnabled(): Promise<EventListener[]> {
		const rows = await db.select().from(eventListeners).where(eq(eventListeners.enabled, true))
		return rows as unknown as EventListener[]
	}

	async findById(id: string): Promise<EventListener | null> {
		const rows = await db.select().from(eventListeners).where(eq(eventListeners.id, id))
		return (rows[0] as unknown as EventListener) ?? null
	}

	async create(data: CreateEventListenerDTO): Promise<EventListener> {
		const id = uuidv4()
		const now = new Date().toISOString()
		const record = {
			id,
			name: data.name,
			schedule: data.schedule,
			source: data.source,
			condition: data.condition,
			action: data.action,
			enabled: data.enabled ?? true,
			lastRunAt: null,
			lastRunResult: null,
			createdAt: now,
			updatedAt: now
		}
		await db.insert(eventListeners).values(record as any)
		return record as unknown as EventListener
	}

	async update(data: UpdateEventListenerDTO): Promise<EventListener> {
		const now = new Date().toISOString()
		const updates: Record<string, unknown> = { updatedAt: now }
		if (data.name !== undefined) updates.name = data.name
		if (data.schedule !== undefined) updates.schedule = data.schedule
		if (data.source !== undefined) updates.source = data.source
		if (data.condition !== undefined) updates.condition = data.condition
		if (data.action !== undefined) updates.action = data.action
		if (data.enabled !== undefined) updates.enabled = data.enabled
		await db.update(eventListeners).set(updates as any).where(eq(eventListeners.id, data.id))
		const updated = await this.findById(data.id)
		if (!updated) throw new Error(`EventListener ${data.id} not found after update`)
		return updated
	}

	async delete(id: string): Promise<void> {
		await db.delete(eventListeners).where(eq(eventListeners.id, id))
	}

	async updateLastRun(id: string, result: string): Promise<void> {
		await db
			.update(eventListeners)
			.set({ lastRunAt: new Date().toISOString(), lastRunResult: result } as any)
			.where(eq(eventListeners.id, id))
	}
}
