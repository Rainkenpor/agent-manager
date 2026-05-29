import { readdir, readFile, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { registry } from '@applicationService/registry.service.js'

const VERSION_REGEX = /^(\d+)\.(\d+)\.(\d+)$/

// Mostrando path de doc
console.log(`📃 Carpeta de doc > ${resolve(process.cwd(), 'doc')}`)

function compareVersions(a: string, b: string): number {
	const am = a.match(VERSION_REGEX)
	const bm = b.match(VERSION_REGEX)
	if (!am || !bm) return b.localeCompare(a)
	for (let i = 1; i <= 3; i++) {
		const diff = Number(bm[i]) - Number(am[i])
		if (diff !== 0) return diff
	}
	return 0
}

function extractDate(content: string): string | null {
	const m = content.match(/\*\*Fecha\*\*\s*:\s*(\d{4}-\d{2}-\d{2})/i)
	return m ? m[1] : null
}

function extractTitle(content: string): string | null {
	const m = content.match(/^#\s+(.+?)\s*$/m)
	return m ? m[1].trim() : null
}

async function readReleaseNotes() {
	const docDir = resolve(process.cwd(), 'doc')
	try {
		const dirStat = await stat(docDir)
		if (!dirStat.isDirectory()) return []
	} catch {
		return []
	}

	const files = await readdir(docDir)
	const notes: Array<{ version: string; title: string | null; date: string | null; content: string }> = []

	for (const file of files) {
		if (!file.endsWith('.md')) continue
		const version = file.slice(0, -3)
		const content = await readFile(join(docDir, file), 'utf8')
		notes.push({
			version,
			title: extractTitle(content),
			date: extractDate(content),
			content
		})
	}

	notes.sort((a, b) => compareVersions(a.version, b.version))
	return notes
}

export function registerReleaseNotesRoutes(): void {
	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/release-notes',
		inputSchema: {},
		requiresAuth: true,
		handler: async () => {
			const notes = await readReleaseNotes()
			return { success: true, data: notes }
		}
	})
}
