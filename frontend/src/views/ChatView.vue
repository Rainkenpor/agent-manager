<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import * as api from '@/api/api'

interface Agent {
  id: string
  name: string
  slug: string
  mode: string
  isActive: boolean
}

interface DisplayMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  responseTime?: number   // ms — only set on assistant messages once streaming completes
  streaming?: boolean     // true while the stream is still open
}

interface Conversation {
  id: string
  title: string
  agentId: string
  createdAt: string
  updatedAt: string
  messages?: DisplayMessage[]
}

const agents = ref<Agent[]>([])
const conversations = ref<Conversation[]>([])
const activeConversation = ref<Conversation | null>(null)
const messages = ref<DisplayMessage[]>([])

const selectedAgentId = ref('')
const newChatTitle = ref('')
const messageInput = ref('')
const sending = ref(false)
const loadingConversation = ref(false)
const showNewChatForm = ref(false)
const error = ref('')

const messagesContainer = ref<HTMLElement | null>(null)

const activeAgent = computed(() => agents.value.find((a) => a.id === activeConversation.value?.agentId))

async function fetchInitialData() {
  try {
    const [agentsRes, convRes] = await Promise.all([api.getAgents(), api.getConversations()])
    agents.value = (agentsRes.data ?? []).filter((a: Agent) => a.isActive)
    conversations.value = convRes.data ?? []
  } catch (e: any) {
    error.value = e.message
  }
}

async function openConversation(conv: Conversation) {
  loadingConversation.value = true
  try {
    const res = await api.getConversation(conv.id)
    activeConversation.value = res.data
    messages.value = (res.data.messages ?? []) as DisplayMessage[]
    await scrollToBottom()
  } catch (e: any) {
    error.value = e.message
  } finally {
    loadingConversation.value = false
  }
}

async function createConversation() {
  if (!selectedAgentId.value || !newChatTitle.value.trim()) return
  try {
    const res = await api.createConversation({ title: newChatTitle.value.trim(), agentId: selectedAgentId.value })
    conversations.value.unshift(res.data)
    showNewChatForm.value = false
    newChatTitle.value = ''
    selectedAgentId.value = ''
    await openConversation(res.data)
  } catch (e: any) {
    error.value = e.message
  }
}

async function sendMessage() {
  if (!messageInput.value.trim() || !activeConversation.value || sending.value) return
  const content = messageInput.value.trim()
  messageInput.value = ''
  sending.value = true
  error.value = ''

  // Add user message immediately
  const userMsg: DisplayMessage = {
    id: `user-${Date.now()}`,
    role: 'user',
    content,
    createdAt: new Date().toISOString(),
  }
  messages.value.push(userMsg)

  // Add empty streaming assistant message
  const streamingId = `stream-${Date.now()}`
  const assistantMsg: DisplayMessage = {
    id: streamingId,
    role: 'assistant',
    content: '',
    createdAt: new Date().toISOString(),
    streaming: true,
  }
  messages.value.push(assistantMsg)
  await scrollToBottom()

  try {
    const response = await api.streamMessage(activeConversation.value.id, content)

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: response.statusText }))
      throw new Error(err.error || response.statusText)
    }

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''

      for (const part of parts) {
        const line = part.trim()
        if (!line.startsWith('data: ')) continue
        let event: any
        try { event = JSON.parse(line.slice(6)) } catch { continue }

        if (event.type === 'chunk') {
          const idx = messages.value.findIndex((m) => m.id === streamingId)
          if (idx !== -1) {
            messages.value[idx] = { ...messages.value[idx], content: messages.value[idx].content + event.content }
            await scrollToBottom()
          }
        } else if (event.type === 'done') {
          const idx = messages.value.findIndex((m) => m.id === streamingId)
          if (idx !== -1) {
            messages.value[idx] = {
              ...event.message,
              streaming: false,
              responseTime: event.responseTime,
            }
          }
        } else if (event.type === 'error') {
          throw new Error(event.error)
        }
      }
    }
  } catch (e: any) {
    // Remove streaming placeholder on error
    messages.value = messages.value.filter((m) => m.id !== streamingId)
    error.value = e.message
  } finally {
    sending.value = false
    await scrollToBottom()
  }
}

