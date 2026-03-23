<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import * as api from '@/api/api'
import AppLayout from '@/components/AppLayout.vue'

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
  toolCalls?: string[]    // tool names invoked during this response
}

interface Conversation {
  id: string
  title: string
  agentId: string
  createdAt: string
  updatedAt: string
  messages?: DisplayMessage[]
}

interface RequestQuestion {
  id: string
  type: 'text' | 'multi' | 'select' | 'confirm'
  label: string
  description: string
  options: Array<{ label: string; description: string }>
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

// Form state keyed by message id
const formAnswers = ref<Record<string, Record<string, { textValue: string; selectedOptions: string[] }>>>({})
const submittedForms = ref<string[]>([])

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
    initFormAnswersFromMessages()
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
        } else if (event.type === 'tool') {
          const idx = messages.value.findIndex((m) => m.id === streamingId)
          if (idx !== -1) {
            const existing = messages.value[idx].toolCalls ?? []
            if (!existing.includes(event.name)) {
              messages.value[idx] = { ...messages.value[idx], toolCalls: [...existing, event.name] }
            }
          }
        } else if (event.type === 'done') {
          const idx = messages.value.findIndex((m) => m.id === streamingId)
          if (idx !== -1) {
            messages.value[idx] = {
              ...event.message,
              streaming: false,
              responseTime: event.responseTime,
              toolCalls: messages.value[idx].toolCalls,
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

// ── Request form helpers ──────────────────────────────────────────────────────

function parseRequestBlock(content: string): RequestQuestion[] | null {
  const match = content.match(/```request\n([\s\S]*?)```/)
  if (!match) return null

  const questions: RequestQuestion[] = []
  const parts = match[1].split(/(?=\[Q\d+\|)/)

  for (const part of parts) {
    const header = part.match(/^\[Q(\d+)\|(text|multi|select|confirm)\]\s*(.+?)(?:\n|$)/)
    if (!header) continue

    const rest = part.slice(header[0].length).trim()
    const lines = rest.split('\n')
    const options: Array<{ label: string; description: string }> = []
    const descLines: string[] = []

    for (const line of lines) {
      const opt = line.match(/^-\s*(.+?)\s*\|\s*(.+)$/)
      if (opt) options.push({ label: opt[1].trim(), description: opt[2].trim() })
      else if (line.trim()) descLines.push(line.trim())
    }

    questions.push({
      id: `Q${header[1]}`,
      type: header[2] as 'text' | 'multi' | 'select' | 'confirm',
      label: header[3].trim(),
      description: descLines.join('\n'),
      options,
    })
  }

  return questions.length > 0 ? questions : null
}

function getContentBeforeRequest(content: string): string {
  const idx = content.indexOf('```request')
  return idx > 0 ? content.slice(0, idx).trim() : ''
}

function getRequestQuestions(msg: DisplayMessage): RequestQuestion[] | null {
  if (msg.role !== 'assistant' || msg.streaming) return null
  return parseRequestBlock(msg.content)
}

function renderInlineMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code class="bg-slate-700/80 px-1 rounded text-xs font-mono">$1</code>')
}

function stripMarkdown(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`(.+?)`/g, '$1')
}

function toggleOption(msgId: string, questionId: string, option: string) {
  const q = formAnswers.value[msgId]?.[questionId]
  if (!q) return
  const idx = q.selectedOptions.indexOf(option)
  if (idx === -1) q.selectedOptions.push(option)
  else q.selectedOptions.splice(idx, 1)
}

function selectOption(msgId: string, questionId: string, option: string) {
  const q = formAnswers.value[msgId]?.[questionId]
  if (!q) return
  q.selectedOptions = [option]
}

function initFormAnswersFromMessages() {
  for (let i = 0; i < messages.value.length; i++) {
    const msg = messages.value[i]
    if (msg.role !== 'assistant' || msg.streaming) continue
    const questions = parseRequestBlock(msg.content)
    if (!questions) continue

    if (!formAnswers.value[msg.id]) {
      const answers: Record<string, { textValue: string; selectedOptions: string[] }> = {}
      for (const q of questions) answers[q.id] = { textValue: '', selectedOptions: [] }
      formAnswers.value[msg.id] = answers
    }

    // Auto-mark as submitted if any subsequent message exists (user already replied)
    const hasSubsequentMessage = messages.value.slice(i + 1).some((m) => !m.streaming)
    if (hasSubsequentMessage && !submittedForms.value.includes(msg.id)) {
      submittedForms.value.push(msg.id)
    }
  }
}

async function submitRequestForm(msgId: string, questions: RequestQuestion[]) {
  const answers = formAnswers.value[msgId]
  if (!answers) return

  const lines: string[] = []
  for (const q of questions) {
    const a = answers[q.id]
    let answerText: string

    if (q.type === 'text') {
      answerText = a.textValue.trim() || '(sin respuesta)'
    } else if (q.type === 'multi') {
      const parts = [...a.selectedOptions]
      if (a.textValue.trim()) parts.push(a.textValue.trim())
      answerText = parts.length > 0 ? parts.join(', ') : '(sin selección)'
    } else if (q.type === 'confirm') {
      answerText = a.selectedOptions[0] ?? (a.textValue.trim() || '(sin selección)')
      if (a.textValue.trim() && a.textValue.trim() !== answerText) answerText += ` (${a.textValue.trim()})`
    } else {
      // select
      answerText = a.selectedOptions[0] ?? (a.textValue.trim() || '(sin selección)')
      if (a.textValue.trim() && a.textValue.trim() !== answerText) answerText += ` (${a.textValue.trim()})`
    }

    lines.push(`${stripMarkdown(q.label)}: ${answerText}`)
  }

  submittedForms.value.push(msgId)
  messageInput.value = lines.join('\n')
  await sendMessage()
}

watch(messages, initFormAnswersFromMessages, { deep: true })

onMounted(fetchInitialData)
</script>

<template>
  <AppLayout>
    <div class="flex h-full bg-slate-950 text-white overflow-hidden">

      <!-- Sidebar: conversation list -->
      <div class="w-72 shrink-0 flex flex-col border-r border-slate-800 bg-slate-900">
        <div class="px-4 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-white">Conversaciones</h2>
          <button
            class="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
            @click="showNewChatForm = !showNewChatForm">
            + Nueva
          </button>
        </div>

        <!-- New conversation form -->
        <div v-if="showNewChatForm" class="px-4 py-3 border-b border-slate-800 space-y-2">
          <input v-model="newChatTitle" type="text" placeholder="Nombre del chat..."
            class="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500" />
          <select v-model="selectedAgentId"
            class="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500">
            <option value="">Seleccionar agente...</option>
            <option v-for="agent in agents" :key="agent.id" :value="agent.id">{{ agent.name }}</option>
          </select>
          <div class="flex gap-2">
            <button
              class="flex-1 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
              :disabled="!selectedAgentId || !newChatTitle.trim()" @click="createConversation">
              Crear
            </button>
            <button
              class="flex-1 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium transition-colors"
              @click="showNewChatForm = false">
              Cancelar
            </button>
          </div>
        </div>

        <!-- Conversation list -->
        <div class="flex-1 overflow-y-auto">
          <div v-if="conversations.length === 0" class="px-4 py-8 text-center text-slate-500 text-sm">
            Sin conversaciones
          </div>
          <button v-for="conv in conversations" :key="conv.id"
            class="w-full text-left px-4 py-3 border-b border-slate-800/60 hover:bg-slate-800/50 transition-colors group"
            :class="activeConversation?.id === conv.id ? 'bg-slate-800' : ''" @click="openConversation(conv)">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="text-sm font-medium text-white truncate">{{ conv.title }}</p>
                <p class="text-xs text-slate-500 mt-0.5">{{ new Date(conv.updatedAt).toLocaleDateString() }}</p>
              </div>
              <button
                class="shrink-0 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all"
                title="Eliminar" @click.stop="deleteConversation(conv)">
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

            <div v-for="msg in messages" :key="msg.id" class="flex gap-3"
              :class="msg.role === 'user' ? 'flex-row-reverse' : ''">
              <!-- Avatar -->
              <div class="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
                :class="msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'">
                {{ msg.role === 'user' ? 'U' : 'A' }}
              </div>

              <!-- Bubble + metadata -->
              <div class="flex flex-col gap-1"
                :class="getRequestQuestions(msg) && !submittedForms.includes(msg.id) ? 'max-w-[88%]' : 'max-w-[70%]'"
                :style="msg.role === 'user' ? 'align-items:flex-end' : ''">

                <!-- ── Bubble ─────────────────────────────────── -->
                <div class="px-4 py-2.5 rounded-2xl text-sm leading-relaxed" :class="msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-sm'
                  : 'bg-slate-800 text-slate-100 rounded-tl-sm border border-slate-700/50'">

                  <!-- Tool calls — shown before the text content -->
                  <div v-if="msg.toolCalls?.length" class="flex flex-wrap gap-1.5 mb-2">
                    <span v-for="tool in msg.toolCalls" :key="tool"
                      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-700/60 text-slate-500 text-xs font-mono">
                      <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {{ tool }}
                    </span>
                  </div>

                  <!-- ── Active request form ── -->
                  <template v-if="getRequestQuestions(msg) && !submittedForms.includes(msg.id) && formAnswers[msg.id]">
                    <p v-if="getContentBeforeRequest(msg.content)" class="whitespace-pre-wrap mb-3 text-slate-300">{{
                      getContentBeforeRequest(msg.content) }}</p>

                    <div class="space-y-4 border border-slate-600/40 rounded-xl p-4 bg-slate-900/60">
                      <p class="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Completa el formulario
                      </p>

                      <div v-for="q in getRequestQuestions(msg)" :key="q.id" class="space-y-2">
                        <!-- Question label + description -->
                        <div>
                          <p class="text-sm font-medium text-slate-100" v-html="renderInlineMarkdown(q.label)" />
                          <p v-if="q.description" class="text-xs text-slate-500 mt-0.5 whitespace-pre-wrap"
                            v-html="renderInlineMarkdown(q.description)" />
                        </div>

                        <!-- Multi: predefined options (checkboxes) -->
                        <div v-if="q.type === 'multi' && q.options.length" class="space-y-1.5 pl-0.5">
                          <label v-for="opt in q.options" :key="opt.label"
                            class="flex items-start gap-2.5 cursor-pointer select-none">
                            <input type="checkbox"
                              :checked="formAnswers[msg.id][q.id].selectedOptions.includes(opt.label)"
                              @change="toggleOption(msg.id, q.id, opt.label)"
                              class="mt-0.5 shrink-0 rounded border-slate-600 bg-slate-800 accent-indigo-500 cursor-pointer" />
                            <span class="text-sm text-slate-200 leading-snug">
                              {{ opt.label }}
                              <span v-if="opt.description" class="text-slate-500"> — {{ opt.description }}</span>
                            </span>
                          </label>
                        </div>

                        <!-- Select: predefined options (radio buttons, single choice) -->
                        <div v-if="q.type === 'select' && q.options.length" class="space-y-1.5 pl-0.5">
                          <label v-for="opt in q.options" :key="opt.label"
                            class="flex items-start gap-2.5 cursor-pointer select-none">
                            <input type="radio" :name="`${msg.id}-${q.id}`" :value="opt.label"
                              :checked="formAnswers[msg.id][q.id].selectedOptions[0] === opt.label"
                              @change="selectOption(msg.id, q.id, opt.label)"
                              class="mt-0.5 shrink-0 border-slate-600 bg-slate-800 accent-indigo-500 cursor-pointer" />
                            <span class="text-sm text-slate-200 leading-snug">
                              {{ opt.label }}
                              <span v-if="opt.description" class="text-slate-500"> — {{ opt.description }}</span>
                            </span>
                          </label>
                        </div>

                        <!-- Text input (always shown) -->
                        <input :value="formAnswers[msg.id][q.id].textValue"
                          @input="(e) => (formAnswers[msg.id][q.id].textValue = (e.target as HTMLInputElement).value)"
                          type="text" :placeholder="q.type === 'multi' || q.type === 'select'
                            ? 'Otra respuesta (opcional)...'
                            : (q.description ? q.description.split('\n')[0] : 'Tu respuesta...')"
                          class="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors" />
                      </div>

                      <button @click="submitRequestForm(msg.id, getRequestQuestions(msg)!)"
                        :disabled="sending || !activeConversation"
                        class="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
                        Enviar respuestas
                      </button>
                    </div>
                  </template>

                  <!-- ── Submitted form notice ── -->
                  <template v-else-if="getRequestQuestions(msg)">
                    <p v-if="getContentBeforeRequest(msg.content)" class="whitespace-pre-wrap mb-2 text-slate-300">{{
                      getContentBeforeRequest(msg.content) }}</p>
                    <span class="inline-flex items-center gap-1.5 text-xs text-slate-500">
                      <svg class="w-3.5 h-3.5 text-green-400 shrink-0" fill="none" stroke="currentColor"
                        viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                      </svg>
                      Formulario enviado
                    </span>
                  </template>

                  <!-- ── Plain text content ── -->
                  <template v-else>
                    <span class="whitespace-pre-wrap">{{ msg.content }}</span>
                    <span v-if="msg.streaming"
                      class="inline-block w-0.5 h-4 bg-slate-300 ml-0.5 align-middle animate-pulse" />
                  </template>
                </div>

                <!-- Timestamp + response time -->
                <div class="flex items-center gap-2 px-1">
                  <span class="text-xs text-slate-600">{{ formatTime(msg.createdAt) }}</span>
                  <span v-if="msg.role === 'assistant' && msg.responseTime != null && !msg.streaming"
                    class="flex items-center gap-1 text-xs text-slate-600">
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

        <!-- Input area -->
        <div class="px-6 pb-5 pt-2">
          <div class="flex items-end gap-3 rounded-2xl border bg-slate-900 px-4 py-3 transition-colors"
            :class="activeConversation ? 'border-slate-700 focus-within:border-indigo-500/60' : 'border-slate-800 opacity-50'">
            <textarea v-model="messageInput" :disabled="!activeConversation || sending" rows="1"
              placeholder="Escribe un mensaje... (Enter para enviar, Shift+Enter para salto de línea)"
              class="flex-1 resize-none bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none max-h-36"
              @keydown="handleKeydown" />
            <button
              class="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-colors disabled:opacity-40"
              :class="messageInput.trim() && activeConversation && !sending ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-slate-700'"
              :disabled="!messageInput.trim() || !activeConversation || sending" @click="sendMessage">
              <!-- Spinner while sending -->
              <svg v-if="sending" class="w-4 h-4 text-slate-300 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <!-- Send icon -->
              <svg v-else class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>

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

          <div v-for="msg in messages" :key="msg.id" class="flex gap-3"
            :class="msg.role === 'user' ? 'flex-row-reverse' : ''">
            <!-- Avatar -->
            <div class="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
              :class="msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'">
              {{ msg.role === 'user' ? 'U' : 'A' }}
            </div>

            <!-- Bubble + metadata -->
            <div class="flex flex-col gap-1"
              :class="getRequestQuestions(msg) && !submittedForms.includes(msg.id) ? 'max-w-[88%]' : 'max-w-[70%]'"
              :style="msg.role === 'user' ? 'align-items:flex-end' : ''">

              <!-- ── Bubble ─────────────────────────────────── -->
              <div class="px-4 py-2.5 rounded-2xl text-sm leading-relaxed" :class="msg.role === 'user'
                ? 'bg-indigo-600 text-white rounded-tr-sm'
                : 'bg-slate-800 text-slate-100 rounded-tl-sm border border-slate-700/50'">

                <!-- Tool calls — shown before the text content -->
                <div v-if="msg.toolCalls?.length" class="flex flex-wrap gap-1.5 mb-2">
                  <span v-for="tool in msg.toolCalls" :key="tool"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-700/60 text-slate-500 text-xs font-mono">
                    <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {{ tool }}
                  </span>
                </div>

                <!-- ── Active request form ── -->
                <template v-if="getRequestQuestions(msg) && !submittedForms.includes(msg.id) && formAnswers[msg.id]">
                  <p v-if="getContentBeforeRequest(msg.content)" class="whitespace-pre-wrap mb-3 text-slate-300">{{
                    getContentBeforeRequest(msg.content) }}</p>

                  <div class="space-y-4 border border-slate-600/40 rounded-xl p-4 bg-slate-900/60">
                    <p class="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Completa el formulario</p>

                    <div v-for="q in getRequestQuestions(msg)" :key="q.id" class="space-y-2">
                      <!-- Question label + description -->
                      <div>
                        <p class="text-sm font-medium text-slate-100" v-html="renderInlineMarkdown(q.label)" />
                        <p v-if="q.description" class="text-xs text-slate-500 mt-0.5 whitespace-pre-wrap"
                          v-html="renderInlineMarkdown(q.description)" />
                      </div>

                      <!-- Multi: predefined options (checkboxes) -->
                      <div v-if="q.type === 'multi' && q.options.length" class="space-y-1.5 pl-0.5">
                        <label v-for="opt in q.options" :key="opt.label"
                          class="flex items-start gap-2.5 cursor-pointer select-none">
                          <input type="checkbox"
                            :checked="formAnswers[msg.id][q.id].selectedOptions.includes(opt.label)"
                            @change="toggleOption(msg.id, q.id, opt.label)"
                            class="mt-0.5 shrink-0 rounded border-slate-600 bg-slate-800 accent-indigo-500 cursor-pointer" />
                          <span class="text-sm text-slate-200 leading-snug">
                            {{ opt.label }}
                            <span v-if="opt.description" class="text-slate-500"> — {{ opt.description }}</span>
                          </span>
                        </label>
                      </div>

                      <!-- Confirm: options as clickable buttons -->
                      <div v-if="q.type === 'confirm' && q.options.length" class="flex flex-wrap gap-2">
                        <button v-for="opt in q.options" :key="opt.label" type="button"
                          @click="selectOption(msg.id, q.id, opt.label)" :title="opt.description || undefined"
                          :class="formAnswers[msg.id][q.id].selectedOptions[0] === opt.label
                            ? 'bg-indigo-600 border-indigo-500 text-white'
                            : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-indigo-500/60 hover:text-white'" class="px-4 py-1.5 rounded-lg border text-sm font-medium transition-colors">
                          {{ opt.label }}
                        </button>
                      </div>

                      <!-- Select: predefined options (radio buttons, single choice) -->
                      <div v-if="q.type === 'select' && q.options.length" class="space-y-1.5 pl-0.5">
                        <label v-for="opt in q.options" :key="opt.label"
                          class="flex items-start gap-2.5 cursor-pointer select-none">
                          <input type="radio" :name="`${msg.id}-${q.id}`" :value="opt.label"
                            :checked="formAnswers[msg.id][q.id].selectedOptions[0] === opt.label"
                            @change="selectOption(msg.id, q.id, opt.label)"
                            class="mt-0.5 shrink-0 border-slate-600 bg-slate-800 accent-indigo-500 cursor-pointer" />
                          <span class="text-sm text-slate-200 leading-snug">
                            {{ opt.label }}
                            <span v-if="opt.description" class="text-slate-500"> — {{ opt.description }}</span>
                          </span>
                        </label>
                      </div>

                      <!-- Text input (always shown) -->
                      <input :value="formAnswers[msg.id][q.id].textValue"
                        @input="(e) => (formAnswers[msg.id][q.id].textValue = (e.target as HTMLInputElement).value)"
                        type="text" :placeholder="q.type === 'multi' || q.type === 'select' || q.type === 'confirm'
                          ? 'Otra respuesta (opcional)...'
                          : (q.description ? q.description.split('\n')[0] : 'Tu respuesta...')"
                        class="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors" />
                    </div>

                    <button @click="submitRequestForm(msg.id, getRequestQuestions(msg)!)"
                      :disabled="sending || !activeConversation"
                      class="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
                      Enviar respuestas
                    </button>
                  </div>
                </template>

                <!-- ── Submitted form notice ── -->
                <template v-else-if="getRequestQuestions(msg)">
                  <p v-if="getContentBeforeRequest(msg.content)" class="whitespace-pre-wrap mb-2 text-slate-300">{{
                    getContentBeforeRequest(msg.content) }}</p>
                  <span class="inline-flex items-center gap-1.5 text-xs text-slate-500">
                    <svg class="w-3.5 h-3.5 text-green-400 shrink-0" fill="none" stroke="currentColor"
                      viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                    Formulario enviado
                  </span>
                </template>

                <!-- ── Plain text content ── -->
                <template v-else>
                  <span class="whitespace-pre-wrap">{{ msg.content }}</span>
                  <span v-if="msg.streaming"
                    class="inline-block w-0.5 h-4 bg-slate-300 ml-0.5 align-middle animate-pulse" />
                </template>
              </div>

              <!-- Timestamp + response time -->
              <div class="flex items-center gap-2 px-1">
                <span class="text-xs text-slate-600">{{ formatTime(msg.createdAt) }}</span>
                <span v-if="msg.role === 'assistant' && msg.responseTime != null && !msg.streaming"
                  class="flex items-center gap-1 text-xs text-slate-600">
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

      <!-- Input area -->
      <div class="px-6 pb-5 pt-2">
        <div class="flex items-end gap-3 rounded-2xl border bg-slate-900 px-4 py-3 transition-colors"
          :class="activeConversation ? 'border-slate-700 focus-within:border-indigo-500/60' : 'border-slate-800 opacity-50'">
          <textarea v-model="messageInput" :disabled="!activeConversation || sending" rows="1"
            placeholder="Escribe un mensaje... (Enter para enviar, Shift+Enter para salto de línea)"
            class="flex-1 resize-none bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none max-h-36"
            @keydown="handleKeydown" />
          <button
            class="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-colors disabled:opacity-40"
            :class="messageInput.trim() && activeConversation && !sending ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-slate-700'"
            :disabled="!messageInput.trim() || !activeConversation || sending" @click="sendMessage">
            <!-- Spinner while sending -->
            <svg v-if="sending" class="w-4 h-4 text-slate-300 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <!-- Send icon -->
            <svg v-else class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>

    </div>
  </AppLayout>
</template>
