<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import * as api from '@/api/api'
import DistiLoader from '@/components/DistiLoader.vue'
import MermaidRenderer from '@/components/MermaidRenderer.vue'

interface DisplayMessage {
	id: string
	role: 'user' | 'assistant'
	content: string
	createdAt: string
	responseTime?: number
	streaming?: boolean
	toolCalls?: string[]
}

const mermaidRenderer = ref<InstanceType<typeof MermaidRenderer> | null>(null)
function renderMermaidDiagrams() {
	void mermaidRenderer.value?.renderDiagrams()
}

const conversationId = ref<string | null>(null)
const messages = ref<DisplayMessage[]>([])
const messageInput = ref('')
const sending = ref(false)
const starting = ref(true)
const error = ref('')
const distiState = ref<'loading' | 'thinking' | 'happy' | 'sad' | 'idle'>('idle')

const messagesContainer = ref<HTMLElement | null>(null)
let abortController: AbortController | null = null

async function startConversation() {
	starting.value = true
	error.value = ''
	try {
		const res = await api.createPublicConversation()
		if (!res.success || !res.data?.id) {
			error.value = res.error || 'No se pudo iniciar el asistente'
			return
		}
		conversationId.value = res.data.id
		messages.value = []
	} catch (e: any) {
		error.value = e.message || 'No se pudo iniciar el asistente'
	} finally {
		starting.value = false
	}
}

async function sendMessage() {
	if (!messageInput.value.trim() || !conversationId.value || sending.value) return
	const content = messageInput.value.trim()
	messageInput.value = ''
	sending.value = true
	error.value = ''

	messages.value.push({ id: `user-${Date.now()}`, role: 'user', content, createdAt: new Date().toISOString() })

	const streamingId = `stream-${Date.now()}`
	messages.value.push({ id: streamingId, role: 'assistant', content: '', createdAt: new Date().toISOString(), streaming: true })
	await scrollToBottom()

	abortController = new AbortController()
	distiState.value = 'loading'

	try {
		let response: Response
		try {
			response = await api.streamPublicMessage(conversationId.value, content, abortController.signal)
		} catch (fetchErr: any) {
			if (fetchErr.name === 'AbortError') throw fetchErr
			throw new Error('No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.')
		}

		if (!response.ok) {
			let errMsg = `Error del servidor (${response.status})`
			try {
				const body = await response.json()
				if (body?.error) errMsg = body.error
				else if (body?.message) errMsg = body.message
			} catch {
				if (response.statusText) errMsg = `${errMsg}: ${response.statusText}`
			}
			throw new Error(errMsg)
		}

		if (!response.body) throw new Error('El servidor no devolvió contenido.')

		const reader = response.body.getReader()
		const decoder = new TextDecoder()
		let buffer = ''

		while (true) {
			let done: boolean
			let value: Uint8Array | undefined
			try {
				;({ done, value } = await reader.read())
			} catch (readErr: any) {
				if (readErr.name === 'AbortError') throw readErr
				throw new Error('La conexión con el servidor se interrumpió inesperadamente.')
			}
			if (done) break

			buffer += decoder.decode(value, { stream: true })
			const parts = buffer.split('\n\n')
			buffer = parts.pop() ?? ''

			for (const part of parts) {
				const line = part.trim()
				if (!line.startsWith('data: ')) continue
				let event: any
				try {
					event = JSON.parse(line.slice(6))
				} catch {
					continue
				}

				if (event.type === 'chunk') {
					distiState.value = 'loading'
					const idx = messages.value.findIndex((m) => m.id === streamingId)
					if (idx !== -1) {
						messages.value[idx] = { ...messages.value[idx], content: messages.value[idx].content + event.content }
						await followIfPinned()
					}
				} else if (event.type === 'tool') {
					distiState.value = 'thinking'
					const idx = messages.value.findIndex((m) => m.id === streamingId)
					if (idx !== -1) {
						const existing = messages.value[idx].toolCalls ?? []
						if (!existing.includes(event.name)) {
							messages.value[idx] = { ...messages.value[idx], toolCalls: [...existing, event.name] }
						}
					}
				} else if (event.type === 'done') {
					distiState.value = 'happy'
					const idx = messages.value.findIndex((m) => m.id === streamingId)
					if (idx !== -1) {
						messages.value[idx] = {
							...event.message,
							streaming: false,
							responseTime: event.responseTime,
							toolCalls: messages.value[idx].toolCalls
						}
					}
					setTimeout(() => {
						distiState.value = 'idle'
					}, 1200)
				} else if (event.type === 'error') {
					throw new Error(event.error || 'El asistente reportó un error inesperado.')
				}
			}
		}
	} catch (e: any) {
		messages.value = messages.value.filter((m) => m.id !== streamingId)
		if (e.name !== 'AbortError') {
			error.value = e.message
			distiState.value = 'sad'
			setTimeout(() => {
				distiState.value = 'idle'
			}, 2500)
		} else {
			distiState.value = 'idle'
		}
	} finally {
		abortController = null
		sending.value = false
		await followIfPinned()
	}
}

