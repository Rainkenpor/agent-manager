<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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

interface RequestQuestion {
  id: string
  type: 'text' | 'multi' | 'single' | 'list' | 'confirm' | 'setCredential'
  label: string
  description: string
  options: Array<{ label: string; description: string }>
}

const mermaidRenderer = ref<InstanceType<typeof MermaidRenderer> | null>(null)
function renderMermaidDiagrams() {
  void mermaidRenderer.value?.renderDiagrams()
}

// ── Estado del widget flotante ─────────────────────────────────────────────
const open = ref(false)
const hostOrigin = ref('')

const conversationId = ref<string | null>(null)
const agentName = ref('Asistente')
const scope = ref<string[]>([])

// Colores configurables por integración (con respaldo al índigo de marca).
const buttonColor = ref('#4f46e5')
const iconColor = ref('#ffffff')
const userBubbleColor = ref('#4f46e5')
const messages = ref<DisplayMessage[]>([])
const messageInput = ref('')
const sending = ref(false)
const starting = ref(true)
const pending = ref(false)
const error = ref('')
const distiState = ref<'loading' | 'thinking' | 'happy' | 'sad' | 'idle'>('idle')

const messagesContainer = ref<HTMLElement | null>(null)
let abortController: AbortController | null = null

// Estado de formularios por id de mensaje (bloques ```request``` del asistente).
const formAnswers = ref<Record<string, Record<string, { textValue: string; selectedOptions: any[] }>>>({})
const submittedForms = ref<string[]>([])

/** Origen del sitio anfitrión derivado del propio contenedor (respaldo si el loader no lo envía). */
function resolveHostOrigin(): string {
  try {
    if (window.location.ancestorOrigins?.length) return window.location.ancestorOrigins[0]
  } catch {
    /* no soportado */
  }
  if (document.referrer) {
    try {
      return new URL(document.referrer).origin
    } catch {
      /* ignore */
    }
  }
  return window.location.origin
}

// Notifica al loader de embebido (abrir/cerrar para redimensionar el iframe).
function notifyParent() {
  try {
    window.parent?.postMessage({ source: 'integration-widget', open: open.value }, '*')
  } catch {
    /* sin parent */
  }
}

// Tema por defecto según la preferencia del sistema.
const DEFAULT_THEME = (() => {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'am-dark' : 'am-light'
  } catch {
    return 'am-light'
  }
})()

function applyTheme(theme: string) {
  if (theme) document.documentElement.setAttribute('data-theme', theme)
}

// El loader del sitio anfitrión envía su origen (y opcionalmente el tema) por postMessage.
function handleHostMessage(e: MessageEvent) {
  if (e.data?.source !== 'integration-host') return
  if (typeof e.data.host === 'string' && e.data.host !== hostOrigin.value) {
    hostOrigin.value = e.data.host
    // El loader envía el origen real del sitio anfitrión: re-resolver la apariencia con él.
    void applyAppearance(hostOrigin.value)
  }
  if (typeof e.data.theme === 'string') applyTheme(e.data.theme)
}

function toggleOpen() {
  open.value = !open.value
  notifyParent()
  if (open.value && !conversationId.value && !pending.value && !starting.value) {
    void startConversation()
  }
}

// ── Sugerencias mientras se escribe ───────────────────────────────────────
const suggestions = ref<Array<{ id: string; question: string }>>([])
let suggestTimer: ReturnType<typeof setTimeout> | null = null

watch(messageInput, (value) => {
  if (suggestTimer) clearTimeout(suggestTimer)
  const text = value.trim()
  if (sending.value || text.length < 3) {
    suggestions.value = []
    return
  }
  suggestTimer = setTimeout(async () => {
    try {
      suggestions.value = await api.suggestIntegrationQna(text)
    } catch {
      suggestions.value = []
    }
  }, 250)
})

function pickSuggestion(question: string) {
  suggestions.value = []
  messageInput.value = question
  sendMessage()
}

/** Obtiene la apariencia configurada (colores) por origen y la aplica al botón antes de abrir el chat. */
async function applyAppearance(origin: string) {
  if (!origin) return
  try {
    const cfg = await api.getIntegrationConfig(origin)
    if (!cfg) return
    if (cfg.buttonColor) buttonColor.value = cfg.buttonColor
    if (cfg.iconColor) iconColor.value = cfg.iconColor
    if (cfg.userBubbleColor) userBubbleColor.value = cfg.userBubbleColor
    if (cfg.agentName) agentName.value = cfg.agentName
  } catch {
    /* mantiene los colores por defecto */
  }
}

