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

interface ContractField {
  name: string
  type: string
  required: boolean
  description?: string
  enumValues?: string[]
}

interface WebhookGroup {
  id: string
  name: string
  description?: string | null
  authEnabled: boolean
  secret?: string | null
  active: boolean
}

interface Webhook {
  id: string
  groupId: string
  name: string
  description?: string | null
  method: string
  targetType: 'agent' | 'mcp_tool' | 'llm'
  targetId: string
  targetName: string
  extraData?: Record<string, string> | null
  contract?: ContractField[] | null
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
  inputSchema?: any
}

interface AvailableTool {
  name: string
  description: string
  source: string
}

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

const apiBase = __API_BASE__

// ── Permissions ───────────────────────────────────────────────────────────────

const canCreate = computed(() => auth.hasPermission('webhooks', 'create'))
const canUpdate = computed(() => auth.hasPermission('webhooks', 'update'))
const canDelete = computed(() => auth.hasPermission('webhooks', 'delete'))

// ── State ─────────────────────────────────────────────────────────────────────

const groups = ref<WebhookGroup[]>([])
const webhooks = ref<Webhook[]>([])
const loading = ref(false)
const agents = ref<Agent[]>([])
const mcpServers = ref<any[]>([])
const availableTools = ref<AvailableTool[]>([])
const revealedSecrets = ref<Set<string>>(new Set())
const collapsedGroups = ref<Set<string>>(new Set())
const expandedContracts = ref<Set<string>>(new Set())

const webhooksByGroup = computed(() => {
  const byGroup: Record<string, Webhook[]> = {}
  for (const group of groups.value) byGroup[group.id] = []
  for (const webhook of webhooks.value) {
    if (!byGroup[webhook.groupId]) byGroup[webhook.groupId] = []
    byGroup[webhook.groupId].push(webhook)
  }
  return byGroup
})

// ── Group form / modal ────────────────────────────────────────────────────────

const showGroupModal = ref(false)
const editingGroup = ref<WebhookGroup | null>(null)
const savingGroup = ref(false)
const groupErrors = ref<string[]>([])
const groupForm = ref({ name: '', description: '', authEnabled: true, active: true })

function openCreateGroup() {
  editingGroup.value = null
  groupForm.value = { name: '', description: '', authEnabled: true, active: true }
  groupErrors.value = []
  showGroupModal.value = true
}

function openEditGroup(group: WebhookGroup) {
  editingGroup.value = group
  groupForm.value = {
    name: group.name,
    description: group.description ?? '',
    authEnabled: group.authEnabled,
    active: group.active
  }
  groupErrors.value = []
  showGroupModal.value = true
}

async function saveGroup() {
  const errors: string[] = []
  const name = groupForm.value.name.trim()
  if (!name) errors.push('El nombre es requerido.')
  else if (!/^[a-z0-9_-]+$/.test(name)) errors.push('El nombre solo admite minúsculas, números, guiones y guiones bajos.')
  groupErrors.value = errors
  if (errors.length > 0) return

  savingGroup.value = true
  try {
    const payload = {
      description: groupForm.value.description.trim() || undefined,
      authEnabled: groupForm.value.authEnabled,
      active: groupForm.value.active
    }
    if (editingGroup.value) {
      const res = await api.updateWebhookGroup(editingGroup.value.id, payload)
      if (!res.success) throw new Error((res as any).error)
      toast.success('Grupo actualizado')
    } else {
      const res = await api.createWebhookGroup({ name, ...payload })
      if (!res.success) throw new Error((res as any).error)
      toast.success('Grupo creado')
    }
    showGroupModal.value = false
    await fetchAll()
  } catch (e: any) {
    toast.error(e.message || 'Error al guardar el grupo')
  } finally {
    savingGroup.value = false
  }
}

const deletingGroup = ref<string | null>(null)