async function deleteConversation(conv: Conversation) {
  try {
    await api.deleteConversation(conv.id)
    conversations.value = conversations.value.filter((c) => c.id !== conv.id)
    if (activeConversation.value?.id === conv.id) {
      activeConversation.value = null
      messages.value = []
    }
  } catch (e: any) {
    error.value = e.message
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

async function scrollToBottom() {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatResponseTime(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

onMounted(fetchInitialData)
</script>

<template>
  <div class="flex h-full bg-slate-950 text-white overflow-hidden">

    <!-- Sidebar: conversation list -->
    <div class="w-72 shrink-0 flex flex-col border-r border-slate-800 bg-slate-900">
      <div class="px-4 py-4 border-b border-slate-800 flex items-center justify-between">
        <h2 class="text-sm font-semibold text-white">Conversaciones</h2>
        <button
          class="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
          @click="showNewChatForm = !showNewChatForm"
        >
          + Nueva
        </button>
      </div>

      <!-- New conversation form -->
      <div v-if="showNewChatForm" class="px-4 py-3 border-b border-slate-800 space-y-2">
        <input
          v-model="newChatTitle"
          type="text"
          placeholder="Nombre del chat..."
          class="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
        <select
          v-model="selectedAgentId"
          class="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
        >
          <option value="">Seleccionar agente...</option>
          <option v-for="agent in agents" :key="agent.id" :value="agent.id">{{ agent.name }}</option>
        </select>
        <div class="flex gap-2">
          <button
            class="flex-1 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
            :disabled="!selectedAgentId || !newChatTitle.trim()"
            @click="createConversation"
          >
            Crear
          </button>
          <button
            class="flex-1 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium transition-colors"
            @click="showNewChatForm = false"
          >
            Cancelar
          </button>
        </div>
      </div>

      <!-- Conversation list -->
      <div class="flex-1 overflow-y-auto">
        <div v-if="conversations.length === 0" class="px-4 py-8 text-center text-slate-500 text-sm">
          Sin conversaciones
        </div>
        <button
          v-for="conv in conversations"
          :key="conv.id"
          class="w-full text-left px-4 py-3 border-b border-slate-800/60 hover:bg-slate-800/50 transition-colors group"
          :class="activeConversation?.id === conv.id ? 'bg-slate-800' : ''"
          @click="openConversation(conv)"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="text-sm font-medium text-white truncate">{{ conv.title }}</p>
              <p class="text-xs text-slate-500 mt-0.5">{{ new Date(conv.updatedAt).toLocaleDateString() }}</p>
            </div>
            <button
              class="shrink-0 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all"
              title="Eliminar"
              @click.stop="deleteConversation(conv)"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </button>
      </div>
    </div>

    <!-- Main chat area -->
    <div class="flex-1 flex flex-col min-w-0">

      <!-- Header -->
      <div class="px-6 py-4 border-b border-slate-800 flex items-center gap-3">
        <template v-if="activeConversation">
          <div class="w-8 h-8 rounded-lg bg-cyan-600/20 flex items-center justify-center shrink-0">
            <svg class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
            </svg>
          </div>
          <div>
            <p class="text-sm font-semibold text-white">{{ activeConversation.title }}</p>
            <p class="text-xs text-slate-400">Agente: {{ activeAgent?.name ?? activeConversation.agentId }}</p>
          </div>
        </template>
        <template v-else>
          <div class="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
            <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p class="text-sm text-slate-400">Selecciona o crea una conversación</p>
        </template>
      </div>

      <!-- Messages -->
      <div ref="messagesContainer" class="flex-1 overflow-y-auto px-6 py-4 space-y-4">

        <!-- Empty state -->
        <div v-if="!activeConversation" class="h-full flex flex-col items-center justify-center text-center">
          <div class="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-4">
            <svg class="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p class="text-white font-semibold mb-1">Chatea con un agente</p>
          <p class="text-slate-500 text-sm max-w-xs">
            Crea una nueva conversación y selecciona el agente con el que deseas interactuar.
          </p>
        </div>

        <div v-else-if="loadingConversation" class="flex items-center justify-center py-12">
          <div class="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        </div>

        <template v-else>
          <div v-if="messages.length === 0" class="text-center py-12 text-slate-500 text-sm">
            Sin mensajes aún. ¡Escribe algo para comenzar!
          </div>

          <div v-for="msg in messages" :key="msg.id" class="flex gap-3" :class="msg.role === 'user' ? 'flex-row-reverse' : ''">
            <!-- Avatar -->
            <div
              class="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
              :class="msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'"
            >
              {{ msg.role === 'user' ? 'U' : 'A' }}
            </div>

            <!-- Bubble + metadata -->
            <div class="max-w-[70%] flex flex-col gap-1" :class="msg.role === 'user' ? 'items-end' : 'items-start'">
              <div
                class="px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
                :class="msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-sm'
                  : 'bg-slate-800 text-slate-100 rounded-tl-sm border border-slate-700/50'"
              >
                {{ msg.content }}
                <!-- Blinking cursor while streaming -->
                <span
                  v-if="msg.streaming"
                  class="inline-block w-0.5 h-4 bg-slate-300 ml-0.5 align-middle animate-pulse"
                />
              </div>

              <!-- Timestamp + response time -->
              <div class="flex items-center gap-2 px-1">
                <span class="text-xs text-slate-600">{{ formatTime(msg.createdAt) }}</span>
                <span
                  v-if="msg.role === 'assistant' && msg.responseTime != null && !msg.streaming"
                  class="flex items-center gap-1 text-xs text-slate-600"
                >
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
      <div
        v-if="error"
        class="mx-6 mb-2 px-4 py-2 rounded-lg bg-red-900/40 border border-red-700/50 text-red-400 text-sm flex items-center justify-between"
      >
        {{ error }}
        <button class="text-red-500 hover:text-red-300 ml-3" @click="error = ''">✕</button>
      </div>

      <!-- Input area -->
      <div class="px-6 pb-5 pt-2">
        <div
          class="flex items-end gap-3 rounded-2xl border bg-slate-900 px-4 py-3 transition-colors"
          :class="activeConversation ? 'border-slate-700 focus-within:border-indigo-500/60' : 'border-slate-800 opacity-50'"
        >
          <textarea
            v-model="messageInput"
            :disabled="!activeConversation || sending"
            rows="1"
            placeholder="Escribe un mensaje... (Enter para enviar, Shift+Enter para salto de línea)"
            class="flex-1 resize-none bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none max-h-36"
            @keydown="handleKeydown"
          />
          <button
            class="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-colors disabled:opacity-40"
            :class="messageInput.trim() && activeConversation && !sending ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-slate-700'"
            :disabled="!messageInput.trim() || !activeConversation || sending"
            @click="sendMessage"
          >
            <!-- Spinner while sending -->
            <svg v-if="sending" class="w-4 h-4 text-slate-300 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <!-- Send icon -->
            <svg v-else class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>

    </div>
  </div>
</template>
