<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import * as api from '@/api/api'
import AppModal from '@/components/AppModal.vue'
import { useAuthStore } from '@/store/useAuth'
import { useToastStore } from '@/store/useToast'
import PageLayout from '@/components/PageLayout.vue'

const auth = useAuthStore()
const toast = useToastStore()

// ── Types ─────────────────────────────────────────────────────────────────────

interface Webhook {
  id: string
  name: string
  description?: string | null
  method: string
  targetType: 'agent' | 'mcp_tool' | 'llm'
  targetId: string
  targetName: string
  extraData?: Record<string, string> | null
  authEnabled: boolean
  secret?: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

interface Agent {
  id: string
  name: string
  slug: string
}

interface McpTool {
  toolName: string
  description: string
}

interface AvailableTool {
  name: string
  description: string
  source: string
}

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

// ── Permissions ───────────────────────────────────────────────────────────────

const canCreate = computed(() => auth.hasPermission('webhooks', 'create'))
const canUpdate = computed(() => auth.hasPermission('webhooks', 'update'))
const canDelete = computed(() => auth.hasPermission('webhooks', 'delete'))

// ── State ─────────────────────────────────────────────────────────────────────

const webhooks = ref<Webhook[]>([])
const loading = ref(false)
const agents = ref<Agent[]>([])
const mcpServers = ref<any[]>([])
const availableTools = ref<AvailableTool[]>([])
const revealedSecrets = ref<Set<string>>(new Set())

// ── Form / Modal ──────────────────────────────────────────────────────────────

const showModal = ref(false)
const llmToolSearch = ref<string>('')
const editing = ref<Webhook | null>(null)
const saving = ref(false)
const formErrors = ref<string[]>([])

const mcpToolsForServer = ref<McpTool[]>([])
const loadingMcpTools = ref(false)

const emptyForm = () => ({
  name: '',
  description: '',
  method: 'POST',
  targetType: 'agent' as 'agent' | 'mcp_tool' | 'llm',
  agentSlug: '',
  mcpServerId: '',
  toolName: '',
  systemPrompt: '',
  tools: {} as Record<string, boolean>,
  authEnabled: true,
  active: true
})

const form = ref(emptyForm())

function parseTools(raw: string | undefined | null): Record<string, boolean> {
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, boolean>
  } catch {
    return {}
  }
}

// Tools agrupadas por origen para el selector del destino LLM (mismo patrón que AgentsView)
const toolGroups = computed(() => {
  const byKey: Record<string, AvailableTool[]> = {}
  const search = (llmToolSearch.value || '').trim().toLowerCase()

  for (const tool of availableTools.value.filter(f => search === '' ||
    (
      f.name.toString().trim().toLowerCase().indexOf(search) > -1 ||
      f.description.toString().trim().toLowerCase().indexOf(search) > -1
    ))) {
    const key = tool.source === 'external' && tool.name.startsWith('mcp__') ? tool.name.slice(5).split('__')[0] : tool.source
    if (!byKey[key]) byKey[key] = []
    byKey[key].push(tool)
  }
  return Object.entries(byKey)
    .map(([key, tools]) => ({ key, tools }))
    .sort((a, b) => a.key.localeCompare(b.key))
})

const selectedToolCount = computed(() => Object.values(form.value.tools).filter(Boolean).length)

function openCreate() {
  editing.value = null
  form.value = emptyForm()
  formErrors.value = []
  mcpToolsForServer.value = []
  showModal.value = true
}

async function openEdit(item: Webhook) {
  editing.value = item
  form.value = {
    name: item.name,
    description: item.description ?? '',
    method: item.method,
    targetType: item.targetType,
    agentSlug: item.targetType === 'agent' ? item.targetId : '',
    mcpServerId: '',
    toolName: item.targetType === 'mcp_tool' ? item.targetName : '',
    systemPrompt: item.targetType === 'llm' ? (item.extraData?.systemPrompt ?? '') : '',
    tools: item.targetType === 'llm' ? parseTools(item.extraData?.tools) : {},
    authEnabled: item.authEnabled,
    active: item.active
  }
  formErrors.value = []
  mcpToolsForServer.value = []
  showModal.value = true
  if (item.targetType === 'mcp_tool' && item.extraData?.mcpServerName) {
    const server = mcpServers.value.find((s) => s.name === item.extraData?.mcpServerName)
    if (server) {
      form.value.mcpServerId = server.id
      await onMcpServerChange(server.id)
      form.value.toolName = item.targetName
    }
  }
}

