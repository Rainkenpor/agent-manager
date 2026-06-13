import os from 'node:os'
import { getMcpSessionStats } from '../../routes/mcp.route.js'

export interface SystemMetrics {
	cpu: {
		usage: number
		cores: number
		model: string
		loadAvg: [number, number, number]
	}
	memory: {
		total: number
		free: number
		used: number
		usage: number
		process: {
			rss: number
			heapTotal: number
			heapUsed: number
		}
	}
	mcp: {
		sessions: number
		contexts: number
	}
	uptime: number
	processUptime: number
	platform: string
	hostname: string
	timestamp: string
}

function cpuTimes(): { idle: number; total: number } {
	let idle = 0
	let total = 0
	for (const cpu of os.cpus()) {
		for (const value of Object.values(cpu.times)) {
			total += value
		}
		idle += cpu.times.idle
	}
	return { idle, total }
}

function sampleCpuUsage(): Promise<number> {
	const start = cpuTimes()
	return new Promise((resolve) => {
		setTimeout(() => {
			const end = cpuTimes()
			const idleDiff = end.idle - start.idle
			const totalDiff = end.total - start.total
			const usage = totalDiff > 0 ? (1 - idleDiff / totalDiff) * 100 : 0
			resolve(Math.round(usage * 10) / 10)
		}, 200)
	})
}

export class GetSystemMetricsUseCase {
	async execute(): Promise<{ success: true; data: SystemMetrics } | { success: false; error: string }> {
		try {
			const cpuUsage = await sampleCpuUsage()
			const cpus = os.cpus()
			const totalMem = os.totalmem()
			const freeMem = os.freemem()
			const usedMem = totalMem - freeMem
			const mem = process.memoryUsage()
			const [load1, load5, load15] = os.loadavg()

			const data: SystemMetrics = {
				cpu: {
					usage: cpuUsage,
					cores: cpus.length,
					model: cpus[0]?.model.trim() ?? 'unknown',
					loadAvg: [load1, load5, load15]
				},
				memory: {
					total: totalMem,
					free: freeMem,
					used: usedMem,
					usage: totalMem > 0 ? Math.round((usedMem / totalMem) * 1000) / 10 : 0,
					process: {
						rss: mem.rss,
						heapTotal: mem.heapTotal,
						heapUsed: mem.heapUsed
					}
				},
				mcp: getMcpSessionStats(),
				uptime: os.uptime(),
				processUptime: process.uptime(),
				platform: `${os.type()} ${os.release()}`,
				hostname: os.hostname(),
				timestamp: new Date().toISOString()
			}

			return { success: true, data }
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			return { success: false, error: message }
		}
	}
}