async function startConversation() {
  starting.value = true
  pending.value = false
  error.value = ''
  try {
    const res = await api.createIntegrationConversation(hostOrigin.value)
    if (res.status === 'pending' || (!res.success && !res.data)) {
      pending.value = true
      return
    }
    if (!res.success || !res.data?.id) {
      error.value = res.error || 'No se pudo iniciar el asistente'
      return
    }
    conversationId.value = res.data.id
    agentName.value = res.data.agentName || 'Asistente'
    scope.value = res.data.scope || []
    if (res.data.buttonColor) buttonColor.value = res.data.buttonColor
    if (res.data.iconColor) iconColor.value = res.data.iconColor
    if (res.data.userBubbleColor) userBubbleColor.value = res.data.userBubbleColor
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
  suggestions.value = []
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
      response = await api.streamIntegrationMessage(conversationId.value, content, hostOrigin.value, abortController.signal)
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
        } else if (event.type === 'done') {
          distiState.value = 'happy'
          const idx = messages.value.findIndex((m) => m.id === streamingId)
          if (idx !== -1) {
            messages.value[idx] = {
              ...event.message,
              streaming: false,
              responseTime: event.responseTime,
              toolCalls: [] //messages.value[idx].toolCalls
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

const URL_PATTERN = /https?:\/\/[^\s<>()"']+/g

function maskTokens(text: string): string {
  // Las URLs no se enmascaran: sus segmentos largos dispararían el filtro de tokens y romperían el enlace.
  const urls: string[] = []
  text = text.replace(URL_PATTERN, (url) => `{{url:${urls.push(url) - 1}}}`)
  text = text.replace(/eyJ[a-zA-Z0-9+/_-]+=*\.[a-zA-Z0-9+/_-]+=*\.[a-zA-Z0-9+/_-]+=*/g, (m) => m.slice(0, 5) + '*****')
  text = text.replace(/\b(sk-|ghp_|ghs_|github_pat_|xoxb-|xoxp-|Bearer\s+)[a-zA-Z0-9+/_.-]{8,}/gi, (m) => m.slice(0, 5) + '*****')
  text = text.replace(/[a-zA-Z0-9+/_-]{25,}/g, (m) => {
    if (/[A-Z]/.test(m) && /[a-z]/.test(m) && /[0-9]/.test(m)) return m.slice(0, 5) + '*****'
    return m
  })
  return text.replace(/\{\{url:(\d+)\}\}/g, (_m, i) => urls[Number(i)])
}

const CHIP_CLASS =
  'inline-flex max-w-full items-center gap-1 align-middle rounded-full border border-base-300 bg-base-200/70 px-2 py-0.5 text-xs font-medium text-base-content no-underline transition-colors hover:bg-base-300'

const HOST_ICONS: Array<[RegExp, string]> = [
  [/atlassian\.net\/wiki|confluence/i, 'mdi-book-open-page-variant'],
  [/atlassian\.net|\bjira\b/i, 'mdi-jira'],
  [/github\./i, 'mdi-github'],
  [/gitlab\./i, 'mdi-gitlab'],
  [/youtube\.com|youtu\.be/i, 'mdi-youtube'],
  [/sharepoint\./i, 'mdi-microsoft-sharepoint'],
  [/teams\.microsoft\./i, 'mdi-microsoft-teams'],
  [/office\.com|onedrive\.|live\.com/i, 'mdi-microsoft-office']
]

const EXT_ICONS: Record<string, string> = {
  pdf: 'mdi-file-pdf-box',
  doc: 'mdi-file-word-box',
  docx: 'mdi-file-word-box',
  xls: 'mdi-file-excel-box',
  xlsx: 'mdi-file-excel-box',
  csv: 'mdi-file-delimited',
  ppt: 'mdi-file-powerpoint-box',
  pptx: 'mdi-file-powerpoint-box',
  png: 'mdi-file-image',
  jpg: 'mdi-file-image',
  jpeg: 'mdi-file-image',
  gif: 'mdi-file-image',
  svg: 'mdi-file-image',
  webp: 'mdi-file-image',
  zip: 'mdi-folder-zip',
  rar: 'mdi-folder-zip'
}

/** Icono mdi del chip: por extensión del archivo si la hay, si no por el servicio del host. */
function linkIcon(url: string): string {
  const ext = url.split(/[?#]/)[0].split('/').pop()?.split('.').pop()?.toLowerCase()
  if (ext && EXT_ICONS[ext]) return EXT_ICONS[ext]
  for (const [pattern, icon] of HOST_ICONS) {
    if (pattern.test(url)) return icon
  }
  return 'mdi-open-in-new'
}

/** Nombre del chip para una URL suelta: el archivo al que apunta o, si no hay, el dominio. */
function linkLabel(url: string): string {
  try {
    const { pathname, hostname } = new URL(url)
    const file = pathname.split('/').filter(Boolean).pop() ?? ''
    if (/\.[a-z0-9]{2,5}$/i.test(file)) return decodeURIComponent(file)
    return hostname.replace(/^www\./i, '')
  } catch {
    return url
  }
}

function renderChip(href: string, label: string): string {
  return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="${CHIP_CLASS}"><i class="mdi ${linkIcon(href)} text-sm leading-none opacity-70"></i><span class="truncate">${label}</span></a>`
}

/** Convierte enlaces markdown `[texto](url)` y URLs sueltas en chips que abren en una pestaña nueva. */
function renderLinks(html: string): string {
  return html
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label, url) => renderChip(url, label))
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (_m, prefix, url) => {
      const trailing = url.match(/[.,;:!?]+$/)?.[0] ?? ''
      const href = url.slice(0, url.length - trailing.length)
      return `${prefix}${renderChip(href, linkLabel(href))}${trailing}`
    })
}

function renderInlineMarkdown(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code class="bg-base-100/80 px-1 rounded text-xs font-mono">$1</code>')
  return renderLinks(escaped)
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

// ── Formularios de solicitud (bloques ```request```) ──────────────────────
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
      type: header[2] as RequestQuestion['type'],
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
      const answers: Record<string, { textValue: string; selectedOptions: any[] }> = {}
      for (const q of questions) {
        const data: any[] = []
        if (q.type === 'list') data.push({ label: '(sin selección)', description: '' })
        answers[q.id] = { textValue: '', selectedOptions: data }
      }
      formAnswers.value[msg.id] = answers
    }

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
    } else {
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

// El widget vive en un iframe: fondo transparente para mostrar solo el botón/panel.
// Además forzamos color-scheme normal: con el tema oscuro (color-scheme: dark) el
// backdrop del iframe se pinta negro aunque el fondo sea transparente. Los colores del
// widget son variables daisyUI, así que el panel mantiene su tema; solo se transparenta el lienzo.
const prevBg = { html: '', body: '', scheme: '' }
let prevTheme = ''
onMounted(() => {
  prevBg.html = document.documentElement.style.background
  prevBg.body = document.body.style.background
  prevBg.scheme = document.documentElement.style.colorScheme
  document.documentElement.style.background = 'transparent'
  document.body.style.background = 'transparent'
  document.documentElement.style.colorScheme = 'normal'

  // Tema inicial: query `?theme=` (si se abre directo) o preferencia del sistema.
  // El loader puede sobrescribirlo luego vía postMessage.
  prevTheme = document.documentElement.getAttribute('data-theme') || ''
  applyTheme(new URLSearchParams(window.location.search).get('theme') || DEFAULT_THEME)

  // Respaldo inmediato; el loader sobrescribe con el origen real vía postMessage.
  hostOrigin.value = resolveHostOrigin()
  // Pinta el botón con los colores configurados desde el arranque (el loader los refinará luego).
  void applyAppearance(hostOrigin.value)
  window.addEventListener('message', handleHostMessage)
  // Pide al loader que nos envíe el origen del sitio anfitrión y el tema.
  try {
    window.parent?.postMessage({ source: 'integration-widget', type: 'ready' }, '*')
  } catch {
    /* sin parent */
  }
  starting.value = false
  notifyParent()
})

onBeforeUnmount(() => {
  window.removeEventListener('message', handleHostMessage)
  document.documentElement.style.background = prevBg.html
  document.body.style.background = prevBg.body
  document.documentElement.style.colorScheme = prevBg.scheme
  if (prevTheme) document.documentElement.setAttribute('data-theme', prevTheme)
})
</script>

<template>
  <div class="fixed inset-0 pointer-events-none flex flex-col items-end justify-end p-4 gap-3 font-sans bg-transparent">
    <!-- Panel de chat flotante -->
    <transition name="widget-pop">
      <div v-if="open"
        class="pointer-events-auto flex flex-col w-[min(92vw,380px)] h-[min(80vh,560px)] rounded-2xl shadow-2xl overflow-hidden bg-base-300 border border-base-300">
        <!-- Header -->
        <header class="shrink-0 px-4 py-3 border-b border-base-300 bg-base-100 flex items-center justify-between">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center font-bold"
              :style="{ backgroundColor: buttonColor, color: iconColor }">
              D
            </div>
            <div class="min-w-0">
              <h1 class="text-sm font-semibold text-base-content truncate">{{ agentName }}</h1>
              <p class="text-[11px] text-base-content/50">En línea</p>
            </div>
          </div>
          <button type="button" @click="toggleOpen"
            class="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-base-content/60 hover:bg-base-200 transition-colors"
            title="Cerrar">
            <span class="mdi mdi-chevron-down text-lg"></span>
          </button>
        </header>

        <!-- Estado pendiente de configuración -->
        <div v-if="pending" class="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <span class="mdi mdi-cog-outline text-4xl text-base-content/30"></span>
          <p class="text-sm text-base-content/60">Este asistente aún está pendiente de configuración. Vuelve a
            intentarlo más
            tarde.</p>
        </div>

        <template v-else>
          <!-- Mensajes -->
          <div ref="messagesContainer" class="flex-1 overflow-y-auto px-4 py-4 space-y-3" @scroll="updateIsAtBottom">
            <div v-if="starting" class="flex items-center justify-center py-10">
              <div class="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            </div>

            <template v-else>
              <div v-if="messages.length === 0" class="text-center py-10 text-base-content/50 text-sm">
                ¡Hola! ¿En qué puedo ayudarte?
              </div>

              <div v-for="msg in messages" :key="msg.id" class="flex gap-2 w-full"
                :class="msg.role === 'user' ? 'flex-row-reverse' : ''">
                <div class="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5"
                  :class="msg.role === 'user' ? 'text-white' : 'bg-base-100 text-base-content'"
                  :style="msg.role === 'user' ? { backgroundColor: userBubbleColor } : undefined">
                  {{ msg.role === 'user' ? 'U' : 'A' }}
                </div>

                <div class="flex flex-col gap-1 max-w-[82%] min-w-0"
                  :style="msg.role === 'user' ? 'align-items:flex-end' : ''">
                  <div class="rounded-2xl text-sm leading-relaxed px-3 py-2 break-words" :class="msg.role === 'user'
                    ? 'text-white rounded-tr-sm'
                    : 'bg-base-100 text-base-content rounded-tl-sm border border-base-300'"
                    :style="msg.role === 'user' ? { backgroundColor: userBubbleColor } : undefined">
                    <div v-if="msg.toolCalls && msg.toolCalls.length > 0" class="flex flex-wrap gap-1.5 mb-2">
                      <span
                        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-base-100/60 text-base-content/50 text-[11px] font-mono">
                        <span class="mdi mdi-search-web"></span>
                        Buscando información... ({{ msg.toolCalls.length }})
                      </span>
                    </div>

                    <!-- ── Formulario de solicitud activo ── -->
                    <template
                      v-if="getRequestQuestions(msg) && !submittedForms.includes(msg.id) && formAnswers[msg.id]">
                      <p v-if="getContentBeforeRequest(msg.content)" class="whitespace-pre-wrap mb-2 text-base-content"
                        v-html="renderMarkdown(getContentBeforeRequest(msg.content))" />

                      <div class="space-y-3 border border-base-content/20 rounded-xl p-3 bg-base-300/60">
                        <p class="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">Completa el
                          formulario</p>

                        <div v-for="q in getRequestQuestions(msg)" :key="q.id" class="space-y-1.5">
                          <div>
                            <p class="text-xs font-medium text-base-content" v-html="renderInlineMarkdown(q.label)" />
                            <p v-if="q.description" class="text-[11px] text-base-content/50 mt-0.5 whitespace-pre-wrap"
                              v-html="renderInlineMarkdown(q.description)" />
                          </div>

                          <!-- Multi: opciones (checkboxes) -->
                          <div v-if="q.type === 'multi' && q.options.length" class="space-y-1 pl-0.5">
                            <label v-for="opt in q.options" :key="opt.label"
                              class="flex items-start gap-2 cursor-pointer select-none">
                              <input type="checkbox"
                                :checked="formAnswers[msg.id][q.id].selectedOptions.includes(opt.label)"
                                @change="toggleOption(msg.id, q.id, opt.label)"
                                class="mt-0.5 shrink-0 rounded border-base-content/20 bg-base-200 accent-indigo-500 cursor-pointer" />
                              <span class="text-xs text-base-content leading-snug">
                                {{ opt.label }}
                                <span v-if="opt.description" class="text-base-content/70"> — {{ opt.description
                                }}</span>
                              </span>
                            </label>
                          </div>

                          <!-- List: entradas editables -->
                          <div v-if="q.type === 'list'" class="flex flex-wrap gap-2">
                            <div v-for="[key, opt] of Object.entries(formAnswers[msg.id][q.id].selectedOptions)"
                              :key="`list_${key}`" class="w-full">
                              <div class="flex w-full gap-1">
                                <input type="text" :value="opt.description"
                                  @input="(e) => listItemChanged(opt, e, msg.id, q.id, key)"
                                  class="w-full px-2.5 py-1.5 rounded-lg bg-base-200 border border-base-300 text-xs text-base-content placeholder:text-base-content/40 focus:outline-none focus:border-indigo-500 transition-colors" />
                                <button v-if="opt.description !== ''" type="button"
                                  @click="removeOption(msg.id, q.id, key)"
                                  class="shrink-0 w-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-base-200 transition-colors">
                                  <span class="mdi mdi-close"></span>
                                </button>
                              </div>
                            </div>
                          </div>

                          <!-- Confirm: opciones como botones -->
                          <div v-if="q.type === 'confirm' && q.options.length" class="flex flex-wrap gap-2">
                            <button v-for="opt in q.options" :key="opt.label" type="button"
                              @click="selectOption(msg.id, q.id, opt.label)" :title="opt.description || undefined"
                              :class="formAnswers[msg.id][q.id].selectedOptions[0] === opt.label
                                ? 'bg-indigo-600 border-indigo-500 text-white'
                                : 'bg-base-200 border-base-content/20 text-base-content hover:border-indigo-500/60'"
                              class="px-3 py-1 rounded-lg border text-xs font-medium transition-colors">
                              {{ opt.label }}
                            </button>
                          </div>

                          <!-- Single: opciones (radios) -->
                          <div v-if="q.type === 'single' && q.options.length" class="space-y-1 pl-0.5">
                            <label v-for="opt in q.options" :key="opt.label"
                              class="flex items-start gap-2 cursor-pointer select-none">
                              <input type="radio" :name="`${msg.id}-${q.id}`" :value="opt.label"
                                :checked="formAnswers[msg.id][q.id].selectedOptions[0] === opt.label"
                                @change="selectOption(msg.id, q.id, opt.label)"
                                class="mt-0.5 shrink-0 border-base-content/20 bg-base-200 accent-indigo-500 cursor-pointer" />
                              <span class="text-xs text-base-content leading-snug">
                                {{ opt.label }}
                                <span v-if="opt.description" class="text-base-content/70"> — {{ opt.description
                                }}</span>
                              </span>
                            </label>
                          </div>

                          <!-- Entrada de texto -->
                          <input v-if="q.type !== 'list' && q.type !== 'setCredential'"
                            :value="formAnswers[msg.id][q.id].textValue"
                            @input="(e) => (formAnswers[msg.id][q.id].textValue = (e.target as HTMLInputElement).value)"
                            type="text" :placeholder="q.type === 'multi' || q.type === 'single' || q.type === 'confirm'
                              ? 'Otra respuesta (opcional)...'
                              : (q.description ? q.description.split('\n')[0] : 'Tu respuesta...')"
                            class="w-full px-2.5 py-1.5 rounded-lg bg-base-200 border border-base-300 text-xs text-base-content placeholder:text-base-content/40 focus:outline-none focus:border-indigo-500 transition-colors" />
                        </div>

                        <button type="button" @click="submitRequestForm(msg.id, getRequestQuestions(msg)!)"
                          :disabled="sending || !conversationId"
                          class="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold transition-colors">
                          Enviar respuestas
                        </button>
                      </div>
                      <p v-if="getContentAfterRequest(msg.content)" class="whitespace-pre-wrap mt-2 text-base-content"
                        v-html="renderMarkdown(getContentAfterRequest(msg.content))" />
                    </template>

                    <!-- ── Formulario enviado ── -->
                    <template v-else-if="getRequestQuestions(msg)">
                      <p v-if="getContentBeforeRequest(msg.content)"
                        class="whitespace-pre-wrap mb-1.5 text-base-content"
                        v-html="renderMarkdown(getContentBeforeRequest(msg.content))" />
                      <span class="inline-flex items-center gap-1.5 text-[11px] text-base-content/50">
                        <span class="mdi mdi-check text-green-400"></span>
                        Formulario enviado
                      </span>
                      <p v-if="getContentAfterRequest(msg.content)" class="whitespace-pre-wrap mt-1.5 text-base-content"
                        v-html="renderMarkdown(getContentAfterRequest(msg.content))" />
                    </template>

                    <!-- ── Texto plano ── -->
                    <span v-else class="whitespace-pre-wrap" v-html="renderMarkdown(msg.content)" />
                  </div>
                  <span class="text-[10px] text-base-content/40 px-1">{{ formatTime(msg.createdAt) }}</span>
                </div>
              </div>
            </template>
          </div>

          <!-- Error -->
          <div v-if="error"
            class="mx-4 mb-2 px-3 py-2 rounded-lg bg-red-900/40 border border-red-700/50 text-red-400 text-xs flex items-center justify-between">
            {{ error }}
            <button class="text-red-500 hover:text-red-300 ml-3" @click="error = ''">✕</button>
          </div>

          <!-- Estado del asistente -->
          <div v-if="distiState !== 'idle'" class="px-4 pb-1 flex items-center gap-2">
            <DistiLoader :state="distiState" size="xs" theme="light" />
          </div>

          <!-- Sugerencias -->
          <div v-if="suggestions.length && !sending" class="px-4">
            <div class="rounded-xl border border-base-300 bg-base-100 overflow-hidden">
              <button v-for="s in suggestions" :key="s.id" type="button" @click="pickSuggestion(s.question)"
                class="w-full text-left px-3 py-2 text-xs text-base-content hover:bg-base-200 transition-colors flex items-center gap-2">
                <span class="mdi mdi-lightning-bolt-outline text-indigo-400 shrink-0"></span>
                <span class="truncate">{{ s.question }}</span>
              </button>
            </div>
          </div>

          <!-- Entrada -->
          <div class="px-3 pb-3 pt-2">
            <div class="flex items-end gap-2 rounded-2xl border bg-base-300 px-3 py-2 transition-colors"
              :class="conversationId ? 'border-indigo-500/30 focus-within:border-indigo-500/60' : 'border-base-300 opacity-50'">
              <textarea v-model="messageInput" :disabled="!conversationId || sending" rows="1"
                placeholder="Escribe un mensaje..."
                class="flex-1 resize-none bg-transparent p-2 text-sm text-base-content placeholder:text-base-content/40 focus:outline-none max-h-28"
                @keydown="handleKeydown" />
              <button v-if="sending"
                class="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-colors bg-red-600 hover:bg-red-500"
                @click="cancelRequest" title="Cancelar">
                <span class="mdi mdi-window-close"></span>
              </button>
              <button v-else
                class="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-colors disabled:opacity-40"
                :class="messageInput.trim() && conversationId ? '' : 'bg-base-100'"
                :style="messageInput.trim() && conversationId ? { backgroundColor: buttonColor, color: iconColor } : undefined"
                :disabled="!messageInput.trim() || !conversationId" @click="sendMessage">
                <span class="mdi mdi-send"></span>
              </button>
            </div>
          </div>
        </template>
      </div>
    </transition>

    <!-- Botón flotante -->
    <button type="button" @click="toggleOpen"
      class="pointer-events-auto shrink-0 w-14 h-14 rounded-full  flex items-center justify-center transition-transform hover:scale-105 bg-white/30 backdrop-blur-md border border-white/20 shadow-lg text-white"
      :title="open ? 'Cerrar chat' : 'Abrir chat'">
      <span class="mdi text-2xl" :class="open ? 'mdi-close' : 'mdi-creation'"></span>
    </button>

    <MermaidRenderer ref="mermaidRenderer" :container="messagesContainer" />
  </div>
</template>

<style scoped>
.widget-pop-enter-active,
.widget-pop-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
  transform-origin: bottom right;
}

.widget-pop-enter-from,
.widget-pop-leave-to {
  opacity: 0;
  transform: scale(0.85) translateY(10px);
}
</style>
