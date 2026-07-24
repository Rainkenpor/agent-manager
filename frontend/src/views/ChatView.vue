<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import * as api from '@/api/api'
import AppModal from '@/components/AppModal.vue'
import DistiLoader from '@/components/DistiLoader.vue'
import MermaidRenderer from '@/components/MermaidRenderer.vue'
import NewCredential from '@/components/NewCredential.vue'
import ShareTraceabilityModal from '@/components/ShareTraceabilityModal.vue'
import TraceabilitySidebarPanel from '@/components/TraceabilitySidebarPanel.vue'
import { useAuthStore } from '@/store/useAuth'
import type { McpServer } from '@/types/types'

const auth = useAuthStore()

const mermaidRenderer = ref<InstanceType<typeof MermaidRenderer> | null>(null)
function renderMermaidDiagrams() {
  void mermaidRenderer.value?.renderDiagrams()
}

interface Agent {
  id: string
  name: string
  slug: string
  mode: string
  isActive: boolean
}

interface ChatImage {
  serverId?: string
  toolName: string
  args: Record<string, unknown>
  mimeType: string
  thumb: string // dataURL de la miniatura (persistida)
  full?: string // dataURL del original — solo durante la sesión en vivo
  loading?: boolean // true mientras se re-invoca la tool para traer el original
}

interface DisplayMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  responseTime?: number // ms — only set on assistant messages once streaming completes
  streaming?: boolean // true while the stream is still open
  toolCalls?: string[] // tool names invoked during this response
  images?: ChatImage[] // imágenes generadas por tools MCP en esta respuesta
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
  type: 'text' | 'multi' | 'single' | 'list' | 'confirm' | 'setCredential'
  label: string
  description: string
  options: Array<{ label: string; description: string }>
}

const agents = ref<Agent[]>([])
const chatAgents = ref<Array<{ id: string; name: string; slug: string; description: string | null }>>([])
const conversations = ref<Conversation[]>([])
const agentsMap = computed(() => {
  const map = new Map<string, string>()
  for (const agent of agents.value) {
    map.set(agent.id, agent.name)
  }
  return map
})
const activeConversation = ref<Conversation | null>(null)
const messages = ref<DisplayMessage[]>([])

// ── Modo Proyectos (chat por interesado) ────────────────────────────────
const sidebarMode = ref<'chats' | 'proyectos'>('chats')
const misProyectos = ref<any[]>([])
const selectedProyecto = ref<any | null>(null)
const proyectoParticipantes = ref<any[]>([])
const loadingProyectos = ref(false)

async function loadMisProyectos() {
  loadingProyectos.value = true
  try {
    const r = await api.getMisProyectos()
    misProyectos.value = r.data ?? []
  } catch {
    misProyectos.value = []
  } finally {
    loadingProyectos.value = false
  }
}

function switchSidebarMode(mode: 'chats' | 'proyectos') {
  sidebarMode.value = mode
  if (mode === 'proyectos' && misProyectos.value.length === 0) loadMisProyectos()
}

async function selectProyecto(p: any) {
  selectedProyecto.value = p
  proyectoParticipantes.value = []
  try {
    const r = await api.getParticipantes(p.id)
    proyectoParticipantes.value = r.data ?? []
  } catch (e: any) {
    error.value = e.message
  }
}

function participanteName(p: any): string {
  const name = [p.firstName, p.lastName].filter(Boolean).join(' ').trim()
  return name || p.username || p.email || p.userId
}

async function openParticipanteConv(userId: string) {
  if (!selectedProyecto.value) return
  try {
    const r = await api.openParticipanteChat(selectedProyecto.value.id, userId)
    if (!r.success || !r.data) throw new Error(r.error || 'No se pudo abrir el chat')
    await openConversation({ id: r.data.id, title: r.data.title, agentId: r.data.agentId, createdAt: '', updatedAt: '' })
  } catch (e: any) {
    error.value = e.message
  }
}

// ── Imágenes de tools MCP ──────────────────────────────────────────────
const lightboxImage = ref<string | null>(null)
const IMAGE_MARKER_RE = /\n?<!--am:images:([A-Za-z0-9+/=]+)-->\s*$/

/** Separa el marcador de imágenes del texto visible de un mensaje persistido. */
function parseImageMarker(content: string): { text: string; images: ChatImage[] } {
  const match = content.match(IMAGE_MARKER_RE)
  if (!match) return { text: content, images: [] }
  try {
    const json = decodeURIComponent(escape(atob(match[1])))
    const images = JSON.parse(json) as ChatImage[]
    return { text: content.slice(0, match.index).trimEnd(), images }
  } catch {
    return { text: content, images: [] }
  }
}

/** Genera una miniatura JPEG (ancho máx. 320px) a partir de un dataURL. */
function makeThumbnail(dataUrl: string, maxWidth = 320): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(dataUrl)
        return
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.7))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

/** Abre una imagen al hacer clic en su miniatura: usa el original en vivo o lo re-obtiene vía la tool. */
async function openImage(img: ChatImage) {
  if (img.full) {
    lightboxImage.value = img.full
    return
  }
  if (!img.serverId) {
    lightboxImage.value = img.thumb
    return
  }
  img.loading = true
  try {
    const res = await api.callMcpServerTool(img.serverId, img.toolName, img.args)
    const original = res.images?.[0]
    if (original) {
      img.full = `data:${original.mimeType};base64,${original.data}`
      lightboxImage.value = img.full
    } else {
      lightboxImage.value = img.thumb
    }
  } catch {
    lightboxImage.value = img.thumb
  } finally {
    img.loading = false
  }
}
const draft = ref<string | null>(null)

const selectedAgentId = ref('')
const newChatTitle = ref('')
const messageInput = ref('')
const sending = ref(false)
const distiState = ref<'loading' | 'thinking' | 'happy' | 'sad' | 'idle'>('idle')
const loadingConversation = ref(false)
const showNewChatModal = ref(false)
const loadingChatAgents = ref(false)
const error = ref('')
const hoveredMessageId = ref<string | null>(null)
const editingMessageId = ref<string | null>(null)
const editingContent = ref('')

type tasksStatus = 'pending' | 'in_progress' | 'completed' | 'failed'
const tasks = ref<{ chatId: string; id: string; name: string; description?: string; status: tasksStatus }[]>([])
const showTask = ref<boolean>(true)

const messagesContainer = ref<HTMLElement | null>(null)
let abortController: AbortController | null = null

const showTraceabilitySidebar = ref(false)
const hasLinkedTraceability = ref(false)

interface LinkedTraceability {
  id: string
  title: string
  createdBy: string | null
}
interface Participant {
  userId: string
  chatId: string | null
  hasRoleMatch?: boolean
}
interface TraceabilityInvitation {
  traceabilityId: string
  title: string
  description: string | null
  chatId: string | null
  agentId: string | null
  remainingStagesCount?: number
}
interface UserSummary {
  id: string
  username: string
  firstName?: string | null
  lastName?: string | null
}

const linkedTraceability = ref<LinkedTraceability | null>(null)
const participants = ref<Participant[]>([])
const invitations = ref<TraceabilityInvitation[]>([])
const allUsers = ref<UserSummary[]>([])
const showShareModal = ref(false)

interface ChatGroupInfo {
  traceabilityId: string
  title: string
  ownerUserId: string | null
  participants: Array<{ userId: string; chatId: string | null }>
  stageId: string | null
  stageName: string | null
  myEligibleStages: Array<{ stageId: string; stageName: string; chatId: string | null }>
}
const chatGroups = ref<Record<string, ChatGroupInfo>>({})

interface PendingStageSelection {
  traceabilityId: string
  title: string
  stages: Array<{ id: string; name: string; role: string | null; hasChat?: boolean }>
}
const pendingStageSelection = ref<PendingStageSelection | null>(null)
const switchingStage = ref(false)

// For each traceabilityId, remember which chatId the user last opened so the
// grouped sidebar entry picks that chat when re-clicked.
const lastOpenedChatByTraceability = ref<Record<string, string>>({})

