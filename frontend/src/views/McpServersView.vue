<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import PageLayout from '@/components/PageLayout.vue'
import { useToastStore } from '@/store/useToast'
import * as api from '@/api/api'
import type { McpServer, CredentialField } from '@/types/types'

const toast = useToastStore()

const servers = ref<McpServer[]>([])
const loading = ref(false)
const connectionStatus = ref<Record<string, 'connected' | 'disconnected' | 'checking'>>({})
const reconnecting = ref<Record<string, boolean>>({})

// ── Tools panel ───────────────────────────────────────────────────────────────
interface McpToolMeta {
  toolName: string
  description: string
  inputSchema: Record<string, any>
}

const toolsPanelServer = ref<McpServer | null>(null)
const toolsList = ref<McpToolMeta[]>([])
const toolsLoading = ref(false)

async function openToolsPanel(server: McpServer) {
  toolsPanelServer.value = server
  toolsList.value = []
  toolsLoading.value = true
  try {
    const res = await api.getMcpServerTools(server.id)
    toolsList.value = res.data ?? []
  } catch (e: any) {
    toast.error(e.message ?? 'Failed to load tools')
  } finally {
    toolsLoading.value = false
  }
}

function closeToolsPanel() {
  toolsPanelServer.value = null
  toolsList.value = []
  callResult.value = null
  callError.value = null
}

// ── Tool call modal ───────────────────────────────────────────────────────────
const callingTool = ref<McpToolMeta | null>(null)
const callArgs = ref<Record<string, string>>({})
const callRunning = ref(false)
const callResult = ref<string | null>(null)
const callError = ref<string | null>(null)

function schemaProperties(tool: McpToolMeta): Array<{ key: string; schema: any }> {
  const props = tool.inputSchema?.properties ?? {}
  return Object.entries(props).map(([key, schema]) => ({ key, schema: schema as any }))
}

function requiredFields(tool: McpToolMeta): string[] {
  return tool.inputSchema?.required ?? []
}

function openCallModal(tool: McpToolMeta) {
  callingTool.value = tool
  callResult.value = null
  callError.value = null
  // Initialize args with empty strings
  const initialArgs: Record<string, string> = {}
  for (const { key } of schemaProperties(tool)) {
    initialArgs[key] = ''
  }
  callArgs.value = initialArgs
}

function closeCallModal() {
  callingTool.value = null
  callArgs.value = {}
  callResult.value = null
  callError.value = null
}

async function executeTool() {
  if (!callingTool.value || !toolsPanelServer.value) return
  callRunning.value = true
  callResult.value = null
  callError.value = null
  try {
    // Build args: only include non-empty values, parse JSON for object/array fields
    const args: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(callArgs.value)) {
      if (val === '') continue
      const propSchema = callingTool.value.inputSchema?.properties?.[key]
      const type = propSchema?.type
      if (type === 'number' || type === 'integer') {
        args[key] = Number(val)
      } else if (type === 'boolean') {
        args[key] = val === 'true'
      } else if (type === 'object' || type === 'array') {
        try { args[key] = JSON.parse(val) } catch { args[key] = val }
      } else {
        args[key] = val
      }
    }
    const res = await api.callMcpServerTool(toolsPanelServer.value.id, callingTool.value.toolName, args)
    callResult.value = typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2)
  } catch (e: any) {
    callError.value = e.message ?? 'Tool call failed'
  } finally {
    callRunning.value = false
  }
}

const formattedResult = computed(() => {
  if (!callResult.value) return ''
  try { return JSON.stringify(JSON.parse(callResult.value), null, 2) } catch { return callResult.value }
})

// Modal
const showModal = ref(false)
const editingServer = ref<McpServer | null>(null)
const saving = ref(false)

interface ServerForm {
  name: string
  displayName: string
  description: string
  type: 'http' | 'stdio' | 'local'
  url: string
  command: string
  args: string
  active: boolean
  credentialFields: CredentialField[]
}

const defaultForm = (): ServerForm => ({
  name: '',
  displayName: '',
  description: '',
  type: 'http',
  url: '',
  command: '',
  args: '',
  active: true,
  credentialFields: [],
})

const form = ref<ServerForm>(defaultForm())

function addCredentialField() {
  form.value.credentialFields.push({ key: '', description: '' })
}

function removeCredentialField(index: number) {
  form.value.credentialFields.splice(index, 1)
}