async function removeGroup(group: WebhookGroup) {
  const count = (webhooksByGroup.value[group.id] ?? []).length
  if (count > 0) {
    toast.error(`El grupo tiene ${count} webhook(s); elimínalos primero.`)
    return
  }
  if (!confirm(`¿Eliminar el grupo "${group.name}"?`)) return
  deletingGroup.value = group.id
  try {
    const res = await api.deleteWebhookGroup(group.id)
    if (!res.success) throw new Error((res as any).error)
    toast.success('Grupo eliminado')
    await fetchAll()
  } catch (e: any) {
    toast.error(e.message || 'Error al eliminar el grupo')
  } finally {
    deletingGroup.value = null
  }
}

async function toggleGroupActive(group: WebhookGroup) {
  try {
    await api.updateWebhookGroup(group.id, { active: !group.active })
    toast.success(group.active ? 'Grupo desactivado' : 'Grupo activado')
    await fetchAll()
  } catch (e: any) {
    toast.error(e.message || 'Error')
  }
}

function toggleGroupCollapse(id: string) {
  if (collapsedGroups.value.has(id)) collapsedGroups.value.delete(id)
  else collapsedGroups.value.add(id)
  collapsedGroups.value = new Set(collapsedGroups.value)
}

// ── Webhook form / modal ──────────────────────────────────────────────────────

const showModal = ref(false)
const llmToolSearch = ref<string>('')
const editing = ref<Webhook | null>(null)
const saving = ref(false)
const formErrors = ref<string[]>([])

const mcpToolsForServer = ref<McpTool[]>([])
const loadingMcpTools = ref(false)

