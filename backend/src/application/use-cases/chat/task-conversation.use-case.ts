import { v4 as uuidv4 } from 'uuid'

type status = 'pending' | 'in_progress' | 'completed' | 'failed'

export class TaskConversationsUseCase {
	private tasks: Map<
		string,
		{
			chatId: string
			name: string
			description?: string
			status: status
		}
	> = new Map()

	async create({
		chatId,
		name,
		description,
		sendEvent
	}: {
		chatId: string
		name: string
		description?: string
		sendEvent: (data: Record<string, unknown>) => void
	}): Promise<{ success: true; data: { id: string; msg: string } } | { success: false; error: string }> {
		const id = uuidv4()
		this.tasks.set(id, { chatId, name, description, status: 'pending' })
		await sendEvent({ type: 'task_create', id, name, description })
		return { success: true, data: { id, msg: 'Tarea creada' } }
	}

	async update({
		id,
		status,
		sendEvent
	}: {
		id: string
		status: status
		sendEvent: (data: Record<string, unknown>) => void
	}): Promise<{ success: true; data: string } | { success: false; error: string }> {
		const tasks = this.tasks.get(id)
		if (!tasks) return { success: false, error: 'No se encontró la tarea dentro del chat' }
		tasks.status = status
		await sendEvent({ type: 'task_update', id, status })
		return { success: true, data: 'Se ha actualizado el status' }
	}

	async deleteChatId(chatId: string) {
		;[...this.tasks.entries()]
			.filter(([_, value]) => value.chatId === chatId)
			.forEach(([key, _]) => {
				this.tasks.delete(key)
			})
		return { success: true, data: 'Se han eliminados los task del chatId' }
	}
}