// Delete
const deleteTarget = ref<McpServer | null>(null)
const deleting = ref(false)

async function fetchServers() {
  loading.value = true
  try {
    const res = await api.getMcpServers()
    servers.value = res.data ?? (res as any)
    fetchStatuses()
  } catch (e: any) {
    toast.error(e.message ?? 'Failed to load MCP servers')
  } finally {
    loading.value = false
  }
}

async function fetchStatuses() {
  for (const server of servers.value) {
    connectionStatus.value[server.id] = 'checking'
    api.getMcpServerStatus(server.id)
      .then((res) => {
        connectionStatus.value[server.id] = res.data.connected ? 'connected' : 'disconnected'
      })
      .catch(() => {
        connectionStatus.value[server.id] = 'disconnected'
      })
  }
}

async function reconnect(server: McpServer) {
  reconnecting.value[server.id] = true
  try {
    const res = await api.reconnectMcpServer(server.id)
    connectionStatus.value[server.id] = res.data.connected ? 'connected' : 'disconnected'
    toast.success(`${server.displayName || server.name} reconnected`)
  } catch (e: any) {
    connectionStatus.value[server.id] = 'disconnected'
    toast.error(e.message ?? 'Failed to reconnect')
  } finally {
    reconnecting.value[server.id] = false
  }
}

onMounted(fetchServers)

function openCreate() {
  editingServer.value = null
  form.value = defaultForm()
  showModal.value = true
}

function openEdit(server: McpServer) {
  editingServer.value = server
  form.value = {
    name: server.name,
    displayName: server.displayName ?? '',
    description: server.description ?? '',
    type: server.type,
    url: server.url ?? '',
    command: server.command ?? '',
    args: (server.args ?? []).join(', '),
    active: server.active,
    credentialFields: (server.credentialFields ?? []).map((f) => ({ ...f })),
  }
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingServer.value = null
}

async function saveServer() {
  saving.value = true
  try {
    const payload: any = {
      name: form.value.name,
      displayName: form.value.displayName || undefined,
      description: form.value.description || undefined,
      type: form.value.type,
      active: form.value.active,
      credentialFields: form.value.credentialFields.filter((f) => f.key.trim()),
    }
    if (form.value.type === 'http') {
      payload.url = form.value.url || undefined
    } else {
      payload.command = form.value.command || undefined
      payload.args = form.value.args
        ? form.value.args.split(',').map((s) => s.trim()).filter(Boolean)
        : []
    }

    if (editingServer.value) {
      await api.updateMcpServer(editingServer.value.id, payload)
      toast.success('MCP server updated')
    } else {
      await api.createMcpServer(payload)
      toast.success('MCP server created')
    }
    closeModal()
    await fetchServers()
  } catch (e: any) {
    toast.error(e.message ?? 'Failed to save MCP server')
  } finally {
    saving.value = false
  }
}

function confirmDelete(server: McpServer) {
  deleteTarget.value = server
}

