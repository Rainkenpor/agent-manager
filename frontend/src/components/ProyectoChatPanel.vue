<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import * as api from '@/api/api'
import { useToastStore } from '@/store/useToast'

const props = defineProps<{ proyectoId: string }>()
const emit = defineEmits<{ changed: [] }>()

const toast = useToastStore()

interface ChatMessage {
	role: 'user' | 'assistant'
	content: string
	toolCalls?: string[]
}

const conversationId = ref<string | null>(null)
const messages = ref<ChatMessage[]>([])
const input = ref('')
const streaming = ref(false)
const initializing = ref(true)
const scroller = ref<HTMLElement | null>(null)
let abortController: AbortController | null = null

async function scrollToBottom() {
	await nextTick()
	if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
}

async function init() {
	initializing.value = true
	try {
		const res = await api.getOrCreateProyectoChat(props.proyectoId)
		if (!res.success || !res.data) throw new Error(res.error || 'No se pudo iniciar el chat')
		conversationId.value = res.data.id
		const conv = await api.getConversation(res.data.id)
		messages.value = (conv.data?.messages ?? []).map((m: any) => ({ role: m.role, content: m.content }))
		await scrollToBottom()
	} catch (e: any) {
		toast.error(e.message)
	} finally {
		initializing.value = false
	}
}

async function send() {
	const content = input.value.trim()
	if (!content || streaming.value || !conversationId.value) return
	input.value = ''
	messages.value.push({ role: 'user', content })
	const assistant: ChatMessage = { role: 'assistant', content: '', toolCalls: [] }
	messages.value.push(assistant)
	streaming.value = true
	await scrollToBottom()

	abortController = new AbortController()
	try {
		const response = await api.streamProyectoMessage(conversationId.value, content, abortController.signal)
		if (!response.ok || !response.body) throw new Error(`Error de conexión (${response.status})`)
		const reader = response.body.getReader()
		const decoder = new TextDecoder()
		let buffer = ''
		let toolUsed = false
		while (true) {
			const { done, value } = await reader.read()
			if (done) break
			buffer += decoder.decode(value, { stream: true })
			const parts = buffer.split('\n\n')
			buffer = parts.pop() ?? ''
			for (const part of parts) {
				const line = part.trim()
				if (!line.startsWith('data: ')) continue
				const event = JSON.parse(line.slice(6))
				if (event.type === 'chunk') {
					assistant.content += event.content
				} else if (event.type === 'tool') {
					if (!assistant.toolCalls!.includes(event.name)) assistant.toolCalls!.push(event.name)
					toolUsed = true
				} else if (event.type === 'done') {
					if (event.message?.content) assistant.content = event.message.content
				} else if (event.type === 'error') {
					throw new Error(event.error)
				}
				await scrollToBottom()
			}
		}
		// Las herramientas del JSON persisten cambios: refrescar el proyecto.
		if (toolUsed) emit('changed')
	} catch (e: any) {
		if (e.name !== 'AbortError') {
			assistant.content = assistant.content || `⚠️ ${e.message}`
			toast.error(e.message)
		}
	} finally {
		streaming.value = false
		abortController = null
	}
}

function cancel() {
	abortController?.abort()
}

onMounted(init)
</script>

<template>
  <div class="flex flex-col h-full min-h-0 bg-base-200 rounded-xl">
    <div v-if="initializing" class="flex-1 flex items-center justify-center">
      <span class="loading loading-spinner text-primary" />
    </div>

    <template v-else>
      <div ref="scroller" class="flex-1 overflow-y-auto p-4 space-y-4">
        <p v-if="messages.length === 0" class="text-center text-base-content/50 text-sm py-10">
          Pídele al agente consultar o modificar la información del proyecto: historias de usuario, arquitectura, proyectos relacionados o metadatos.
        </p>
        <div v-for="(m, i) in messages" :key="i" class="flex" :class="m.role === 'user' ? 'justify-end' : 'justify-start'">
          <div
            class="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap"
            :class="m.role === 'user' ? 'bg-primary text-primary-content' : 'bg-base-100 text-base-content'"
          >
            <div v-if="m.toolCalls?.length" class="flex flex-wrap gap-1.5 mb-1.5">
              <span
                v-for="tool in m.toolCalls"
                :key="tool"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-base-300/60 text-base-content/50 text-[11px] font-mono"
              >
                <i class="mdi mdi-tools" /> {{ tool }}
              </span>
            </div>
            <span>{{ m.content }}</span>
          </div>
        </div>
      </div>

      <div class="border-t border-base-300/60 p-3 flex gap-2">
        <textarea
          v-model="input"
          rows="1"
          class="textarea textarea-bordered flex-1 resize-none"
          placeholder="Escribe un mensaje..."
          :disabled="streaming"
          @keydown.enter.exact.prevent="send"
        />
        <button v-if="!streaming" class="btn btn-primary btn-sm" :disabled="!input.trim()" @click="send">
          <i class="mdi mdi-send" />
        </button>
        <button v-else class="btn btn-error btn-sm" @click="cancel">
          <i class="mdi mdi-stop" />
        </button>
      </div>
    </template>
  </div>
</template>