interface SidebarEntry {
  kind: 'chat' | 'group'
  id: string // conversationId for 'chat'; traceabilityId for 'group'
  conversation: Conversation
  groupChats?: Conversation[] // populated for 'group'
}

const sidebarEntries = computed<SidebarEntry[]>(() => {
  const entries: SidebarEntry[] = []
  const groupBuckets = new Map<string, Conversation[]>()
  const seenGroupOrder: string[] = []
  for (const conv of conversations.value) {
    const grp = chatGroups.value[conv.id]
    if (grp) {
      const tid = grp.traceabilityId
      if (!groupBuckets.has(tid)) {
        groupBuckets.set(tid, [])
        seenGroupOrder.push(tid)
      }
      groupBuckets.get(tid)!.push(conv)
    } else {
      entries.push({ kind: 'chat', id: conv.id, conversation: conv })
    }
  }
  // Insert group entries in the order they first appeared
  for (const tid of seenGroupOrder) {
    const chats = groupBuckets.get(tid)!
    const preferredId = lastOpenedChatByTraceability.value[tid]
    const active =
      activeConversation.value && chatGroups.value[activeConversation.value.id]?.traceabilityId === tid ? activeConversation.value : null
    const representative = active ?? chats.find((c) => c.id === preferredId) ?? chats[0]
    entries.push({ kind: 'group', id: tid, conversation: representative, groupChats: chats })
  }
  return entries
})

function entryGroupInfo(entry: SidebarEntry) {
  return chatGroups.value[entry.conversation.id] ?? null
}

function isEntryActive(entry: SidebarEntry): boolean {
  if (!activeConversation.value) return false
  if (entry.kind === 'chat') return activeConversation.value.id === entry.conversation.id
  return entry.groupChats?.some((c) => c.id === activeConversation.value!.id) ?? false
}

async function openEntry(entry: SidebarEntry) {
  if (entry.kind === 'chat') {
    await openConversation(entry.conversation)
    return
  }
  const tid = entry.id
  const preferredId = lastOpenedChatByTraceability.value[tid]
  const target = entry.groupChats?.find((c) => c.id === preferredId) ?? entry.conversation
  await openConversation(target)
}

const groupPalette = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#a855f7', '#ef4444', '#22c55e']
function groupColor(traceabilityId: string): string {
  let h = 0
  for (let i = 0; i < traceabilityId.length; i++) h = (h * 31 + traceabilityId.charCodeAt(i)) >>> 0
  return groupPalette[h % groupPalette.length]
}

const canShareTraceability = computed(() => {
  if (!linkedTraceability.value) return false
  if (auth.hasPermission('traceability', 'update')) return true
  return auth.user?.id === linkedTraceability.value.createdBy
})