function cancelRequest() {
	abortController?.abort()
}

function handleKeydown(e: KeyboardEvent) {
	if (e.key === 'Enter' && !e.shiftKey) {
		e.preventDefault()
		sendMessage()
	}
}

const isAtBottom = ref(true)

function updateIsAtBottom() {
	const el = messagesContainer.value
	if (!el) return
	isAtBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 80
}

async function scrollToBottom() {
	await nextTick()
	if (messagesContainer.value) {
		messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
	}
	isAtBottom.value = true
	void renderMermaidDiagrams()
}

async function followIfPinned() {
	await nextTick()
	void renderMermaidDiagrams()
	if (isAtBottom.value && messagesContainer.value) {
		messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
	}
}

function formatTime(iso: string) {
	return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatResponseTime(ms: number): string {
	return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

function maskTokens(text: string): string {
	text = text.replace(/eyJ[a-zA-Z0-9+/_-]+=*\.[a-zA-Z0-9+/_-]+=*\.[a-zA-Z0-9+/_-]+=*/g, (m) => m.slice(0, 5) + '*****')
	text = text.replace(/\b(sk-|ghp_|ghs_|github_pat_|xoxb-|xoxp-|Bearer\s+)[a-zA-Z0-9+/_.-]{8,}/gi, (m) => m.slice(0, 5) + '*****')
	text = text.replace(/[a-zA-Z0-9+/_-]{25,}/g, (m) => {
		if (/[A-Z]/.test(m) && /[a-z]/.test(m) && /[0-9]/.test(m)) return m.slice(0, 5) + '*****'
		return m
	})
	return text
}

function renderInlineMarkdown(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
		.replace(/`(.+?)`/g, '<code class="bg-base-100/80 px-1 rounded text-xs font-mono">$1</code>')
}

function renderMarkdown(text: string): string {
	text = maskTokens(text)
	const isTableRow = (line: string) => /^\|.+\|$/.test(line.trim())
	const isSeparator = (line: string) => /^\|[\s\-:|]+\|$/.test(line.trim())

	function parseRow(line: string): string[] {
		return line
			.trim()
			.slice(1, -1)
			.split('|')
			.map((c) => c.trim())
	}

	function renderTable(lines: string[]): string {
		const headers = parseRow(lines[0])
		const body = lines.slice(2)
		const th = headers
			.map(
				(h) =>
					`<th style="text-align:left;padding:6px 12px;border-bottom:1px solid #475569;color:#cbd5e1;font-weight:600;white-space:nowrap">${renderInlineMarkdown(h)}</th>`
			)
			.join('')
		const trs = body
			.map(
				(row) =>
					'<tr style="border-bottom:1px solid #1e293b">' +
					parseRow(row)
						.map((cell) => `<td style="padding:5px 12px;color:#e2e8f0">${renderInlineMarkdown(cell)}</td>`)
						.join('') +
					'</tr>'
			)
			.join('')
		return `<div class="overflow-auto"><table style="border-collapse:collapse;width:100%;font-size:0.8rem;margin:8px 0;background:#0f172a;border-radius:8px;overflow:hidden"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table></div>`
	}

	const lines = text.split('\n')
	const out: string[] = []
	let i = 0
	while (i < lines.length) {
		if (/^```mermaid\s*$/.test(lines[i].trim())) {
			const diagram: string[] = []
			let j = i + 1
			while (j < lines.length && lines[j].trim() !== '```') {
				diagram.push(lines[j++])
			}
			if (j < lines.length) {
				out.push(`<div class="mermaid-block" data-mermaid="${encodeURIComponent(diagram.join('\n'))}"></div>`)
				i = j + 1
				continue
			}
		}
		if (isTableRow(lines[i]) && i + 1 < lines.length && isSeparator(lines[i + 1])) {
			const tableLines = [lines[i], lines[i + 1]]
			i += 2
			while (i < lines.length && isTableRow(lines[i])) {
				tableLines.push(lines[i++])
			}
			out.push(renderTable(tableLines))
		} else {
			out.push(renderInlineMarkdown(lines[i]))
			i++
		}
	}
	return out.join('\n')
}

onMounted(startConversation)
</script>

<template>
	<div class="flex flex-col h-screen bg-base-300">
		<!-- Header -->
		<header class="shrink-0 px-6 py-4 border-b border-base-300 bg-base-100 flex items-center justify-between">
			<div class="flex items-center gap-3 min-w-0">
				<div class="shrink-0 w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
					D
				</div>
				<div class="min-w-0">
					<h1 class="text-base font-semibold text-base-content truncate">Asistente de Conocimiento Distelsa</h1>
					<p class="text-xs text-base-content/50">Pregunta lo que necesites. No requiere iniciar sesión.</p>
				</div>
			</div>
			<button type="button" @click="startConversation" :disabled="starting || sending"
				class="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-base-200 hover:bg-base-100 text-base-content disabled:opacity-40 transition-colors">
				<span class="mdi mdi-plus"></span>
				Nuevo chat
			</button>
		</header>

		<!-- Messages -->
		<div ref="messagesContainer" class="flex-1 overflow-y-auto px-6 py-6 space-y-4" @scroll="updateIsAtBottom">
			<div v-if="starting" class="flex items-center justify-center py-12">
				<div class="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
			</div>

			<template v-else>
				<div v-if="messages.length === 0" class="text-center py-12 text-base-content/50 text-sm">
					Sin mensajes aún. ¡Escribe algo para comenzar!
				</div>

				<div v-for="msg in messages" :key="msg.id" class="flex gap-3 max-w-3xl mx-auto w-full"
					:class="msg.role === 'user' ? 'flex-row-reverse' : ''">
					<!-- Avatar -->
					<div class="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
						:class="msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-base-100 text-base-content'">
						{{ msg.role === 'user' ? 'U' : 'A' }}
					</div>

					<!-- Bubble + metadata -->
					<div class="flex flex-col gap-1 max-w-[80%]" :style="msg.role === 'user' ? 'align-items:flex-end' : ''">
						<div class="rounded-2xl text-sm leading-relaxed px-4 py-2.5" :class="msg.role === 'user'
							? 'bg-indigo-600 text-white rounded-tr-sm'
							: 'bg-base-100 text-base-content rounded-tl-sm border border-base-300'">
							<!-- Tool calls -->
							<div v-if="msg.toolCalls?.length" class="flex flex-wrap gap-1.5 mb-2">
								<span v-for="tool in msg.toolCalls" :key="tool"
									class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-base-100/60 text-base-content/50 text-xs font-mono">
									<svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
											d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
									</svg>
									{{ tool }}
								</span>
							</div>

							<span class="whitespace-pre-wrap" v-html="renderMarkdown(msg.content)" />
						</div>

						<!-- Timestamp + response time -->
						<div class="flex items-center gap-2 px-1 h-2.5">
							<span class="text-xs text-base-content/40">{{ formatTime(msg.createdAt) }}</span>
							<span v-if="msg.role === 'assistant' && msg.responseTime != null && !msg.streaming"
								class="flex items-center gap-1 text-xs text-base-content/40">
								<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
										d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								{{ formatResponseTime(msg.responseTime) }}
							</span>
						</div>
					</div>
				</div>
			</template>
		</div>

		<!-- Error banner -->
		<div v-if="error"
			class="mx-6 mb-2 px-4 py-2 rounded-lg bg-red-900/40 border border-red-700/50 text-red-400 text-sm flex items-center justify-between">
			{{ error }}
			<button class="text-red-500 hover:text-red-300 ml-3" @click="error = ''">✕</button>
		</div>

		<!-- Floating loader / scroll-to-bottom -->
		<div v-if="distiState !== 'idle' || !isAtBottom" class="relative">
			<transition name="disti-fade">
				<button type="button" @click="scrollToBottom"
					class="absolute -top-12 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium shadow-lg transition-colors"
					:class="distiState !== 'idle' ? 'bg-white hover:bg-white text-base-content' : 'bg-indigo-600 hover:bg-indigo-500 text-white'">
					<template v-if="distiState !== 'idle'">
						<DistiLoader :state="distiState" size="xs" theme="light" />
					</template>
					<template v-else>
						<span class="mdi mdi-arrow-down" :class="{ 'animate-bounce': sending }"></span>
						{{ sending ? 'Texto nuevo abajo' : 'Ir al final' }}
					</template>
				</button>
			</transition>
		</div>

		<!-- Input area -->
		<div class="px-6 pb-5 pt-2">
			<div class="flex items-end gap-3 rounded-2xl border bg-base-300 px-4 py-3 transition-colors max-w-3xl mx-auto"
				:class="conversationId ? 'border-base-300 focus-within:border-indigo-500/60' : 'border-base-300 opacity-50'">
				<textarea v-model="messageInput" :disabled="!conversationId || sending" rows="3"
					placeholder="Escribe un mensaje... (Enter para enviar, Shift+Enter para salto de línea)"
					class="flex-1 resize-none bg-transparent text-sm text-base-content placeholder:text-base-content/40 focus:outline-none max-h-36"
					@keydown="handleKeydown" />
				<button v-if="sending"
					class="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-colors bg-red-600 hover:bg-red-500"
					@click="cancelRequest" title="Cancelar">
					<span class="mdi mdi-window-close"></span>
				</button>
				<button v-else
					class="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-colors disabled:opacity-40"
					:class="messageInput.trim() && conversationId ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-base-100'"
					:disabled="!messageInput.trim() || !conversationId" @click="sendMessage">
					<span class="mdi mdi-send"></span>
				</button>
			</div>
		</div>

		<MermaidRenderer ref="mermaidRenderer" :container="messagesContainer" />
	</div>
</template>

<style scoped>
.disti-fade-enter-active,
.disti-fade-leave-active {
	transition: opacity 0.3s ease, transform 0.3s ease;
}

.disti-fade-enter-from,
.disti-fade-leave-to {
	opacity: 0;
	transform: scale(0.7);
}
</style>