const emptyForm = () => ({
  groupId: '',
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

const selectedGroupHasSecret = computed(() => groups.value.find((g) => g.id === form.value.groupId)?.authEnabled === true)

/** Aplana el inputSchema (JSON Schema) de la tool en los campos del contrato del endpoint. */
function contractFromSchema(schema: any): ContractField[] {
  const properties = schema?.properties
  if (!properties) return []
  const required = new Set<string>(Array.isArray(schema.required) ? schema.required : [])
  return Object.entries(properties).map(([name, prop]: [string, any]) => ({
    name,
    type: schemaType(prop),
    required: required.has(name),
    description: typeof prop?.description === 'string' ? prop.description : undefined,
    enumValues: Array.isArray(prop?.enum) ? prop.enum.map(String) : undefined
  }))
}

function schemaType(prop: any): string {
  if (typeof prop?.type === 'string') return prop.type
  if (Array.isArray(prop?.type)) return prop.type.filter((t: string) => t !== 'null').join('|') || 'any'
  if (Array.isArray(prop?.anyOf)) {
    const types = prop.anyOf.map((s: any) => schemaType(s)).filter((t: string) => t !== 'null')
    return [...new Set<string>(types)].join('|') || 'any'
  }
  return 'any'
}

/** Contrato del tool seleccionado en el modal (previsualización antes de guardar). */
const formContract = computed<ContractField[]>(() => {
  if (form.value.targetType !== 'mcp_tool' || !form.value.toolName) return []
  const tool = mcpToolsForServer.value.find((t) => t.toolName === form.value.toolName)
  return contractFromSchema(tool?.inputSchema)
})

function samplePayload(fields: ContractField[]): string {
  const sample: Record<string, unknown> = {}
  for (const field of fields.filter((f) => f.required)) sample[field.name] = placeholder(field)
  return JSON.stringify(sample, null, 2)
}

function placeholder(field: ContractField): unknown {
  if (field.enumValues?.length) return field.enumValues[0]
  switch (field.type) {
    case 'number':
    case 'integer':
      return 0
    case 'boolean':
      return true
    case 'array':
      return []
    case 'object':
      return {}
    default:
      return `<${field.type}>`
  }
}

function openCreate(groupId?: string) {
  editing.value = null
  form.value = emptyForm()
  form.value.groupId = groupId ?? groups.value.find((g) => g.active)?.id ?? groups.value[0]?.id ?? ''
  formErrors.value = []
  mcpToolsForServer.value = []
  showModal.value = true
}

async function openEdit(item: Webhook) {
  editing.value = item
  form.value = {
    groupId: item.groupId,
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
  if (!form.value.groupId) errors.push('Selecciona un grupo.')
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
    groupId: form.value.groupId,
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
    await fetchAll()
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
    await fetchAll()
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
    await fetchAll()
  } catch (e: any) {
    toast.error(e.message || 'Error')
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupBaseUrl(group: WebhookGroup): string {
  return `${apiBase}/${group.name}`
}

function webhookUrl(group: WebhookGroup, item: Webhook): string {
  return `${groupBaseUrl(group)}/${item.name}`
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

function toggleContract(id: string) {
  if (expandedContracts.value.has(id)) expandedContracts.value.delete(id)
  else expandedContracts.value.add(id)
  expandedContracts.value = new Set(expandedContracts.value)
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchAll() {
  loading.value = true
  try {
    const [groupsRes, webhooksRes] = await Promise.all([api.getWebhookGroups(), api.getWebhooks()])
    groups.value = groupsRes.data ?? []
    webhooks.value = webhooksRes.data ?? []
  } catch (e: any) {
    toast.error(e.message || 'Error al cargar webhooks')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await fetchAll()
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
    description="Grupos de endpoints HTTP. El nombre del grupo abre la ruta (/<grupo>/<webhook>) y cada webhook ejecuta un agente, un tool MCP o el LLM directo cuando es invocado desde sistemas externos.">
    <template #actions>
      <button v-if="canCreate" @click="openCreateGroup"
        class="flex items-center gap-2 px-4 py-2 rounded-lg border border-base-content/20 hover:bg-base-200 text-base-content text-sm font-medium transition-colors">
        <span class="mdi mdi-folder-plus-outline"></span> Nuevo Grupo
      </button>
      <button v-if="canCreate" @click="openCreate()" :disabled="groups.length === 0"
        class="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-40">
        <span class="mdi mdi-plus"></span> Nuevo Webhook
      </button>
    </template>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center gap-3 text-base-content/60 py-12 justify-center">
      <span class="mdi mdi-loading mdi-spin text-2xl"></span>
      <span>Cargando webhooks...</span>
    </div>

    <!-- Empty state -->
    <div v-else-if="groups.length === 0" class="flex flex-col items-center gap-4 py-16 text-base-content/50">
      <span class="mdi mdi-folder-outline text-5xl"></span>
      <p class="text-lg">No hay grupos de webhooks.</p>
      <p class="text-sm">Crea un grupo primero: su nombre es la raíz de la URL de los webhooks que contenga.</p>
      <button v-if="canCreate" @click="openCreateGroup" class="text-indigo-400 hover:text-indigo-300 text-sm">
        Crear el primer grupo
      </button>
    </div>

    <!-- Groups -->
    <div v-else class="space-y-4">
      <div v-for="group in groups" :key="group.id" class="bg-base-300/40 border border-base-300/60 rounded-xl">

        <!-- Group header -->
        <div class="flex items-start justify-between gap-4 p-4">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-3">
              <button @click="toggleGroupCollapse(group.id)"
                class="text-base-content/50 hover:text-base-content transition-colors">
                <span class="mdi text-lg"
                  :class="collapsedGroups.has(group.id) ? 'mdi-chevron-right' : 'mdi-chevron-down'"></span>
              </button>
              <span class="w-2 h-2 rounded-full shrink-0" :class="group.active ? 'bg-emerald-400' : 'bg-base-100'"></span>
              <span class="mdi mdi-folder-outline text-base-content/60"></span>
              <h3 class="font-semibold text-base-content truncate">{{ group.name }}</h3>
              <span class="text-xs bg-base-200 text-base-content/70 px-2 py-0.5 rounded">
                {{ (webhooksByGroup[group.id] ?? []).length }} webhook(s)
              </span>
              <span v-if="group.authEnabled" title="Todos sus webhooks se llaman con el secret del grupo"
                class="mdi mdi-key-outline text-amber-300 text-sm"></span>
            </div>
            <p v-if="group.description" class="text-sm text-base-content/60 mt-1 ml-9 truncate">{{ group.description }}</p>
            <div class="flex items-center gap-2 text-xs mt-2 ml-9">
              <code class="bg-base-200 px-2 py-1 rounded text-base-content/80 truncate">{{ groupBaseUrl(group) }}/…</code>
              <button @click="copyText(groupBaseUrl(group), 'URL base')" title="Copiar URL base"
                class="text-base-content/50 hover:text-base-content transition-colors">
                <span class="mdi mdi-content-copy"></span>
              </button>
            </div>
            <div v-if="group.authEnabled && group.secret" class="flex items-center gap-2 text-xs mt-1.5 ml-9">
              <span class="text-base-content/50">Secret del grupo:</span>
              <code class="bg-base-200 px-2 py-1 rounded text-base-content/80 truncate">
                {{ revealedSecrets.has(group.id) ? group.secret : '••••••••••••••••' }}
              </code>
              <button @click="toggleSecret(group.id)" :title="revealedSecrets.has(group.id) ? 'Ocultar' : 'Mostrar'"
                class="text-base-content/50 hover:text-base-content transition-colors">
                <span class="mdi" :class="revealedSecrets.has(group.id) ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"></span>
              </button>
              <button @click="copyText(group.secret, 'Secret del grupo')" title="Copiar secret"
                class="text-base-content/50 hover:text-base-content transition-colors">
                <span class="mdi mdi-content-copy"></span>
              </button>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <a :href="groupBaseUrl(group)" target="_blank" rel="noopener"
              title="Ver la documentación (Scalar) de los endpoints del grupo"
              class="p-1.5 rounded-lg text-base-content/60 hover:text-base-content hover:bg-base-100 transition-colors">
              <span class="mdi mdi-book-open-page-variant-outline text-lg"></span>
            </a>
            <button v-if="canCreate" @click="openCreate(group.id)" title="Agregar webhook a este grupo"
              class="p-1.5 rounded-lg text-indigo-400 hover:bg-indigo-500/10 transition-colors">
              <span class="mdi mdi-plus text-lg"></span>
            </button>
            <button v-if="canUpdate" @click="toggleGroupActive(group)" :title="group.active ? 'Desactivar' : 'Activar'"
              class="p-1.5 rounded-lg transition-colors"
              :class="group.active ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-base-content/50 hover:bg-base-100'">
              <span class="mdi text-lg"
                :class="group.active ? 'mdi-toggle-switch' : 'mdi-toggle-switch-off-outline'"></span>
            </button>
            <button v-if="canUpdate" @click="openEditGroup(group)" title="Editar grupo"
              class="p-1.5 rounded-lg text-base-content/60 hover:text-base-content hover:bg-base-100 transition-colors">
              <span class="mdi mdi-pencil-outline text-lg"></span>
            </button>
            <button v-if="canDelete" @click="removeGroup(group)" :disabled="deletingGroup === group.id"
              title="Eliminar grupo"
              class="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40">
              <span class="mdi text-lg"
                :class="deletingGroup === group.id ? 'mdi-loading mdi-spin' : 'mdi-trash-can-outline'"></span>
            </button>
          </div>
        </div>

        <!-- Webhooks inside the group -->
        <div v-if="!collapsedGroups.has(group.id)" class="px-4 pb-4 space-y-3">
          <p v-if="(webhooksByGroup[group.id] ?? []).length === 0" class="text-sm text-base-content/50 pl-9 py-2">
            Este grupo no tiene webhooks.
          </p>

          <div v-for="item in (webhooksByGroup[group.id] ?? [])" :key="item.id"
            class="bg-base-300 border border-base-300/60 rounded-xl p-5 ml-0 sm:ml-9">
            <div class="flex items-start justify-between gap-4">
              <!-- Info left -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-3 mb-1">
                  <span class="w-2 h-2 rounded-full shrink-0"
                    :class="item.active ? 'bg-emerald-400' : 'bg-base-100'"></span>
                  <h4 class="font-semibold text-base-content truncate">{{ item.name }}</h4>
                  <span class="text-xs font-mono bg-base-200 text-base-content px-2 py-0.5 rounded">{{ item.method
                    }}</span>
                  <span v-if="group.authEnabled || item.authEnabled" title="Requiere X-Webhook-Secret"
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
                  <span v-if="item.contract?.length"
                    class="bg-base-200 text-base-content/70 px-2 py-0.5 rounded ring-1 ring-base-content/10">
                    <span class="mdi mdi-form-select mr-1"></span>
                    {{ item.contract.filter(f => f.required).length }} requerido(s) ·
                    {{ item.contract.filter(f => !f.required).length }} opcional(es)
                  </span>
                </div>

                <!-- URL + secret -->
                <div class="mt-3 space-y-1.5">
                  <div class="flex items-center gap-2 text-xs">
                    <code class="bg-base-200 px-2 py-1 rounded text-base-content/80 truncate">{{ webhookUrl(group, item)
                      }}</code>
                    <button @click="copyText(webhookUrl(group, item), 'URL')" title="Copiar URL"
                      class="text-base-content/50 hover:text-base-content transition-colors">
                      <span class="mdi mdi-content-copy"></span>
                    </button>
                  </div>
                  <p v-if="group.authEnabled" class="text-xs text-base-content/50">
                    <span class="mdi mdi-key-outline mr-1"></span>Se llama con el secret del grupo.
                  </p>
                  <div v-else-if="item.authEnabled && item.secret" class="flex items-center gap-2 text-xs">
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

                <!-- Contract -->
                <div v-if="item.contract?.length" class="mt-3">
                  <button @click="toggleContract(item.id)"
                    class="flex items-center gap-1.5 text-xs text-base-content/60 hover:text-base-content transition-colors">
                    <span class="mdi"
                      :class="expandedContracts.has(item.id) ? 'mdi-chevron-down' : 'mdi-chevron-right'"></span>
                    Contrato de entrada ({{ item.contract.length }} campos)
                  </button>

                  <div v-if="expandedContracts.has(item.id)"
                    class="mt-2 border border-base-content/10 rounded-lg overflow-hidden">
                    <table class="w-full text-xs">
                      <thead class="bg-base-200/60 text-base-content/60">
                        <tr>
                          <th class="text-left font-medium px-3 py-2">Campo</th>
                          <th class="text-left font-medium px-3 py-2">Tipo</th>
                          <th class="text-left font-medium px-3 py-2">Obligatoriedad</th>
                          <th class="text-left font-medium px-3 py-2">Descripción</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="field in item.contract" :key="field.name" class="border-t border-base-content/10">
                          <td class="px-3 py-2 font-mono text-base-content">{{ field.name }}</td>
                          <td class="px-3 py-2 text-base-content/70 font-mono">{{ field.type }}</td>
                          <td class="px-3 py-2">
                            <span v-if="field.required"
                              class="bg-red-500/10 text-red-300 ring-1 ring-red-500/20 px-2 py-0.5 rounded">requerido</span>
                            <span v-else
                              class="bg-base-200 text-base-content/60 ring-1 ring-base-content/10 px-2 py-0.5 rounded">opcional</span>
                          </td>
                          <td class="px-3 py-2 text-base-content/60">
                            {{ field.description || '—' }}
                            <span v-if="field.enumValues?.length" class="block text-base-content/50 font-mono">
                              {{ field.enumValues.join(' | ') }}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
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
      </div>
    </div>

    <!-- ── Group modal ────────────────────────────────────────────────────── -->
    <AppModal v-if="showGroupModal" size="lg" :title="editingGroup ? 'Editar Grupo' : 'Nuevo Grupo'"
      @close="showGroupModal = false">
      <div class="px-6 py-5 space-y-5">
        <div v-if="groupErrors.length > 0" class="bg-red-500/10 border border-red-500/30 rounded-lg p-3 space-y-1">
          <p v-for="e in groupErrors" :key="e" class="text-red-300 text-sm">{{ e }}</p>
        </div>

        <div>
          <label class="block text-sm text-base-content mb-1">Nombre <span class="text-red-400">*</span></label>
          <input v-model="groupForm.name" type="text" placeholder="ejemplo" :disabled="!!editingGroup"
            class="w-full bg-base-200 border border-base-content/20 rounded-lg px-3 py-2 text-base-content font-mono text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50" />
          <p class="text-xs text-base-content/50 mt-1">
            Es la raíz de la URL de sus webhooks: <code class="bg-base-200 px-1 rounded">{{ apiBase }}/{{
              groupForm.name || '<grupo>' }}/&lt;webhook&gt;</code>
          </p>
        </div>

        <div>
          <label class="block text-sm text-base-content mb-1">Descripción</label>
          <input v-model="groupForm.description" type="text" placeholder="Endpoints del sistema de pedidos"
            class="w-full bg-base-200 border border-base-content/20 rounded-lg px-3 py-2 text-base-content text-sm focus:outline-none focus:border-indigo-500" />
        </div>

        <div class="space-y-2">
          <div class="flex items-center gap-3">
            <input id="wg-auth" v-model="groupForm.authEnabled" type="checkbox"
              class="w-4 h-4 rounded accent-indigo-500" />
            <label for="wg-auth" class="text-sm text-base-content cursor-pointer">Secret del grupo</label>
          </div>
          <p v-if="groupForm.authEnabled" class="text-xs text-base-content/50 ml-7">
            Se genera un único token secreto para todo el grupo: todos sus webhooks se llaman con él en el header
            <code class="bg-base-200 px-1 rounded">X-Webhook-Secret</code>.
            <span class="text-amber-300">Reemplaza a los secrets individuales de sus webhooks, que dejan de ser
              aceptados.</span>
          </p>
          <p v-else class="text-xs text-base-content/50 ml-7">
            Sin secret de grupo, cada webhook se autentica con su propio secret.
          </p>
        </div>

        <div class="flex items-center gap-3">
          <input id="wg-active" v-model="groupForm.active" type="checkbox" class="w-4 h-4 rounded accent-indigo-500" />
          <label for="wg-active" class="text-sm text-base-content cursor-pointer">Activo</label>
        </div>
        <p class="text-xs text-base-content/50">
          Si el grupo está inactivo, todos sus webhooks responden 404.
        </p>
      </div>

      <template #footer>
        <div class="flex justify-end gap-3">
          <button @click="showGroupModal = false"
            class="px-4 py-2 rounded-lg text-base-content/60 hover:text-base-content hover:bg-base-200 text-sm transition-colors">
            Cancelar
          </button>
          <button @click="saveGroup" :disabled="savingGroup"
            class="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50">
            <span v-if="savingGroup" class="mdi mdi-loading mdi-spin mr-1"></span>
            {{ editingGroup ? 'Guardar cambios' : 'Crear grupo' }}
          </button>
        </div>
      </template>
    </AppModal>

    <!-- ── Webhook modal ──────────────────────────────────────────────────── -->
    <AppModal v-if="showModal" size="2xl" :title="editing ? 'Editar Webhook' : 'Nuevo Webhook'"
      @close="showModal = false">
      <div class="px-6 py-5 space-y-5 overflow-auto">
        <!-- Errors -->
        <div v-if="formErrors.length > 0" class="bg-red-500/10 border border-red-500/30 rounded-lg p-3 space-y-1">
          <p v-for="e in formErrors" :key="e" class="text-red-300 text-sm">{{ e }}</p>
        </div>

        <!-- Group -->
        <div>
          <label class="block text-sm text-base-content mb-1">Grupo <span class="text-red-400">*</span></label>
          <select v-model="form.groupId"
            class="w-full bg-base-200 border border-base-content/20 rounded-lg px-3 py-2 text-base-content text-sm focus:outline-none focus:border-indigo-500">
            <option value="" disabled>Selecciona un grupo...</option>
            <option v-for="group in groups" :key="group.id" :value="group.id">{{ group.name }}</option>
          </select>
        </div>

        <!-- Name + method -->
        <div class="grid grid-cols-3 gap-3">
          <div class="col-span-2">
            <label class="block text-sm text-base-content mb-1">Nombre <span class="text-red-400">*</span></label>
            <input v-model="form.name" type="text" placeholder="nuevo-pedido" :disabled="!!editing"
              class="w-full bg-base-200 border border-base-content/20 rounded-lg px-3 py-2 text-base-content font-mono text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50" />
            <p class="text-xs text-base-content/50 mt-1">Solo minúsculas, números, - y _</p>
          </div>
          <div>
            <label class="block text-sm text-base-content mb-1">Método HTTP</label>
            <select v-model="form.method"
              class="w-full bg-base-200 border border-base-content/20 rounded-lg px-3 py-2 text-base-content text-sm focus:outline-none focus:border-indigo-500">
              <option v-for="m in METHODS" :key="m" :value="m">{{ m }}</option>
            </select>
          </div>
        </div>

        <!-- Resulting URL -->
        <p class="text-xs text-base-content/50">
          URL resultante:
          <code class="bg-base-200 px-1 rounded">{{ apiBase }}/{{ groups.find(g => g.id === form.groupId)?.name ||
            '<grupo>' }}/{{ form.name || '&lt;webhook&gt;' }}</code>
        </p>

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

            <!-- Contract preview -->
            <div v-if="form.toolName" class="space-y-2">
              <div class="flex items-center justify-between">
                <label class="block text-sm text-base-content">Contrato del endpoint</label>
                <span class="text-xs text-base-content/50">
                  {{ formContract.filter(f => f.required).length }} requerido(s) ·
                  {{ formContract.filter(f => !f.required).length }} opcional(es)
                </span>
              </div>
              <p class="text-xs text-base-content/50">
                Se toma de los campos del tool. El endpoint rechaza con 400 los payloads que no cumplan.
              </p>

              <div v-if="formContract.length > 0" class="border border-base-content/10 rounded-lg overflow-hidden">
                <table class="w-full text-xs">
                  <thead class="bg-base-200/60 text-base-content/60">
                    <tr>
                      <th class="text-left font-medium px-3 py-2">Campo</th>
                      <th class="text-left font-medium px-3 py-2">Tipo</th>
                      <th class="text-left font-medium px-3 py-2">Obligatoriedad</th>
                      <th class="text-left font-medium px-3 py-2">Descripción</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="field in formContract" :key="field.name" class="border-t border-base-content/10">
                      <td class="px-3 py-2 font-mono text-base-content">{{ field.name }}</td>
                      <td class="px-3 py-2 text-base-content/70 font-mono">{{ field.type }}</td>
                      <td class="px-3 py-2">
                        <span v-if="field.required"
                          class="bg-red-500/10 text-red-300 ring-1 ring-red-500/20 px-2 py-0.5 rounded">requerido</span>
                        <span v-else
                          class="bg-base-200 text-base-content/60 ring-1 ring-base-content/10 px-2 py-0.5 rounded">opcional</span>
                      </td>
                      <td class="px-3 py-2 text-base-content/60">
                        {{ field.description || '—' }}
                        <span v-if="field.enumValues?.length" class="block text-base-content/50 font-mono">
                          {{ field.enumValues.join(' | ') }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p v-else class="text-xs text-base-content/50">Este tool no recibe parámetros.</p>

              <div v-if="formContract.some(f => f.required)">
                <p class="text-xs text-base-content/50 mb-1">
                  {{ form.method === 'GET' || form.method === 'DELETE' ? 'Los campos se envían como query string.' :
                    'Ejemplo de body:' }}
                </p>
                <pre v-if="form.method !== 'GET' && form.method !== 'DELETE'"
                  class="bg-base-200 rounded-lg p-3 text-xs text-base-content/80 overflow-auto">{{ samplePayload(formContract) }}</pre>
              </div>
            </div>
          </template>
        </div>

        <!-- Toggles -->
        <div class="space-y-2">
          <p v-if="selectedGroupHasSecret" class="text-xs text-base-content/60">
            <span class="mdi mdi-key-outline mr-1 text-amber-300"></span>
            El grupo <code class="bg-base-200 px-1 rounded">{{ groups.find(g => g.id === form.groupId)?.name }}</code>
            tiene secret propio: este webhook se llama con el secret del grupo.
          </p>
          <template v-else>
            <div class="flex items-center gap-3">
              <input id="wh-auth" v-model="form.authEnabled" type="checkbox"
                class="w-4 h-4 rounded accent-indigo-500" />
              <label for="wh-auth" class="text-sm text-base-content cursor-pointer">Requiere autenticación</label>
            </div>
            <p v-if="form.authEnabled" class="text-xs text-base-content/50 ml-7">
              Se generará un token secreto; el llamador deberá enviarlo en el header
              <code class="bg-base-200 px-1 rounded">X-Webhook-Secret</code>.
            </p>
          </template>
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