function userInitials(userId: string): string {
  const u = allUsers.value.find((x) => x.id === userId)
  const name = u ? [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username : userId
  const parts = name.trim().split(/\s+/)
  const a = parts[0]?.[0] ?? '?'
  const b = parts[1]?.[0] ?? ''
  return (a + b).toUpperCase()
}

function userDisplayName(userId: string): string {
  const u = allUsers.value.find((x) => x.id === userId)
  if (!u) return userId
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username
}

// Form state keyed by message id
const formAnswers = ref<Record<string, Record<string, { textValue: string; selectedOptions: any[] }>>>({})
const submittedForms = ref<string[]>([])

const activeAgent = computed(() => agents.value.find((a) => a.id === activeConversation.value?.agentId))

const visibleTasks = computed(() => tasks.value.filter((t) => t.chatId === activeConversation.value?.id))

async function fetchInitialData() {
  try {
    const [agentsRes, convRes, usersRes, invitationsRes] = await Promise.all([
      api.getAgents(),
      api.getConversations(),
      api.getUsers().catch(() => ({ data: [] }) as any),
      api.listTraceabilityInvitations().catch(() => ({ data: [] }) as any)
    ])
    agents.value = (agentsRes.data ?? []).filter((a: Agent) => a.isActive)
    conversations.value = convRes.data ?? []
    const usersData: any = Array.isArray(usersRes) ? usersRes : (usersRes?.data ?? [])
    allUsers.value = usersData as UserSummary[]
    const invData: any = (invitationsRes as any)?.data ?? []
    invitations.value = (invData as TraceabilityInvitation[]).filter((i) => (i.remainingStagesCount ?? (i.chatId ? 0 : 1)) > 0)
    await refreshChatGroups()
  } catch (e: any) {
    error.value = e.message
  }
}

async function refreshChatGroups() {
  try {
    const res = await api.getTraceabilityGroupsForUser()
    chatGroups.value = res?.data ?? {}
  } catch {
    chatGroups.value = {}
  }
}

async function openInvitation(inv: TraceabilityInvitation, stageId?: string | null) {
  try {
    const res: any = await api.openTraceabilityInvitation(inv.traceabilityId, stageId ?? null)
    if (!res?.success) {
      error.value = res?.error || 'No se pudo abrir la trazabilidad compartida'
      return
    }
    if (res.requireStageSelection) {
      pendingStageSelection.value = {
        traceabilityId: inv.traceabilityId,
        title: inv.title,
        stages: res.stages ?? []
      }
      return
    }
    if (!res?.data?.id) {
      error.value = 'Respuesta inválida del servidor'
      return
    }
    const conv: any = res.data
    if (!conversations.value.find((c) => c.id === conv.id)) {
      conversations.value.unshift(conv)
    }
    // Only remove the invitation entry once the user no longer has remaining stages to open
    if (stageId) {
      const remaining = (res.stages ?? []).some((s: any) => !s.hasChat && s.id !== stageId)
      if (!remaining) {
        invitations.value = invitations.value.filter((i) => i.traceabilityId !== inv.traceabilityId)
      }
    } else {
      invitations.value = invitations.value.filter((i) => i.traceabilityId !== inv.traceabilityId)
    }
    await openConversation(conv)
    await refreshChatGroups()
  } catch (e: any) {
    error.value = e.message
  }
}

async function pickStageFromModal(stageId: string) {
  if (!pendingStageSelection.value) return
  const pending = pendingStageSelection.value
  try {
    const res: any = await api.openTraceabilityInvitation(pending.traceabilityId, stageId)
    if (!res?.success || !res?.data?.id) {
      error.value = res?.error || 'No se pudo abrir el chat del stage'
      return
    }
    const conv: any = res.data
    if (!conversations.value.find((c) => c.id === conv.id)) {
      conversations.value.unshift(conv)
    }
    // Mark this stage as having a chat in the modal so the user can keep opening others
    pendingStageSelection.value = {
      ...pending,
      stages: pending.stages.map((s) => (s.id === stageId ? { ...s, hasChat: true } : s))
    }
    await openConversation(conv)
    await refreshChatGroups()
    // If no remaining stages to open, close the modal and remove invitation
    const remaining = pendingStageSelection.value.stages.some((s) => !s.hasChat)
    if (!remaining) {
      invitations.value = invitations.value.filter((i) => i.traceabilityId !== pending.traceabilityId)
      pendingStageSelection.value = null
    }
  } catch (e: any) {
    error.value = e.message
  }
}

async function switchStage(targetStageId: string) {
  if (!activeConversation.value) return
  const group = chatGroups.value[activeConversation.value.id]
  if (!group) return
  if (targetStageId === group.stageId) return
  const target = group.myEligibleStages.find((s) => s.stageId === targetStageId)
  if (!target) return
  switchingStage.value = true
  try {
    if (target.chatId) {
      const conv = conversations.value.find((c) => c.id === target.chatId)
      if (conv) await openConversation(conv)
      else {
        // chat exists in DB but not in our local list — refresh and retry
        const res = await api.getConversations()
        conversations.value = res.data ?? []
        const fresh = conversations.value.find((c) => c.id === target.chatId)
        if (fresh) await openConversation(fresh)
      }
    } else {
      const res: any = await api.openTraceabilityInvitation(group.traceabilityId, targetStageId)
      if (!res?.success || !res?.data?.id) {
        error.value = res?.error || 'No se pudo abrir el chat del stage'
        return
      }
      const conv: any = res.data
      if (!conversations.value.find((c) => c.id === conv.id)) {
        conversations.value.unshift(conv)
      }
      await openConversation(conv)
    }
    await refreshChatGroups()
  } catch (e: any) {
    error.value = e.message
  } finally {
    switchingStage.value = false
  }
}

async function fetchParticipants(traceabilityId: string) {
  try {
    const res = await api.listTraceabilityParticipants(traceabilityId)
    participants.value = (res.data ?? []) as Participant[]
  } catch {
    participants.value = []
  }
}

async function onShareSaved() {
  if (linkedTraceability.value) await fetchParticipants(linkedTraceability.value.id)
  await refreshChatGroups()
}

async function removeParticipant(userId: string) {
  if (!linkedTraceability.value) return
  try {
    await api.removeTraceabilityParticipant(linkedTraceability.value.id, userId)
    participants.value = participants.value.filter((p) => p.userId !== userId)
    await refreshChatGroups()
  } catch (e: any) {
    error.value = e.message
  }
}

async function openNewChatModal() {
  showNewChatModal.value = true
  selectedAgentId.value = ''
  newChatTitle.value = ''
  loadingChatAgents.value = true
  try {
    const res = await api.getAgentsForChat()
    chatAgents.value = res.data ?? []
  } catch (e: any) {
    error.value = e.message
  } finally {
    loadingChatAgents.value = false
  }
}

async function openConversation(conv: Conversation) {
  loadingConversation.value = true
  try {
    const res = await api.getConversation(conv.id)
    activeConversation.value = res.data
    messages.value = (res.data.messages ?? []).map((m: DisplayMessage) => {
      if (m.role !== 'assistant' || !m.content.includes('<!--am:images:')) return m
      const { text, images } = parseImageMarker(m.content)
      return { ...m, content: text, images }
    })
    draft.value = res.data.draft ?? null
    initFormAnswersFromMessages()
    // Ocultar el loader antes de renderizar: la lista de mensajes (y los diagramas) solo
    // existe en el DOM cuando loadingConversation es false.
    loadingConversation.value = false
    await scrollToBottom()
    fetchHasLinkedTraceability(conv.id)
    const grp = chatGroups.value[conv.id]
    if (grp) lastOpenedChatByTraceability.value[grp.traceabilityId] = conv.id
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
    showNewChatModal.value = false
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
    createdAt: new Date().toISOString()
  }
  messages.value.push(userMsg)

  // Add empty streaming assistant message
  const streamingId = `stream-${Date.now()}`
  const assistantMsg: DisplayMessage = {
    id: streamingId,
    role: 'assistant',
    content: '',
    createdAt: new Date().toISOString(),
    streaming: true
  }
  messages.value.push(assistantMsg)
  await scrollToBottom()

  abortController = new AbortController()
  distiState.value = 'loading'

  try {
    let response: Response
    try {
      response = await api.streamMessage(activeConversation.value.id, content, abortController.signal)
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
        ; ({ done, value } = await reader.read())
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
        } else if (event.type === 'tool_image') {
          distiState.value = 'thinking'
          const idx = messages.value.findIndex((m) => m.id === streamingId)
          if (idx !== -1) {
            const full = `data:${event.mimeType};base64,${event.data}`
            const thumb = await makeThumbnail(full)
            const image: ChatImage = {
              serverId: event.serverId,
              toolName: event.toolName,
              args: event.args ?? {},
              mimeType: event.mimeType,
              thumb,
              full
            }
            const existing = messages.value[idx].images ?? []
            messages.value[idx] = { ...messages.value[idx], images: [...existing, image] }
            await followIfPinned()
          }
        } else if (event.type === 'done') {
          distiState.value = 'happy'
          const idx = messages.value.findIndex((m) => m.id === streamingId)
          if (idx !== -1) {
            const liveImages = messages.value[idx].images
            messages.value[idx] = {
              ...event.message,
              streaming: false,
              responseTime: event.responseTime,
              toolCalls: messages.value[idx].toolCalls,
              images: liveImages
            }
            // Persiste las miniaturas en el mensaje recién creado para que sobrevivan a recargas.
            if (liveImages?.length) {
              const payload = liveImages.map((im) => ({
                serverId: im.serverId,
                toolName: im.toolName,
                args: im.args,
                mimeType: im.mimeType,
                thumb: im.thumb
              }))
              api.attachMessageImages(event.message.id, payload).catch(() => { })
            }
          }
          setTimeout(() => {
            distiState.value = 'idle'
          }, 1200)
        } else if (event.type === 'task_create') {
          tasks.value.push({ ...event, chatId: activeConversation.value.id, status: 'pending' })
        } else if (event.type === 'task_update') {
          const task = tasks.value.filter((f) => f.id === event.id)
          if (!task || task.length === 0) throw new Error('No se encontro el task en el chat')
          task[0].status = event.status
        } else if (event.type === 'error') {
          throw new Error(event.error || 'El agente reportó un error inesperado.')
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

/** true mientras el scroll esté pegado al fondo: rige el auto-seguimiento durante el streaming. */
const isAtBottom = ref(true)

function updateIsAtBottom() {
  const el = messagesContainer.value
  if (!el) return
  isAtBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 80
}

/** Fuerza el scroll al fondo y reactiva el auto-seguimiento. */
async function scrollToBottom() {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
  isAtBottom.value = true
  void renderMermaidDiagrams()
}

/** Renderiza diagramas y solo sigue el texto al fondo si el usuario no se ha desplazado hacia arriba. */
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

// ── Request form helpers ──────────────────────────────────────────────────────

function parseRequestBlock(content: string): RequestQuestion[] | null {
  const match = content.match(/```request\n([\s\S]*?)```/)
  if (!match) return null

  const questions: RequestQuestion[] = []
  const parts = match[1].split(/(?=\[Q\d+\|)/)

  for (const part of parts) {
    const header = part.match(/^\[Q(\d+)\|(text|multi|list|single|confirm|setCredential)\]\s*(.+?)(?:\n|$)/)
    if (!header) continue

    const rest = part.slice(header[0].length).trim()
    const lines = rest.split('\n')
    const options: Array<{ label: string; description: string }> = []
    const descLines: string[] = []

    for (const line of lines) {
      // La linea puede estar separada por titulo | descripcion o solo tener texto (descripcion)
      const opt = line.match(/^-\s*(.+?)\s*\|\s*(.+)$/)
      if (opt) {
        options.push({ label: opt[1].trim(), description: opt[2].trim() })
      } else if (line.startsWith('-') && line.trim() !== '-') {
        const label = line.replace(/^-\s*/, '').trim()
        options.push({ label, description: '' })
      } else if (line.trim()) descLines.push(line.trim())
    }

    questions.push({
      id: `Q${header[1]}`,
      type: header[2] as 'text' | 'multi' | 'list' | 'single' | 'confirm' | 'setCredential',
      label: header[3].trim(),
      description: descLines.join('\n'),
      options
    })
  }

  return questions.length > 0 ? questions : null
}

function getContentBeforeRequest(content: string): string {
  const idx = content.indexOf('```request')
  return idx > 0 ? content.slice(0, idx).trim() : ''
}

function getContentAfterRequest(content: string): string {
  const match = content.match(/```request[\s\S]*?```/)
  if (!match || match.index === undefined) return ''
  const endIdx = match.index + match[0].length
  return content.slice(endIdx).trim()
}

function getRequestQuestions(msg: DisplayMessage): RequestQuestion[] | null {
  if (msg.role !== 'assistant' || msg.streaming) return null
  return parseRequestBlock(msg.content)
}

function renderInlineMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^#{1,6}\s+(.+?)\s*$/gm, '<strong>$1</strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

function renderMarkdown(text: string): string {
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
        // Bloque mermaid completo (con cierre ```): emitir placeholder a renderizar tras el montaje
        out.push(`<div class="mermaid-block" data-mermaid="${encodeURIComponent(diagram.join('\n'))}"></div>`)
        i = j + 1
        continue
      }
      // Bloque aún sin cerrar (streaming): se renderiza como texto hasta que llegue el cierre
    }
    if (/^```/.test(lines[i].trim())) {
      const lang = lines[i].trim().slice(3).trim()
      const code: string[] = []
      let j = i + 1
      while (j < lines.length && lines[j].trim() !== '```') {
        code.push(lines[j++])
      }
      if (j < lines.length) {
        const escaped = code.join('\n').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        const label = lang
          ? `<span style="position:absolute;top:6px;right:10px;font-size:0.7em;color:#94a3b8;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:lowercase">${lang.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`
          : ''
        out.push(
          `<pre style="position:relative;background:#0f172a;color:#e2e8f0;padding:12px;${lang ? 'padding-top:16px;' : ''}border-radius:8px;overflow:auto;margin:8px 0;font-size:0.85em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${label}<code>${escaped}</code></pre>`
        )
        i = j + 1
        continue
      }
      // Bloque aún sin cerrar (streaming): se renderiza como texto hasta que llegue el cierre
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

function listItemChanged(opt: { label: string; description: string }, e: Event, msgId: string, questionId: string, key: string) {
  opt.description = (e.target as HTMLInputElement).value
  if (Number(key) === formAnswers.value[msgId]?.[questionId].selectedOptions.length - 1) {
    formAnswers.value[msgId][questionId].selectedOptions.push({ label: '', description: '' })
  }
}

function removeOption(msgId: string, questionId: string, key: string) {
  const q = formAnswers.value[msgId]?.[questionId]
  if (!q) return
  q.selectedOptions.splice(Number(key), 1)
}

function initFormAnswersFromMessages() {
  for (let i = 0; i < messages.value.length; i++) {
    const msg = messages.value[i]
    if (msg.role !== 'assistant' || msg.streaming) continue
    const questions = parseRequestBlock(msg.content)
    if (!questions) continue

    if (!formAnswers.value[msg.id]) {
      const answers: Record<string, { textValue: string; selectedOptions: string[] }> = {}
      for (const q of questions) {
        const data = []
        if (q.type === 'list') data.push({ label: '(sin selección)', description: '' })
        answers[q.id] = { textValue: '', selectedOptions: data }
      }
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
    } else if (q.type === 'list') {
      const parts = [...a.selectedOptions.map((o) => `- ${o.description}`)]
      if (a.textValue.trim()) parts.push(a.textValue.trim())
      answerText = parts.length > 0 ? parts.join('\n ') : '(sin selección)'
    } else if (q.type === 'confirm') {
      answerText = a.selectedOptions[0] ?? (a.textValue.trim() || '(sin selección)')
      if (a.textValue.trim() && a.textValue.trim() !== answerText) answerText += ` (${a.textValue.trim()})`
    } else if (q.type === 'setCredential') {
      answerText = 'Se establecieron las credenciales'
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

async function retryMessage(msg: DisplayMessage) {
  if (!activeConversation.value || sending.value) return
  const idx = messages.value.findIndex((m) => m.id === msg.id)
  if (idx === -1) return

  // Find the preceding user message to delete from there (inclusive)
  let userIdx = -1
  let userContent = ''
  for (let i = idx - 1; i >= 0; i--) {
    if (messages.value[i].role === 'user') {
      userIdx = i
      userContent = messages.value[i].content
      break
    }
  }
  if (userIdx === -1) return

  // Delete from the user message onwards so sendMessage can re-add it without duplicar
  try {
    await api.deleteMessagesFrom(activeConversation.value.id, messages.value[userIdx].id)
  } catch (e: any) {
    error.value = e.message
    return
  }

  messages.value = messages.value.slice(0, userIdx)
  messageInput.value = userContent
  await sendMessage()
}

function editMessage(msg: DisplayMessage) {
  if (sending.value) return
  editingMessageId.value = msg.id
  editingContent.value = msg.content
}

function cancelEdit() {
  editingMessageId.value = null
  editingContent.value = ''
}

async function confirmEdit(msg: DisplayMessage) {
  if (!activeConversation.value || sending.value) return
  const content = editingContent.value.trim()
  if (!content) return

  const idx = messages.value.findIndex((m) => m.id === msg.id)
  if (idx === -1) return

  try {
    await api.deleteMessagesFrom(activeConversation.value.id, msg.id)
  } catch (e: any) {
    error.value = e.message
    return
  }

  editingMessageId.value = null
  editingContent.value = ''
  messages.value = messages.value.slice(0, idx)
  messageInput.value = content
  await sendMessage()
}

// ── Credential modal ─────────────────────────────────────────────────────────

const showCredentialModal = ref(false)
const credentialServers = ref<McpServer[]>([])

async function openCredentialModal() {
  try {
    const res = await api.getMcpServers()
    credentialServers.value = (res.data ?? []).filter((s: McpServer) => s.active)
  } catch {
    credentialServers.value = []
  }
  showCredentialModal.value = true
}

watch(messages, initFormAnswersFromMessages, { deep: true })
watch(
  messages,
  () => {
    void renderMermaidDiagrams()
  },
  { deep: true }
)

async function fetchHasLinkedTraceability(conversationId: string) {
  hasLinkedTraceability.value = false
  showTraceabilitySidebar.value = false
  linkedTraceability.value = null
  participants.value = []
  try {
    const res = await api.getTraceabilityByConversation(conversationId)
    const list: any[] = Array.isArray(res.data) ? res.data : []
    hasLinkedTraceability.value = list.length > 0
    if (hasLinkedTraceability.value) {
      showTraceabilitySidebar.value = true
      const t = list[0]
      linkedTraceability.value = { id: t.id, title: t.title, createdBy: t.createdBy ?? null }
      await fetchParticipants(t.id)
    }
  } catch {
    hasLinkedTraceability.value = false
  }
}

onMounted(fetchInitialData)
</script>

<template>
  <div class="flex h-full overflow-hidden">

    <!-- Sidebar: conversation list -->
    <div class="w-52 shrink-0 flex flex-col border-r border-base-300 bg-base-100">
      <div class="flex border-b border-base-300">
        <button class="flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors"
          :class="sidebarMode === 'chats' ? 'border-primary text-primary' : 'border-transparent text-base-content/50 hover:text-base-content'"
          @click="switchSidebarMode('chats')">
          <i class="mdi mdi-chat" /> Chats
        </button>
        <button class="flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors"
          :class="sidebarMode === 'proyectos' ? 'border-primary text-primary' : 'border-transparent text-base-content/50 hover:text-base-content'"
          @click="switchSidebarMode('proyectos')">
          <i class="mdi mdi-folder-multiple" /> Proyectos
        </button>
      </div>
      <div v-if="sidebarMode === 'chats'" class="px-4 py-4 border-b border-base-300 flex items-center justify-between">
        <button class="btn btn-info btn-outline btn-sm" @click="openNewChatModal">
          + Nuevo Chat
        </button>
      </div>

      <!-- Projects mode -->
      <div v-if="sidebarMode === 'proyectos'" class="flex-1 overflow-y-auto">
        <div v-if="loadingProyectos" class="flex justify-center py-8">
          <span class="loading loading-spinner loading-sm text-primary" />
        </div>
        <div v-else-if="misProyectos.length === 0" class="px-4 py-8 text-center text-base-content/50 text-sm">
          No participas en proyectos
        </div>
        <template v-else>
          <div v-for="p in misProyectos" :key="p.id" class="border-b border-base-300/60">
            <button class="w-full text-left px-4 py-3 hover:bg-base-200/50 transition-colors"
              :class="selectedProyecto?.id === p.id ? 'bg-base-200' : ''" @click="selectProyecto(p)">
              <p class="text-sm font-medium text-base-content truncate">{{ p.name }}</p>
              <p v-if="p.programmingLanguage" class="text-xs text-base-content/50 truncate">{{ p.programmingLanguage }}
              </p>
            </button>
            <!-- Participantes del proyecto seleccionado -->
            <div v-if="selectedProyecto?.id === p.id" class="pb-2">
              <div class="px-4 py-1 text-[11px] uppercase tracking-wider text-base-content/40">Interesados</div>
              <p v-if="proyectoParticipantes.length === 0" class="px-4 py-2 text-xs text-base-content/50">
                Sin interesados. Agrégalos en el detalle del proyecto.
              </p>
              <button v-for="part in proyectoParticipantes" :key="part.id"
                class="w-full flex items-center gap-2 px-4 py-2 hover:bg-primary/5 transition-colors text-left"
                @click="openParticipanteConv(part.userId)">
                <span
                  class="w-6 h-6 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                  {{ (participanteName(part)[0] || '?').toUpperCase() }}
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block text-xs font-medium text-base-content truncate">{{ participanteName(part) }}</span>
                  <span v-if="part.role" class="block text-[10px] text-base-content/50 truncate">{{ part.role }}</span>
                </span>
              </button>
            </div>
          </div>
        </template>
      </div>

      <!-- Conversation list -->
      <div v-else class="flex-1 overflow-y-auto">
        <!-- Traceability invitations -->
        <div v-if="invitations.length > 0" class="border-b border-base-300">
          <div
            class="px-4 py-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-400">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            Trazabilidades disponibles
          </div>
          <button v-for="inv in invitations" :key="inv.traceabilityId"
            class="w-full text-left px-4 py-3 border-t border-base-300/60 hover:bg-amber-500/5 transition-colors"
            @click="openInvitation(inv)" :title="inv.description || 'Iniciar chat para esta trazabilidad'">
            <div class="flex items-start gap-2">
              <span class="mt-0.5 mdi mdi-clipboard-text-outline text-amber-400 shrink-0"></span>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-base-content truncate">{{ inv.title }}</p>
                <p class="text-xs text-amber-400/80 truncate">Iniciar chat</p>
              </div>
            </div>
          </button>
        </div>

        <div v-if="sidebarEntries.length === 0 && invitations.length === 0"
          class="px-4 py-8 text-center text-base-content/50 text-sm">
          Sin conversaciones
        </div>
        <button v-for="entry in sidebarEntries" :key="entry.kind + ':' + entry.id"
          class="w-full text-left px-4 py-3 border-b border-base-300/60 hover:bg-base-200/50 transition-colors group relative"
          :class="[
            isEntryActive(entry) ? 'bg-base-200' : '',
            entryGroupInfo(entry) ? 'pl-5' : ''
          ]" @click="openEntry(entry)">
          <span v-if="entryGroupInfo(entry)" class="absolute left-0 top-0 bottom-0 w-1"
            :style="{ backgroundColor: groupColor(entryGroupInfo(entry)!.traceabilityId) }"
            :title="`Trazabilidad: ${entryGroupInfo(entry)!.title}`"></span>
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0 flex-1 pr-2">
              <div class="flex items-center gap-1.5">
                <span v-if="entryGroupInfo(entry)" class="mdi mdi-clipboard-text-outline text-[13px] shrink-0"
                  :style="{ color: groupColor(entryGroupInfo(entry)!.traceabilityId) }"
                  :title="`Trazabilidad: ${entryGroupInfo(entry)!.title}`"></span>
                <p class="text-sm font-medium text-base-content truncate">
                  {{ entry.kind === 'group' ? entryGroupInfo(entry)!.title : entry.conversation.title }}
                </p>
                <span v-if="entry.kind === 'group' && (entry.groupChats?.length ?? 0) > 1"
                  class="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-base-100 text-base-content font-medium"
                  :title="`${entry.groupChats!.length} chats (uno por stage)`">
                  {{ entry.groupChats!.length }}
                </span>
              </div>
              <div class="flex items-center gap-2 mt-0.5">
                <p class="text-xs text-indigo-400 truncate"
                  :title="agentsMap.get(entry.conversation.agentId) || entry.conversation.agentId">
                  {{ agentsMap.get(entry.conversation.agentId) || 'Agente' }}
                </p>
                <span v-if="entryGroupInfo(entry)?.stageName"
                  class="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0" :style="{
                    backgroundColor: groupColor(entryGroupInfo(entry)!.traceabilityId) + '22',
                    color: groupColor(entryGroupInfo(entry)!.traceabilityId)
                  }" :title="`Stage: ${entryGroupInfo(entry)!.stageName}`">
                  {{ entryGroupInfo(entry)!.stageName }}
                </span>
              </div>
              <div v-if="entryGroupInfo(entry)" class="flex items-center gap-1 mt-1.5">
                <div class="flex items-center">
                  <span v-if="entryGroupInfo(entry)!.ownerUserId"
                    class="w-5 h-5 -ml-1 first:ml-0 rounded-full ring-2 ring-base-100 flex items-center justify-center text-[9px] font-bold text-base-content"
                    :style="{ backgroundColor: groupColor(entryGroupInfo(entry)!.traceabilityId) }"
                    :title="`${userDisplayName(entryGroupInfo(entry)!.ownerUserId!)} (propietario)`">
                    {{ userInitials(entryGroupInfo(entry)!.ownerUserId!) }}
                  </span>
                  <span v-for="p in entryGroupInfo(entry)!.participants.slice(0, 4)" :key="p.userId"
                    class="w-5 h-5 -ml-1 rounded-full bg-base-100 ring-2 ring-base-100 flex items-center justify-center text-[9px] font-bold text-base-content"
                    :title="userDisplayName(p.userId)">
                    {{ userInitials(p.userId) }}
                  </span>
                  <span v-if="entryGroupInfo(entry)!.participants.length > 4"
                    class="w-5 h-5 -ml-1 rounded-full bg-base-100 ring-2 ring-base-100 flex items-center justify-center text-[9px] font-bold text-base-content">
                    +{{ entryGroupInfo(entry)!.participants.length - 4 }}
                  </span>
                </div>
              </div>
            </div>
            <button v-if="entry.kind === 'chat'"
              class="shrink-0 opacity-0 group-hover:opacity-100 text-base-content/50 hover:text-red-400 transition-all"
              title="Eliminar" @click.stop="deleteConversation(entry.conversation)">
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
      <div class="px-6 py-4 border-b border-base-300 flex items-center gap-3">
        <template v-if="activeConversation">
          <div class="w-8 h-8 rounded-lg bg-cyan-600/20 flex items-center justify-center shrink-0">
            <svg class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <p class="text-sm font-semibold text-base-content truncate">{{ activeConversation.title }}</p>
              <select v-if="(chatGroups[activeConversation.id]?.myEligibleStages?.length ?? 0) > 1"
                :value="chatGroups[activeConversation.id].stageId ?? ''"
                @change="(e) => switchStage((e.target as HTMLSelectElement).value)" :disabled="switchingStage"
                class="text-xs bg-base-200 border border-base-300 rounded px-2 py-1 text-base-content focus:outline-none focus:border-indigo-500"
                :title="'Cambiar de stage'">
                <option v-if="!chatGroups[activeConversation.id].stageId" value="" disabled>Selecciona stage…</option>
                <option v-for="s in chatGroups[activeConversation.id].myEligibleStages" :key="s.stageId"
                  :value="s.stageId">
                  {{ s.stageName }}{{ s.chatId ? '' : ' · nuevo' }}
                </option>
              </select>
            </div>
            <p class="text-xs text-base-content/60">Agente: {{ activeAgent?.name ?? activeConversation.agentId }}</p>
          </div>
          <!-- Participants strip (when traceability is linked) -->
          <div v-if="hasLinkedTraceability && linkedTraceability" class="flex items-center gap-1 shrink-0">
            <div v-for="p in participants" :key="p.userId"
              class="w-7 h-7 -ml-1 first:ml-0 rounded-full bg-base-100 ring-2 ring-base-100 flex items-center justify-center text-[10px] font-bold text-base-content group relative"
              :title="`${userDisplayName(p.userId)} — ${p.hasRoleMatch ? 'rol coincide con la trazabilidad' : 'sin coincidencia de rol con la trazabilidad'}`">
              {{ userInitials(p.userId) }}
              <span
                class="absolute -bottom-0 -right-0 w-1.5 h-1.5 rounded-full ring-2 ring-base-100 pointer-events-none"
                :class="p.hasRoleMatch ? 'bg-emerald-500' : 'bg-red-500'"></span>
              <button v-if="canShareTraceability" @click.stop="removeParticipant(p.userId)"
                class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-600 hover:bg-red-500 text-white text-[9px] leading-none opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                title="Quitar acceso">×</button>
            </div>
            <button v-if="canShareTraceability" @click="showShareModal = true"
              class="ml-1 w-7 h-7 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition-colors"
              title="Compartir trazabilidad">
              <span class="mdi mdi-plus text-base"></span>
            </button>
          </div>
          <!-- Traceability sidebar toggle -->
          <button v-if="hasLinkedTraceability" @click="showTraceabilitySidebar = !showTraceabilitySidebar"
            class="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            :class="showTraceabilitySidebar ? 'bg-indigo-600 text-white' : 'bg-base-200 text-base-content/60 hover:text-white hover:bg-base-100'"
            title="Ver trazabilidad vinculada">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            Trazabilidad
          </button>
        </template>
        <template v-else>
          <div class="w-8 h-8 rounded-lg bg-base-200 flex items-center justify-center shrink-0">
            <svg class="w-4 h-4 text-base-content/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p class="text-sm text-base-content/60">Selecciona o crea una conversación</p>
        </template>
      </div>

      <!-- Messages -->
      <div ref="messagesContainer" @scroll="updateIsAtBottom"
        class="flex-1 overflow-y-auto px-6 py-4 space-y-4 relative">

        <!-- Empty state -->
        <div v-if="!activeConversation" class="h-full flex flex-col items-center justify-center text-center">
          <div class="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-4">
            <svg class="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p class="text-base-content font-semibold mb-1">Chatea con un agente</p>
          <p class="text-base-content/50 text-sm max-w-xs">
            Crea una nueva conversación y selecciona el agente con el que deseas interactuar.
          </p>
        </div>

        <div v-else-if="loadingConversation" class="flex items-center justify-center py-12">
          <div class="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        </div>

        <template v-else>
          <div v-if="messages.length === 0" class="text-center py-12 text-base-content/50 text-sm">
            Sin mensajes aún. ¡Escribe algo para comenzar!
          </div>

          <div v-for="msg in messages" :key="msg.id" class="flex gap-3"
            :class="msg.role === 'user' ? 'flex-row-reverse' : ''" @mouseenter="hoveredMessageId = msg.id"
            @mouseleave="hoveredMessageId = null">
            <!-- Avatar -->
            <div class="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
              :class="msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-base-100 text-base-content'">
              {{ msg.role === 'user' ? 'U' : 'A' }}
            </div>

            <!-- Bubble + metadata -->
            <div class="flex flex-col gap-1"
              :class="getRequestQuestions(msg) && !submittedForms.includes(msg.id) ? 'max-w-[88%]' : 'max-w-[80%]'"
              :style="msg.role === 'user' ? 'align-items:flex-end' : ''">

              <!-- ── Bubble ─────────────────────────────────── -->
              <div class="rounded-2xl text-sm leading-relaxed" :class="[
                editingMessageId === msg.id ? 'p-0 w-120' : 'px-4 py-2.5',
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-sm'
                  : 'bg-base-100 text-base-content rounded-tl-sm border border-base-300'
              ]">

                <!-- Tool calls — shown before the text content -->
                <div v-if="msg.toolCalls?.length" class="flex flex-wrap gap-1.5 mb-2">
                  <span v-for="tool in msg.toolCalls" :key="tool"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-base-100/60 text-base-content/50 text-xs font-mono">
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
                  <p v-if="getContentBeforeRequest(msg.content)" class="whitespace-pre-wrap mb-3 text-base-content"
                    v-html="renderMarkdown(getContentBeforeRequest(msg.content))" />

                  <div class="space-y-4 border border-base-content/20/40 rounded-xl p-4 bg-base-300/60">
                    <p class="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Completa el formulario
                    </p>

                    <div v-for="q in getRequestQuestions(msg)" :key="q.id" class="space-y-2">
                      <!-- Question label + description -->
                      <div>
                        <p class="text-sm font-medium text-base-content" v-html="renderInlineMarkdown(q.label)" />
                        <p v-if="q.description" class="text-xs text-base-content/50 mt-0.5 whitespace-pre-wrap"
                          v-html="renderInlineMarkdown(q.description)" />
                      </div>

                      <!-- Multi: predefined options (checkboxes) -->
                      <div v-if="q.type === 'multi' && q.options.length" class="space-y-1.5 pl-0.5">
                        <label v-for="opt in q.options" :key="opt.label"
                          class="flex items-start gap-2.5 cursor-pointer select-none">
                          <input type="checkbox"
                            :checked="formAnswers[msg.id][q.id].selectedOptions.includes(opt.label)"
                            @change="toggleOption(msg.id, q.id, opt.label)"
                            class="mt-0.5 shrink-0 rounded border-base-content/20 bg-base-200 accent-indigo-500 cursor-pointer" />
                          <span class="text-sm text-base-content leading-snug">
                            {{ opt.label }}
                            <span v-if="opt.description" class="text-base-content"> — {{ opt.description }}</span>
                          </span>
                        </label>
                      </div>

                      <!-- List: options as clickable buttons -->
                      <div v-if="q.type === 'list'" class="flex flex-wrap gap-2">
                        <div v-for="[key, opt] of Object.entries(formAnswers[msg.id][q.id].selectedOptions)"
                          :key="`list_${key}`" class="w-full">

                          <div class="flex w-full">
                            <input type="text" :value="opt.description"
                              @input="(e) => listItemChanged(opt, e, msg.id, q.id, key)"
                              class="w-full px-3 py-2 rounded-lg bg-base-200 border border-base-300 text-sm text-base-content placeholder:text-base-content/40 focus:outline-none focus:border-indigo-500 transition-colors" />
                            <div v-if="opt.description !== ''" class="w-12 btn btn-ghost btn-error"
                              @click="removeOption(msg.id, q.id, key)">
                              <span class="mdi mdi-close"></span>
                            </div>
                            <div v-else-if="formAnswers[msg.id][q.id].selectedOptions.length > 1" class="w-12">

                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- Boton para establecer credenciales -->
                      <button v-if="q.type === 'setCredential'" type="button" @click="openCredentialModal"
                        class="btn bg-indigo-600 hover:bg-indigo-500/60  text-white mb-5">
                        Establecer credenciales <span class="mdi mdi-key-chain-variant"></span>
                      </button>

                      <!-- Confirm: options as clickable buttons -->
                      <div v-if="q.type === 'confirm' && q.options.length" class="flex flex-wrap gap-2">
                        <button v-for="opt in q.options" :key="opt.label" type="button"
                          @click="selectOption(msg.id, q.id, opt.label)" :title="opt.description || undefined"
                          :class="formAnswers[msg.id][q.id].selectedOptions[0] === opt.label
                            ? 'bg-indigo-600 border-indigo-500 text-white'
                            : 'bg-base-200 border-base-content/20 text-base-content hover:border-indigo-500/60 hover:text-base-content'"
                          class="px-4 py-1.5 rounded-lg border text-sm font-medium transition-colors">
                          {{ opt.label }}
                        </button>
                      </div>

                      <!-- Select: predefined options (radio buttons, single choice) -->
                      <div v-if="q.type === 'single' && q.options.length" class="space-y-1.5 pl-0.5">
                        <label v-for="opt in q.options" :key="opt.label"
                          class="flex items-start gap-2.5 cursor-pointer select-none">
                          <input type="radio" :name="`${msg.id}-${q.id}`" :value="opt.label"
                            :checked="formAnswers[msg.id][q.id].selectedOptions[0] === opt.label"
                            @change="selectOption(msg.id, q.id, opt.label)"
                            class="mt-0.5 shrink-0 border-base-content/20 bg-base-200 accent-indigo-500 cursor-pointer" />
                          <span class="text-sm text-base-content leading-snug">
                            {{ opt.label }}
                            <span v-if="opt.description" class="text-base-content"> — {{ opt.description }}</span>
                          </span>
                        </label>
                      </div>

                      <!-- Text input (always shown) -->
                      <input v-if="q.type !== 'list' && q.type !== 'setCredential'"
                        :value="formAnswers[msg.id][q.id].textValue"
                        @input="(e) => (formAnswers[msg.id][q.id].textValue = (e.target as HTMLInputElement).value)"
                        type="text" :placeholder="q.type === 'multi' || q.type === 'single' || q.type === 'confirm'
                          ? 'Otra respuesta (opcional)...'
                          : (q.description ? q.description.split('\n')[0] : 'Tu respuesta...')"
                        class="w-full px-3 py-2 rounded-lg bg-base-200 border border-base-300 text-sm text-base-content placeholder:text-base-content/40 focus:outline-none focus:border-indigo-500 transition-colors" />
                    </div>

                    <button @click="submitRequestForm(msg.id, getRequestQuestions(msg)!)"
                      :disabled="sending || !activeConversation"
                      class="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
                      Enviar respuestas
                    </button>
                  </div>
                  <p v-if="getContentAfterRequest(msg.content)" class="whitespace-pre-wrap mt-3 text-base-content"
                    v-html="renderMarkdown(getContentAfterRequest(msg.content))" />
                </template>

                <!-- ── Submitted form notice ── -->
                <template v-else-if="getRequestQuestions(msg)">
                  <p v-if="getContentBeforeRequest(msg.content)" class="whitespace-pre-wrap mb-2 text-base-content"
                    v-html="renderMarkdown(getContentBeforeRequest(msg.content))" />
                  <span class="inline-flex items-center gap-1.5 text-xs text-base-content/50">
                    <svg class="w-3.5 h-3.5 text-green-400 shrink-0" fill="none" stroke="currentColor"
                      viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                    Formulario enviado
                  </span>
                  <p v-if="getContentAfterRequest(msg.content)" class="whitespace-pre-wrap mt-2 text-base-content"
                    v-html="renderMarkdown(getContentAfterRequest(msg.content))" />
                </template>

                <!-- ── Inline edit mode (user messages only) ── -->
                <template v-else-if="editingMessageId === msg.id">
                  <div class="flex flex-col gap-2 p-2">
                    <textarea v-model="editingContent" rows="3"
                      class="w-full resize-none rounded-xl bg-indigo-700/60 border border-indigo-400/60 text-white text-sm px-3 py-2 placeholder-indigo-300 focus:outline-none focus:border-indigo-300 transition-colors min-w-[220px]"
                      @keydown.enter.exact.prevent="confirmEdit(msg)" @keydown.esc="cancelEdit" />
                    <div class="flex gap-2 justify-end">
                      <button @click="cancelEdit"
                        class="px-3 py-1 rounded-lg text-xs font-medium bg-indigo-700/60 hover:bg-indigo-700 text-indigo-200 transition-colors">
                        Cancelar
                      </button>
                      <button @click="confirmEdit(msg)" :disabled="!editingContent.trim()"
                        class="px-3 py-1 rounded-lg text-xs font-medium bg-white text-indigo-700 hover:bg-indigo-100 disabled:opacity-40 transition-colors">
                        Aceptar
                      </button>
                    </div>
                  </div>
                </template>

                <!-- ── Plain text content ── -->
                <template v-else>
                  <span class="whitespace-pre-wrap" v-html="renderMarkdown(msg.content)" />

                  <!-- Imágenes generadas por tools MCP -->
                  <div v-if="msg.images?.length" class="flex flex-wrap gap-2 mt-2">
                    <button v-for="(img, i) in msg.images" :key="i" type="button" @click="openImage(img)"
                      class="group relative rounded-lg overflow-hidden border border-base-content/15 hover:border-indigo-400 transition-colors"
                      :title="`Ver original (${img.toolName})`">
                      <img :src="img.thumb" alt="Imagen generada" class="block max-h-48 w-auto object-contain" />
                      <span v-if="img.loading"
                        class="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-xs">
                        Cargando original…
                      </span>
                      <span v-else
                        class="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                        Ver original
                      </span>
                    </button>
                  </div>
                </template>
              </div>

              <!-- Timestamp + response time + action buttons -->
              <div v-if="editingMessageId !== msg.id" class="flex items-center gap-2 px-1 h-2.5">
                <span class="text-xs text-base-content/40">{{ formatTime(msg.createdAt) }}</span>
                <span v-if="msg.role === 'assistant' && msg.responseTime != null && !msg.streaming"
                  class="flex items-center gap-1 text-xs text-base-content/40">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {{ formatResponseTime(msg.responseTime) }}
                </span>

                <!-- Retry button for assistant messages -->
                <button v-if="msg.role === 'assistant' && !msg.streaming && hoveredMessageId === msg.id && !sending"
                  @click="retryMessage(msg)"
                  class="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-base-content/50 hover:text-indigo-400 hover:bg-base-200 transition-colors"
                  title="Reintentar respuesta">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Reintentar
                </button>

                <!-- Edit button for user messages -->
                <button v-if="msg.role === 'user' && hoveredMessageId === msg.id && !sending" @click="editMessage(msg)"
                  class="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-base-content/50 hover:text-indigo-400 hover:bg-base-200 transition-colors"
                  title="Editar mensaje">
                  <span class="mdi mdi-pencil"></span>
                  Editar
                </button>
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

      <!-- Indicador flotante: loader del agente y/o botón "ir al final" -->
      <div v-if="activeConversation && (distiState !== 'idle' || !isAtBottom)" class="relative">
        <transition name="disti-fade">
          <button type="button" @click="scrollToBottom"
            class="absolute -top-12 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium shadow-lg transition-colors"
            :class="distiState !== 'idle' ? 'bg-white hover:bg-white text-base-content' : 'bg-indigo-600 hover:bg-indigo-500 text-white'"
            :title="distiState !== 'idle' ? 'El agente está trabajando' : (sending ? 'Hay texto nuevo abajo' : 'Ir al final')">
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

      <div class="px-9" v-if="visibleTasks.length > 0">
        <div class="rounded-xl border border-base-content/10 bg-base-100 shadow-lg overflow-hidden min-h-3">
          <!-- Barra de progreso -->
          <div class="h-1 w-full bg-base-content/10 relative">
            <div class="h-full bg-success transition-all duration-500 ease-out"
              :style="{ width: (visibleTasks.filter(t => t.status === 'completed').length / visibleTasks.length * 100) + '%' }">
            </div>
            <span class="absolute right-8 -top-1 px-0.5 bg-base-100 text-[12px] ">
              {{visibleTasks.filter(t => t.status === 'completed').length}}/{{ visibleTasks.length }}
            </span>
            <span @click="showTask = !showTask"
              class="absolute right-1 -top-1.5 px-2 bg-base-100 text-[13px] cursor-pointer">
              <span v-if="!showTask" class="mdi mdi-unfold-less-horizontal"></span>
              <span v-else class="mdi mdi-unfold-more-horizontal"></span>
            </span>
          </div>
          <!-- Lista -->
          <ul class="max-h-30 overflow-auto p-1.5 space-y-0.5" v-if="showTask">
            <li v-for="task in visibleTasks" :key="task.id"
              class="flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors"
              :class="task.status === 'in_progress' ? 'bg-primary/5' : ''">
              <span class="mt-0.5 shrink-0 text-sm leading-none">
                <span v-if="task.status === 'pending'" class="mdi mdi-checkbox-blank-outline opacity-40"></span>
                <div v-else-if="task.status === 'in_progress'" class="mdi mdi-loading text-primary animate-spin"></div>
                <span v-else-if="task.status === 'completed'" class="mdi mdi-check-circle text-success"></span>
                <span v-else-if="task.status === 'failed'" class="mdi mdi-alert-circle text-error"></span>
              </span>
              <div class="min-w-0 flex-1">
                <div class="text-xs font-medium truncate"
                  :class="{ 'line-through opacity-50': task.status === 'completed', 'text-error': task.status === 'failed' }">
                  {{ task.name }} - <span class="text-base-content/50">{{ task.description }}</span>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>

      <!-- Input area -->
      <div class="px-6 pb-5 pt-2">
        <div class="flex items-end gap-3 rounded-2xl border bg-base-300 px-4 py-3 transition-colors"
          :class="activeConversation ? 'border-base-300 focus-within:border-indigo-500/60' : 'border-base-300 opacity-50'">
          <textarea v-model="messageInput" :disabled="!activeConversation || sending" rows="3"
            placeholder="Escribe un mensaje... (Enter para enviar, Shift+Enter para salto de línea)"
            class="flex-1 resize-none bg-transparent text-sm text-base-content placeholder:text-base-content/40 focus:outline-none max-h-36"
            @keydown="handleKeydown" />
          <!-- Cancel button while sending -->
          <button v-if="sending"
            class="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-colors bg-red-600 hover:bg-red-500"
            @click="cancelRequest" title="Cancelar">
            <span class="mdi mdi-window-close"></span>
          </button>
          <!-- Send button -->
          <button v-else
            class="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-colors disabled:opacity-40"
            :class="messageInput.trim() && activeConversation ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-base-100'"
            :disabled="!messageInput.trim() || !activeConversation" @click="sendMessage">
            <span class="mdi mdi-send"></span>
          </button>
        </div>
      </div>
    </div>

    <!-- Traceability sidebar -->
    <transition name="sidebar">
      <TraceabilitySidebarPanel v-if="showTraceabilitySidebar && activeConversation"
        :conversation-id="activeConversation.id" :active-stage-id="chatGroups[activeConversation.id]?.stageId ?? null"
        @close="showTraceabilitySidebar = false" @error="error = $event" />
    </transition>

  </div>

  <!-- Share traceability modal -->
  <ShareTraceabilityModal v-if="showShareModal && linkedTraceability" :traceability-id="linkedTraceability.id"
    :excluded-user-ids="[
      ...participants.map(p => p.userId),
      ...(linkedTraceability.createdBy ? [linkedTraceability.createdBy] : []),
      ...(auth.user?.id ? [auth.user.id] : [])
    ]" @close="showShareModal = false" @saved="onShareSaved" />

  <!-- Stage selection modal (multi-stage invitations) -->
  <div v-if="pendingStageSelection"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    @click.self="pendingStageSelection = null">
    <div class="bg-base-300 rounded-2xl border border-base-300 w-full max-w-md p-6">
      <h2 class="text-lg font-semibold text-base-content mb-1">Selecciona un stage</h2>
      <p class="text-xs text-base-content/60 mb-4 truncate">Trazabilidad: {{ pendingStageSelection.title }}</p>
      <p class="text-sm text-base-content mb-3">Tienes acceso a varios stages. Cada uno abrirá su propio chat:</p>
      <div class="space-y-2 max-h-80 overflow-y-auto">
        <button v-for="s in pendingStageSelection.stages" :key="s.id"
          class="w-full text-left px-3 py-3 rounded-lg border transition-colors" :class="s.hasChat
            ? 'border-emerald-700/50 bg-emerald-900/10 hover:bg-emerald-900/20'
            : 'border-base-300 bg-base-200 hover:bg-base-100'" @click="pickStageFromModal(s.id)">
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0">
              <p class="text-sm font-medium text-base-content truncate">{{ s.name }}</p>
              <p v-if="s.role" class="text-[11px] text-base-content/60 truncate">Rol: {{ s.role }}</p>
            </div>
            <span v-if="s.hasChat" class="text-[10px] uppercase tracking-wider text-emerald-400 shrink-0">Abierto</span>
            <span v-else class="text-[10px] uppercase tracking-wider text-indigo-400 shrink-0">Crear</span>
          </div>
        </button>
      </div>
      <div class="flex justify-end gap-2 mt-5">
        <button @click="pendingStageSelection = null"
          class="px-4 py-2 rounded-lg text-sm text-base-content hover:text-base-content hover:bg-base-200 transition-colors">
          Cerrar
        </button>
      </div>
    </div>
  </div>

  <!-- Credential modal -->
  <AppModal v-if="showCredentialModal" title="Establecer credenciales" @close="showCredentialModal = false">
    <NewCredential :servers="credentialServers" @saved="showCredentialModal = false"
      @cancel="showCredentialModal = false" />
  </AppModal>

  <!-- New conversation modal -->
  <div v-if="showNewChatModal"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    @click.self="showNewChatModal = false">
    <div class="bg-base-300 rounded-2xl border border-base-300 w-full max-w-md p-6">
      <h2 class="text-lg font-semibold text-base-content mb-5">Nueva conversación</h2>

      <div class="space-y-4">
        <!-- Title -->
        <div>
          <label class="block text-sm text-base-content/60 mb-1.5">Nombre *</label>
          <input v-model="newChatTitle" type="text" placeholder="Ej: Análisis de feature PROJ-123"
            class="w-full px-3 py-2.5 rounded-lg bg-base-200 border border-base-300 text-sm text-base-content placeholder:text-base-content/40 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors" />
        </div>

        <!-- Agent selection -->
        <div>
          <label class="block text-sm text-base-content/60 mb-1.5">Agente *</label>
          <div v-if="loadingChatAgents" class="flex items-center gap-2 text-base-content/50 text-sm py-2">
            <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Cargando agentes...
          </div>
          <div v-else-if="chatAgents.length === 0"
            class="text-sm text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2.5 border border-amber-500/20">
            No hay agentes disponibles para tu rol. Contacta a un administrador.
          </div>
          <div v-else class="space-y-2 max-h-56 overflow-y-auto pr-1">
            <label v-for="agent in chatAgents" :key="agent.id"
              class="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all" :class="selectedAgentId === agent.id
                ? 'bg-indigo-600/10 border-indigo-500 ring-1 ring-indigo-500/40'
                : 'bg-base-200/50 border-base-300 hover:border-base-content/20'">
              <input type="radio" :value="agent.id" v-model="selectedAgentId" class="mt-0.5 accent-indigo-500" />
              <div class="min-w-0">
                <p class="text-sm font-medium text-base-content">{{ agent.name }}</p>
                <p v-if="agent.description" class="text-xs text-base-content/60 mt-0.5 truncate">{{ agent.description }}
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div class="flex gap-3 mt-6">
        <button @click="showNewChatModal = false"
          class="flex-1 py-2.5 text-sm rounded-xl bg-base-200 hover:bg-base-100 text-base-content font-medium transition-colors">
          Cancelar
        </button>
        <button @click="createConversation" :disabled="!selectedAgentId || !newChatTitle.trim()"
          class="flex-1 py-2.5 text-sm rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium transition-colors">
          Crear
        </button>
      </div>
    </div>
  </div>

  <!-- Lightbox de imagen original -->
  <div v-if="lightboxImage" @click="lightboxImage = null"
    class="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-6 cursor-zoom-out">
    <img :src="lightboxImage" alt="Imagen original"
      class="max-h-full max-w-full object-contain rounded-lg shadow-2xl" />
    <button type="button" @click.stop="lightboxImage = null"
      class="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/30 text-white text-xl leading-none">
      ✕
    </button>
  </div>

  <!-- Diagramas Mermaid: renderizado dentro del contenedor de mensajes + modal de zoom/descarga -->
  <MermaidRenderer ref="mermaidRenderer" :container="messagesContainer" />

</template>

<style scoped>
.sidebar-enter-active,
.sidebar-leave-active {
  transition: width 0.2s ease, opacity 0.2s ease;
  overflow: hidden;
}

.sidebar-enter-from,
.sidebar-leave-to {
  width: 0;
  opacity: 0;
}

.sidebar-enter-to,
.sidebar-leave-from {
  width: 18rem;
  opacity: 1;
}

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
