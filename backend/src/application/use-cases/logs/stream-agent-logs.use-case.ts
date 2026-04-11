import * as fs from 'node:fs'
import { join } from 'node:path'
import { LOG_PATH } from '@infra/service/logger.service.js'

const TAIL_LINES = 50
const LOG_AGENT_PATH = join(LOG_PATH, 'agents.log')

type SendEvent = (data: Record<string, unknown>) => void

export class StreamAgentLogsUseCase {
	execute(sendEvent: SendEvent): () => void {
		this.sendHistory(sendEvent)

		let lastSize = 0
		try {
			if (fs.existsSync(LOG_AGENT_PATH)) {
				lastSize = fs.statSync(LOG_AGENT_PATH).size
			}
		} catch { /* ignorar */ }

		let watcher: fs.FSWatcher | null = null
		let closed = false

		const checkForNewContent = () => {
			if (closed) return
			try {
				if (!fs.existsSync(LOG_AGENT_PATH)) return
				const stat = fs.statSync(LOG_AGENT_PATH)
				if (stat.size > lastSize) {
					const buffer = Buffer.alloc(stat.size - lastSize)
					const fd = fs.openSync(LOG_AGENT_PATH, 'r')
					fs.readSync(fd, buffer, 0, buffer.length, lastSize)
					fs.closeSync(fd)
					lastSize = stat.size
					const newLines = buffer.toString('utf-8').split('\n').filter((l) => l.trim())
					for (const line of newLines) {
						sendEvent({ type: 'line', content: line })
					}
				} else if (stat.size < lastSize) {
					// Archivo rotado/truncado
					lastSize = stat.size
				}
			} catch { /* ignorar */ }
		}

		try {
			watcher = fs.watch(LOG_AGENT_PATH, { persistent: false }, checkForNewContent)
		} catch {
			// El archivo puede no existir aún; se usará el intervalo como fallback
		}

		const interval = setInterval(checkForNewContent, 2000)

		return () => {
			if (closed) return
			closed = true
			clearInterval(interval)
			watcher?.close()
		}
	}

	private sendHistory(sendEvent: SendEvent): void {
		try {
			if (!fs.existsSync(LOG_AGENT_PATH)) {
				sendEvent({ type: 'history', lines: [] })
				return
			}
			const content = fs.readFileSync(LOG_AGENT_PATH, 'utf-8')
			const lines = content.split('\n').filter((l) => l.trim()).slice(-TAIL_LINES)
			sendEvent({ type: 'history', lines })
		} catch {
			sendEvent({ type: 'history', lines: [] })
		}
	}
}