async function onMcpServerChange(mcpServerId: string) {
  form.value.toolName = ''
  if (!mcpServerId) {
    mcpToolsForServer.value = []
    return
  }
  loadingMcpTools.value = true
  try {
    const res = await api.getMcpServerTools(mcpServerId)
    mcpToolsForServer.value = res.data ?? []
  } catch {
    mcpToolsForServer.value = []
  } finally {
    loadingMcpTools.value = false
  }
}

async function save() {
  const errors: string[] = []
  if (!form.value.name.trim()) errors.push('El nombre es requerido.')
  else if (!/^[a-z0-9_-]+$/.test(form.value.name.trim())) errors.push('El nombre solo admite minúsculas, números, guiones y guiones bajos.')
  if (form.value.targetType === 'agent' && !form.value.agentSlug) errors.push('Selecciona un agente.')
  if (form.value.targetType === 'mcp_tool' && (!form.value.mcpServerId || !form.value.toolName))
    errors.push('Selecciona un servidor MCP y un tool.')
  formErrors.value = errors
  if (errors.length > 0) return

  let target: { targetId: string; targetName: string; extraData?: Record<string, string> }
  if (form.value.targetType === 'agent') {
    const agent = agents.value.find((a) => a.slug === form.value.agentSlug)
    if (!agent) {
      formErrors.value = ['Agente no encontrado.']
      return
    }
    target = { targetId: agent.slug, targetName: agent.name }
  } else if (form.value.targetType === 'llm') {
    target = {
      targetId: 'llm',
      targetName: 'LLM directo',
      extraData: { systemPrompt: form.value.systemPrompt.trim(), tools: JSON.stringify(form.value.tools) }
    }
  } else {
    const server = mcpServers.value.find((s) => s.id === form.value.mcpServerId)
    if (!server) {
      formErrors.value = ['Servidor MCP no encontrado.']
      return
    }
    target = {
      targetId: form.value.toolName,
      targetName: form.value.toolName,
      extraData: { mcpServerName: server.name, mcpServerUrl: server.url ?? '', toolName: form.value.toolName }
    }
  }

  const payload = {
    description: form.value.description.trim() || undefined,
    method: form.value.targetType === 'llm' ? 'POST' : form.value.method,
    targetType: form.value.targetType,
    ...target,
    authEnabled: form.value.authEnabled,
    active: form.value.active
  }

  saving.value = true
  try {
    if (editing.value) {
      const res = await api.updateWebhook(editing.value.id, payload)
      if (!res.success) throw new Error((res as any).error)
      toast.success('Webhook actualizado')
    } else {
      const res = await api.createWebhook({ name: form.value.name.trim(), ...payload })
      if (!res.success) throw new Error((res as any).error)
      toast.success('Webhook creado')
    }
    showModal.value = false
    await fetchWebhooks()
  } catch (e: any) {
    toast.error(e.message || 'Error al guardar')
  } finally {
    saving.value = false
  }
}

// ── Delete / Toggle ───────────────────────────────────────────────────────────

const deleting = ref<string | null>(null)

async function remove(item: Webhook) {
  if (!confirm(`¿Eliminar el webhook "${item.name}"?`)) return
  deleting.value = item.id
  try {
    await api.deleteWebhook(item.id)
    toast.success('Webhook eliminado')
    await fetchWebhooks()
  } catch (e: any) {
    toast.error(e.message || 'Error al eliminar')
  } finally {
    deleting.value = null
  }
}

