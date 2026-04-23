import { AppDataSource } from '@infra/db/database.js'
import { EventListenerEntity } from '@infra/db/entities.js'
import { v4 as uuidv4 } from 'uuid'
import type { IEventListenerRepository } from '../../domain/repositories/event-listener.repository.js'
import type { EventListener, CreateEventListenerDTO, UpdateEventListenerDTO } from '../../domain/entities/event-listener.entity.js'

export class EventListenerRepository implements IEventListenerRepository {
	private get repo() {
		return AppDataSource.getRepository(EventListenerEntity)
	}

	async findAll(): Promise<EventListener[]> {
		const rows = await this.repo.find()
		return rows as unknown as EventListener[]
	}

	async findEnabled(): Promise<EventListener[]> {
		const rows = await this.repo.findBy({ enabled: true })
		return rows as unknown as EventListener[]
	}

	async findById(id: string): Promise<EventListener | null> {
		const row = await this.repo.findOneBy({ id })
		return (row as unknown as EventListener) ?? null
	}

	async create(data: CreateEventListenerDTO): Promise<EventListener> {
		const now = new Date().toISOString()
		const entity = this.repo.create({
			id: uuidv4(),
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
		})
		await this.repo.save(entity)
		return entity as unknown as EventListener
	}

	async update(data: UpdateEventListenerDTO): Promise<EventListener> {
		const updateData: Partial<EventListenerEntity> = { updatedAt: new Date().toISOString() }
		if (data.name !== undefined) updateData.name = data.name
		if (data.schedule !== undefined) updateData.schedule = data.schedule
		if (data.source !== undefined) updateData.source = data.source
		if (data.condition !== undefined) updateData.condition = data.condition
		if (data.action !== undefined) updateData.action = data.action
		if (data.enabled !== undefined) updateData.enabled = data.enabled
		await this.repo.update(data.id, updateData as any)
		const updated = await this.findById(data.id)
		if (!updated) throw new Error(`EventListener ${data.id} not found after update`)
		return updated
	}

	async delete(id: string): Promise<void> {
		await this.repo.delete(id)
	}

	async updateLastRun(id: string, result: string): Promise<void> {
		await this.repo.update(id, {
			lastRunAt: new Date().toISOString(),
			lastRunResult: result
		})
	}
}