async function doDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await api.deleteMcpServer(deleteTarget.value.id)
    toast.success('MCP server deleted')
    deleteTarget.value = null
    await fetchServers()
  } catch (e: any) {
    toast.error(e.message ?? 'Failed to delete MCP server')
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <PageLayout title="MCP Servers" description="Manage external Model Context Protocol servers">
    <template #actions>
      <button
        class="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
        @click="openCreate">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Add MCP Server
      </button>
    </template>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <svg class="animate-spin h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
    </div>

    <!-- Grid -->
    <div v-else>
      <div v-if="!servers.length" class="text-center py-16 bg-white rounded-xl border border-slate-200">
        <div class="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
          <svg class="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </div>
        <p class="text-slate-500 text-sm">No MCP servers configured yet</p>
        <button class="mt-3 text-indigo-600 hover:text-indigo-700 text-sm font-medium" @click="openCreate">
          Add your first server
        </button>
      </div>

      <div v-else class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <div v-for="server in servers" :key="server.id"
          class="bg-slate-900 rounded-xl border border-slate-700 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col">
          <!-- Header -->
          <div class="flex-1">
            <div class="flex items-start justify-between mb-3">
              <div class="flex-1 min-w-0">
                <h3 class="font-semibold text-slate-200 truncate">
                  {{ server.displayName || server.name }}
                </h3>
                <p class="text-xs text-slate-400 font-mono mt-0.5">{{ server.name }}</p>
              </div>
              <div class="flex items-center gap-1.5 ml-3 shrink-0">
                <span class="px-2 py-0.5 rounded-full text-xs font-medium"
                  :class="server.type === 'http' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'">
                  {{ server.type }}
                </span>
                <span class="px-2 py-0.5 rounded-full text-xs font-medium"
                  :class="server.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'">
                  {{ server.active ? 'active' : 'inactive' }}
                </span>
                <template v-if="server.type !== 'local'">
                  <!-- Connection status -->
                  <span v-if="connectionStatus[server.id] === 'checking'"
                    class="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-400">
                    <svg class="w-2.5 h-2.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  </span>
                  <span v-else-if="connectionStatus[server.id] === 'connected'"
                    class="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-900/40 text-emerald-400">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    connected
                  </span>
                  <span v-else-if="connectionStatus[server.id] === 'disconnected'"
                    class="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-900/40 text-red-400">
                    <span class="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                    disconnected
                  </span>
                </template>
              </div>
            </div>

            <!-- Description -->
            <p v-if="server.description" class="text-sm text-slate-500 mb-3 line-clamp-2">
              {{ server.description }}
            </p>

            <!-- Connection info -->
            <div class="text-xs text-slate-500 mb-4">
              <template v-if="server.type === 'http' && server.url">
                <div class="flex items-center gap-1.5 bg-slate-950 rounded-md px-2.5 py-1.5 font-mono truncate">
                  <svg class="w-3 h-3 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <span class="truncate">{{ server.url }}</span>
                </div>
              </template>
              <template v-else-if="server.type === 'stdio' && server.command">
                <div class="flex items-center gap-1.5 bg-slate-950 rounded-md px-2.5 py-1.5 font-mono truncate">
                  <svg class="w-3 h-3 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span class="truncate">{{ server.command }} {{ (server.args ?? []).join(' ') }}</span>
                </div>
              </template>
            </div>

            <!-- Credential fields badges -->
            <div v-if="(server.credentialFields ?? []).length > 0" class="flex flex-wrap gap-1 mb-3">
              <span v-for="field in server.credentialFields" :key="field.key"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-900/40 text-violet-300 text-xs font-mono"
                :title="field.description">
                <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                {{ field.key }}
              </span>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-2 pt-3 border-t border-slate-700">
            <button
              class="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-slate-200 hover:text-violet-400 hover:bg-violet-900/30 transition-colors"
              @click="openToolsPanel(server)">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Tools
            </button>
            <template v-if="server.type !== 'local'">
              <button class="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium
              text-slate-200 hover:text-red-600 hover:bg-red-50 transition-colors" @click="confirmDelete(server)">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
              <button
                class="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-slate-200 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                @click="openEdit(server)">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
              <button v-if="connectionStatus[server.id] === 'disconnected'"
                class="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-slate-200 hover:text-emerald-400 hover:bg-emerald-900/30 transition-colors disabled:opacity-50"
                :disabled="reconnecting[server.id]" @click="reconnect(server)">
                <svg class="w-3.5 h-3.5" :class="{ 'animate-spin': reconnecting[server.id] }" fill="none"
                  stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {{ reconnecting[server.id] ? 'Connecting...' : 'Reconnect' }}
              </button>
            </template>
          </div>
        </div>
      </div>
    </div>
  </PageLayout>

  <!-- ── Tools Side Panel ──────────────────────────────────────────────────── -->
  <Teleport to="body">
    <div v-if="toolsPanelServer" class="fixed inset-0 z-40 flex">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closeToolsPanel" />

      <!-- Drawer -->
      <div class="relative ml-auto w-full max-w-xl bg-slate-900 shadow-2xl flex flex-col h-full overflow-hidden">
        <!-- Header -->
        <div class="px-6 py-5 border-b border-slate-700 flex items-center justify-between shrink-0">
          <div>
            <h2 class="text-base font-semibold text-slate-200">
              {{ toolsPanelServer.displayName || toolsPanelServer.name }} — Tools
            </h2>
            <p class="text-xs text-slate-500 mt-0.5">Browse and call tools exposed by this MCP server</p>
          </div>
          <button class="p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
            @click="closeToolsPanel">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto p-5">
          <!-- Loading -->
          <div v-if="toolsLoading" class="flex items-center justify-center py-16">
            <svg class="animate-spin h-7 w-7 text-violet-500" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>

          <!-- Empty -->
          <div v-else-if="!toolsList.length" class="text-center py-16 text-slate-500 text-sm">
            No tools found for this server.
          </div>

          <!-- Tools list -->
          <div v-else class="space-y-3">
            <div v-for="tool in toolsList" :key="tool.toolName"
              class="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <div class="flex items-start justify-between gap-3">
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold text-slate-200 font-mono">{{ tool.toolName }}</p>
                  <p v-if="tool.description" class="text-xs text-slate-400 mt-1 leading-relaxed">
                    {{ tool.description }}
                  </p>
                  <!-- Parameter summary -->
                  <div v-if="schemaProperties(tool).length" class="flex flex-wrap gap-1 mt-2">
                    <span v-for="{ key, schema } in schemaProperties(tool)" :key="key"
                      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono"
                      :class="requiredFields(tool).includes(key)
                        ? 'bg-indigo-900/50 text-indigo-300 ring-1 ring-indigo-700'
                        : 'bg-slate-700 text-slate-400'">
                      {{ key }}<span class="text-slate-500">:{{ schema?.type ?? 'any' }}</span>
                    </span>
                  </div>
                </div>
                <button
                  class="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-600 hover:bg-violet-500 text-white transition-colors"
                  @click="openCallModal(tool)">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Run
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- ── Tool Call Modal ────────────────────────────────────────────────────── -->
  <Teleport to="body">
    <div v-if="callingTool" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="closeCallModal" />
      <div class="relative bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">

        <!-- Header -->
        <div class="px-6 py-5 border-b border-slate-700 flex items-center justify-between shrink-0">
          <div>
            <h2 class="text-base font-semibold text-slate-200 font-mono">{{ callingTool.toolName }}</h2>
            <p v-if="callingTool.description" class="text-xs text-slate-400 mt-0.5 line-clamp-2">
              {{ callingTool.description }}
            </p>
          </div>
          <button class="p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
            @click="closeCallModal">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Form -->
        <div class="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <!-- Parameters -->
          <template v-if="schemaProperties(callingTool).length">
            <div v-for="{ key, schema } in schemaProperties(callingTool)" :key="key">
              <label class="block text-sm font-medium text-slate-300 mb-1.5">
                <span class="font-mono text-violet-400">{{ key }}</span>
                <span v-if="requiredFields(callingTool).includes(key)" class="text-red-400 ml-0.5">*</span>
                <span class="text-slate-500 text-xs font-normal ml-2">{{ schema?.type ?? 'any' }}</span>
                <span v-if="schema?.description" class="text-slate-500 text-xs font-normal block mt-0.5">
                  {{ schema.description }}
                </span>
              </label>
              <textarea v-if="schema?.type === 'object' || schema?.type === 'array'"
                v-model="callArgs[key]" rows="3"
                :placeholder="schema?.type === 'object' ? '{ }' : '[ ]'"
                class="w-full px-3 py-2 rounded-lg border border-slate-600 bg-slate-800 text-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y" />
              <select v-else-if="schema?.type === 'boolean'"
                v-model="callArgs[key]"
                class="w-full px-3 py-2 rounded-lg border border-slate-600 bg-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="">— optional —</option>
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
              <input v-else
                v-model="callArgs[key]"
                :type="schema?.type === 'number' || schema?.type === 'integer' ? 'number' : 'text'"
                :placeholder="schema?.examples?.[0] ?? schema?.default ?? ''"
                class="w-full px-3 py-2 rounded-lg border border-slate-600 bg-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
          </template>
          <p v-else class="text-sm text-slate-500 italic">This tool takes no parameters.</p>

          <!-- Result -->
          <div v-if="callResult !== null" class="mt-2">
            <p class="text-xs font-medium text-emerald-400 mb-1.5 flex items-center gap-1">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              Result
            </p>
            <pre class="bg-slate-950 rounded-lg p-3 text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap break-words max-h-60 overflow-y-auto font-mono border border-slate-700">{{ formattedResult }}</pre>
          </div>

          <!-- Error -->
          <div v-if="callError" class="mt-2 bg-red-950/40 border border-red-800 rounded-lg px-4 py-3">
            <p class="text-xs text-red-400">{{ callError }}</p>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-slate-700 flex gap-3 shrink-0">
          <button
            class="flex-1 px-4 py-2.5 rounded-lg border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-800 transition-colors"
            @click="closeCallModal">
            Close
          </button>
          <button
            class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
            :disabled="callRunning"
            @click="executeTool">
            <svg v-if="callRunning" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {{ callRunning ? 'Running...' : 'Run Tool' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Create / Edit Modal -->
  <div v-if="showModal" class="fixed inset-0 z-40 flex items-center justify-center">
    <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closeModal" />
    <div class="relative bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
      <!-- Header -->
      <div class="px-6 py-5 border-b border-slate-700 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-slate-200">
          {{ editingServer ? 'Edit MCP Server' : 'Add MCP Server' }}
        </h2>
        <button class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          @click="closeModal">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Body -->
      <form class="px-6 py-5 space-y-4" @submit.prevent="saveServer">
        <!-- Name + Display Name -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1.5">
              ID Name <span class="text-red-500">*</span>
            </label>
            <input v-model="form.name" type="text" placeholder="my-mcp-server" required :disabled="!!editingServer"
              class="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-900 disabled:text-slate-400" />
            <p class="text-xs text-slate-400 mt-1">Lowercase, letters, numbers, hyphens</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1.5">Display Name</label>
            <input v-model="form.displayName" type="text" placeholder="My MCP Server"
              class="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>

        <!-- Description -->
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
          <input v-model="form.description" type="text" placeholder="What does this server provide?"
            class="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        <!-- Type + Active -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1.5">Type <span
                class="text-red-500">*</span></label>
            <select v-model="form.type"
              class="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-white text-sm bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="http">HTTP</option>
              <option value="stdio">stdio</option>
            </select>
          </div>
          <div class="flex flex-col">
            <label class="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
            <label class="flex items-center gap-2.5 cursor-pointer mt-2">
              <input v-model="form.active" type="checkbox"
                class="w-4 h-4 text-indigo-600 rounded border-slate-300 text-white" />
              <span class="text-sm text-slate-700">Active</span>
            </label>
          </div>
        </div>

        <!-- HTTP: URL -->
        <div v-if="form.type === 'http'">
          <label class="block text-sm font-medium text-slate-700 mb-1.5">URL</label>
          <input v-model="form.url" type="text" placeholder="https://mcp.example.com/v1/mcp"
            class="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        <!-- stdio: Command + Args -->
        <template v-else>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1.5">Command</label>
            <input v-model="form.command" type="text" placeholder="npx"
              class="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1.5">Arguments</label>
            <input v-model="form.args" type="text" placeholder="-y, mcp-remote, https://mcp.example.com"
              class="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <p class="text-xs text-slate-400 mt-1">Comma-separated</p>
          </div>
        </template>

        <!-- Credential Fields -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="block text-sm font-medium text-slate-400">
              Credential Fields
              <span class="text-xs text-slate-500 font-normal ml-1">— fields agents will request from the user</span>
            </label>
            <button type="button"
              class="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
              @click="addCredentialField">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              Add field
            </button>
          </div>
          <div v-if="form.credentialFields.length === 0" class="text-xs text-slate-600 italic py-1">
            No credential fields defined.
          </div>
          <div v-for="(field, i) in form.credentialFields" :key="i" class="flex items-center gap-2 mb-2">
            <input v-model="field.key" type="text" placeholder="key (e.g. mcp_token)"
              class="w-32 px-2.5 py-1.5 rounded-lg border border-slate-600 bg-slate-800 text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            <input v-model="field.description" type="text" placeholder="Description shown to the user"
              class="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-600 bg-slate-800 text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            <button type="button" @click="removeCredentialField(i)"
              class="p-1 text-slate-500 hover:text-red-400 transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex gap-3 pt-2">
          <button type="button"
            class="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 text-white text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            @click="closeModal">
            Cancel
          </button>
          <button type="submit" :disabled="saving"
            class="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors">
            {{ saving ? 'Saving...' : editingServer ? 'Save Changes' : 'Add Server' }}
          </button>
        </div>
      </form>
    </div>
  </div>

  <!-- Delete Confirm -->
  <ConfirmDialog v-if="deleteTarget" title="Delete MCP Server"
    :message="`Are you sure you want to delete &quot;${deleteTarget.displayName || deleteTarget.name}&quot;? Roles that use this server will lose access.`"
    :loading="deleting" @confirm="doDelete" @cancel="deleteTarget = null" />
</template>