async function toggleActive(item: Webhook) {
  try {
    await api.updateWebhook(item.id, { active: !item.active })
    toast.success(item.active ? 'Webhook desactivado' : 'Webhook activado')
    await fetchWebhooks()
  } catch (e: any) {
    toast.error(e.message || 'Error')
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function webhookUrl(item: Webhook): string {
  return `${__API_BASE__}/webhooks/trigger/${item.name}`
}

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${label} copiado`)
  } catch {
    toast.error('No se pudo copiar')
  }
}

function toggleSecret(id: string) {
  if (revealedSecrets.value.has(id)) {
    revealedSecrets.value.delete(id)
  } else {
    revealedSecrets.value.add(id)
  }
  revealedSecrets.value = new Set(revealedSecrets.value)
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchWebhooks() {
  loading.value = true
  try {
    const res = await api.getWebhooks()
    webhooks.value = res.data ?? []
  } catch (e: any) {
    toast.error(e.message || 'Error al cargar webhooks')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await fetchWebhooks()
  try {
    const [agentsRes, mcpRes, toolsRes] = await Promise.all([api.getAgents(), api.getMcpServers(), api.getAgentTools()])
    agents.value = agentsRes.data ?? []
    mcpServers.value = mcpRes.data ?? []
    availableTools.value = toolsRes.data ?? []
  } catch {
    /* non-critical */
  }
})
</script>

<template>

  <PageLayout title="Webhooks"
    description="Endpoints HTTP que ejecutan un agente, un tool MCP o el LLM directo (estilo OpenAI, con tools asignables) cuando son invocados desde sistemas externos.">
    <template #actions>
      <button v-if="canCreate" @click="openCreate"
        class="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors">
        <span class="mdi mdi-plus"></span> Nuevo Webhook
      </button>
    </template>



    <!-- Loading -->
    <div v-if="loading" class="flex items-center gap-3 text-base-content/60 py-12 justify-center">
      <span class="mdi mdi-loading mdi-spin text-2xl"></span>
      <span>Cargando webhooks...</span>
    </div>

    <!-- Empty state -->
    <div v-else-if="webhooks.length === 0" class="flex flex-col items-center gap-4 py-16 text-base-content/50">
      <span class="mdi mdi-webhook text-5xl"></span>
      <p class="text-lg">No hay webhooks registrados.</p>
      <button v-if="canCreate" @click="openCreate" class="text-indigo-400 hover:text-indigo-300 text-sm">
        Crear el primero
      </button>
    </div>

    <!-- List -->
    <div v-else class="space-y-3">
      <div v-for="item in webhooks" :key="item.id" class="bg-base-300 border border-base-300/60 rounded-xl p-5">
        <div class="flex items-start justify-between gap-4">
          <!-- Info left -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-3 mb-1">
              <span class="w-2 h-2 rounded-full shrink-0"
                :class="item.active ? 'bg-emerald-400' : 'bg-base-100'"></span>
              <h3 class="font-semibold text-base-content truncate">{{ item.name }}</h3>
              <span class="text-xs font-mono bg-base-200 text-base-content px-2 py-0.5 rounded">{{ item.method }}</span>
              <span v-if="item.authEnabled" title="Requiere X-Webhook-Secret"
                class="mdi mdi-lock-outline text-amber-300 text-sm"></span>
            </div>
            <p v-if="item.description" class="text-sm text-base-content/60 mb-1 truncate">{{ item.description }}</p>

            <!-- Target chip -->
            <div class="flex flex-wrap gap-2 mt-2 text-xs">
              <span v-if="item.targetType === 'agent'"
                class="bg-indigo-500/10 text-indigo-300 ring-1 ring-indigo-500/20 px-2 py-0.5 rounded">
                <span class="mdi mdi-robot-outline mr-1"></span>{{ item.targetName }}
              </span>
              <span v-else-if="item.targetType === 'llm'"
                class="bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20 px-2 py-0.5 rounded">
                <span class="mdi mdi-brain mr-1"></span>LLM directo (OpenAI)
              </span>
              <span v-else class="bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/20 px-2 py-0.5 rounded">
                <span class="mdi mdi-tools mr-1"></span>{{ item.extraData?.mcpServerName }} · {{ item.targetName }}
              </span>
            </div>

            <!-- URL + secret -->
            <div class="mt-3 space-y-1.5">
              <div class="flex items-center gap-2 text-xs">
                <code class="bg-base-200 px-2 py-1 rounded text-base-content/80 truncate">{{ webhookUrl(item) }}</code>
                <button @click="copyText(webhookUrl(item), 'URL')" title="Copiar URL"
                  class="text-base-content/50 hover:text-base-content transition-colors">
                  <span class="mdi mdi-content-copy"></span>
                </button>
              </div>
              <div v-if="item.authEnabled && item.secret" class="flex items-center gap-2 text-xs">
                <span class="text-base-content/50">Secret:</span>
                <code class="bg-base-200 px-2 py-1 rounded text-base-content/80 truncate">
              {{ revealedSecrets.has(item.id) ? item.secret : '••••••••••••••••' }}
            </code>
                <button @click="toggleSecret(item.id)" :title="revealedSecrets.has(item.id) ? 'Ocultar' : 'Mostrar'"
                  class="text-base-content/50 hover:text-base-content transition-colors">
                  <span class="mdi"
                    :class="revealedSecrets.has(item.id) ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"></span>
                </button>
                <button @click="copyText(item.secret, 'Secret')" title="Copiar secret"
                  class="text-base-content/50 hover:text-base-content transition-colors">
                  <span class="mdi mdi-content-copy"></span>
                </button>
              </div>
            </div>
          </div>

          <!-- Actions right -->
          <div class="flex items-center gap-2 shrink-0">
            <button v-if="canUpdate" @click="toggleActive(item)" :title="item.active ? 'Desactivar' : 'Activar'"
              class="p-1.5 rounded-lg transition-colors"
              :class="item.active ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-base-content/50 hover:bg-base-100'">
              <span class="mdi text-lg"
                :class="item.active ? 'mdi-toggle-switch' : 'mdi-toggle-switch-off-outline'"></span>
            </button>
            <button v-if="canUpdate" @click="openEdit(item)" title="Editar"
              class="p-1.5 rounded-lg text-base-content/60 hover:text-base-content hover:bg-base-100 transition-colors">
              <span class="mdi mdi-pencil-outline text-lg"></span>
            </button>
            <button v-if="canDelete" @click="remove(item)" :disabled="deleting === item.id" title="Eliminar"
              class="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40">
              <span class="mdi text-lg"
                :class="deleting === item.id ? 'mdi-loading mdi-spin' : 'mdi-trash-can-outline'"></span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Modal ──────────────────────────────────────────────────────────── -->
    <AppModal v-if="showModal" size="2xl" :title="editing ? 'Editar Webhook' : 'Nuevo Webhook'"
      @close="showModal = false">
      <div class="px-6 py-5 space-y-5 overflow-auto">
        <!-- Errors -->
        <div v-if="formErrors.length > 0" class="bg-red-500/10 border border-red-500/30 rounded-lg p-3 space-y-1">
          <p v-for="e in formErrors" :key="e" class="text-red-300 text-sm">{{ e }}</p>
        </div>

        <!-- Name + method -->
        <div class="grid grid-cols-3 gap-3">
          <div class="col-span-2">
            <label class="block text-sm text-base-content mb-1">Nombre <span class="text-red-400">*</span></label>
            <input v-model="form.name" type="text" placeholder="nuevo-pedido" :disabled="!!editing"
              class="w-full bg-base-200 border border-base-content/20 rounded-lg px-3 py-2 text-base-content font-mono text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50" />
            <p class="text-xs text-base-content/50 mt-1">Forma parte de la URL. Solo minúsculas, números, - y _</p>
          </div>
          <div>
            <label class="block text-sm text-base-content mb-1">Método HTTP</label>
            <select v-model="form.method"
              class="w-full bg-base-200 border border-base-content/20 rounded-lg px-3 py-2 text-base-content text-sm focus:outline-none focus:border-indigo-500">
              <option v-for="m in METHODS" :key="m" :value="m">{{ m }}</option>
            </select>
          </div>
        </div>

        <!-- Description -->
        <div>
          <label class="block text-sm text-base-content mb-1">Descripción</label>
          <input v-model="form.description" type="text" placeholder="Notifica al agente cuando llega un pedido"
            class="w-full bg-base-200 border border-base-content/20 rounded-lg px-3 py-2 text-base-content text-sm focus:outline-none focus:border-indigo-500" />
        </div>

        <!-- Target type -->
        <div class="border border-base-300 rounded-xl p-4 space-y-3 overflow-auto">
          <legend class="text-xs font-semibold text-base-content/60 px-1 uppercase tracking-wider">Destino</legend>
          <div class="flex gap-3">
            <button type="button" @click="form.targetType = 'agent'"
              class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors"
              :class="form.targetType === 'agent'
                ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                : 'border-base-content/20 text-base-content/60 hover:text-base-content'">
              <span class="mdi mdi-robot-outline"></span> Agente
            </button>
            <button type="button" @click="form.targetType = 'mcp_tool'"
              class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors"
              :class="form.targetType === 'mcp_tool'
                ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                : 'border-base-content/20 text-base-content/60 hover:text-base-content'">
              <span class="mdi mdi-tools"></span> Tool MCP
            </button>
            <button type="button" @click="form.targetType = 'llm'"
              class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors"
              :class="form.targetType === 'llm'
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                : 'border-base-content/20 text-base-content/60 hover:text-base-content'">
              <span class="mdi mdi-brain"></span> LLM
            </button>
          </div>

          <!-- Agent selector -->
          <div v-if="form.targetType === 'agent'">
            <label class="block text-sm text-base-content mb-1">Agente <span class="text-red-400">*</span></label>
            <select v-model="form.agentSlug"
              class="w-full bg-base-200 border border-base-content/20 rounded-lg px-3 py-2 text-base-content text-sm focus:outline-none focus:border-indigo-500">
              <option value="" disabled>Selecciona un agente...</option>
              <option v-for="agent in agents" :key="agent.id" :value="agent.slug">{{ agent.name }}</option>
            </select>
          </div>

          <!-- LLM selector -->
          <div v-else-if="form.targetType === 'llm'" class="space-y-3 w-full">
            <p class="text-xs text-base-content/50">
            </p>
            <div>
              <label class="block text-sm text-base-content mb-1">System prompt</label>
              <textarea v-model="form.systemPrompt" rows="4"
                placeholder="Instrucciones que se anteponen a cada solicitud..."
                class="w-full bg-base-200 border border-base-content/20 rounded-lg px-3 py-2 text-base-content text-sm focus:outline-none focus:border-emerald-500"></textarea>
            </div>
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="block text-sm text-base-content">Tools disponibles para el LLM</label>
                <span class="text-xs text-base-content/50">{{ selectedToolCount }} seleccionada(s)</span>
              </div>
              <label class="input w-full input-sm">
                <span class="mdi mdi-magnify"></span>
                <input type="text" class="grow  w-full" placeholder="Buscar..." v-model="llmToolSearch">
              </label>
              <div
                class="max-h-56 overflow-auto space-y-3 border border-base-content/10 rounded-lg p-3 bg-base-200/40 w-auto">
                <div v-for="group in toolGroups" :key="group.key">
                  <p class="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-1">{{ group.key }}
                  </p>
                  <label v-for="tool in group.tools" :key="tool.name"
                    class="flex items-start gap-2 py-1 cursor-pointer hover:bg-base-200/60 rounded px-1">
                    <input type="checkbox" v-model="form.tools[tool.name]"
                      class="w-4 h-4 mt-0.5 rounded accent-emerald-500" />
                    <span class="min-w-0 truncate w-full">
                      <span class="block text-sm text-base-content truncate">{{ tool.name }}</span>
                      <span v-if="tool.description" class="block text-xs text-base-content/50 truncate">{{
                        tool.description }}</span>
                    </span>
                  </label>
                </div>
                <p v-if="toolGroups.length === 0" class="text-xs text-base-content/50 py-2">No hay tools disponibles.
                </p>
              </div>
            </div>
          </div>

          <!-- Tool selector -->
          <template v-else>
            <div>
              <label class="block text-sm text-base-content mb-1">Servidor MCP <span
                  class="text-red-400">*</span></label>
              <select v-model="form.mcpServerId" @change="onMcpServerChange(form.mcpServerId)"
                class="w-full bg-base-200 border border-base-content/20 rounded-lg px-3 py-2 text-base-content text-sm focus:outline-none focus:border-indigo-500">
                <option value="" disabled>Selecciona un servidor...</option>
                <option v-for="server in mcpServers" :key="server.id" :value="server.id">{{ server.name }}</option>
              </select>
            </div>
            <div>
              <label class="block text-sm text-base-content mb-1">Tool <span class="text-red-400">*</span></label>
              <div v-if="loadingMcpTools" class="flex items-center gap-2 text-base-content/50 text-sm py-2">
                <span class="mdi mdi-loading mdi-spin"></span> Cargando tools...
              </div>
              <select v-else v-model="form.toolName"
                class="w-full bg-base-200 border border-base-content/20 rounded-lg px-3 py-2 text-base-content text-sm focus:outline-none focus:border-indigo-500">
                <option value="" disabled>Selecciona un tool...</option>
                <option v-for="tool in mcpToolsForServer" :key="tool.toolName" :value="tool.toolName">
                  {{ tool.toolName }}
                </option>
              </select>
            </div>
          </template>
        </div>

        <!-- Toggles -->
        <div class="space-y-2">
          <div class="flex items-center gap-3">
            <input id="wh-auth" v-model="form.authEnabled" type="checkbox" class="w-4 h-4 rounded accent-indigo-500" />
            <label for="wh-auth" class="text-sm text-base-content cursor-pointer">Requiere autenticación</label>
          </div>
          <p v-if="form.authEnabled" class="text-xs text-base-content/50 ml-7">
            Se generará un token secreto; el llamador deberá enviarlo en el header
            <code class="bg-base-200 px-1 rounded">X-Webhook-Secret</code>.
          </p>
          <div class="flex items-center gap-3">
            <input id="wh-active" v-model="form.active" type="checkbox" class="w-4 h-4 rounded accent-indigo-500" />
            <label for="wh-active" class="text-sm text-base-content cursor-pointer">Activo</label>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-3">
          <button @click="showModal = false"
            class="px-4 py-2 rounded-lg text-base-content/60 hover:text-base-content hover:bg-base-200 text-sm transition-colors">
            Cancelar
          </button>
          <button @click="save" :disabled="saving"
            class="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50">
            <span v-if="saving" class="mdi mdi-loading mdi-spin mr-1"></span>
            {{ editing ? 'Guardar cambios' : 'Crear webhook' }}
          </button>
        </div>
      </template>
    </AppModal>
  </PageLayout>
</template>
