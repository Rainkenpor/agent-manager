import type {
	EventListener,
	CreateEventListenerDTO,
	UpdateEventListenerDTO
} from '../entities/event-listener.entity.js'

export interface IEventListenerRepository {
	findAll(): Promise<EventListener[]>
	findEnabled(): Promise<EventListener[]>
	findById(id: string): Promise<EventListener | null>
	create(data: CreateEventListenerDTO): Promise<EventListener>
	update(data: UpdateEventListenerDTO): Promise<EventListener>
	delete(id: string): Promise<void>
	updateLastRun(id: string, result: string): Promise<void>
}
