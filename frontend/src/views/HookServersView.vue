<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import * as api from '@/api/api'
import { useAuthStore } from '@/store/useAuth'
import { useToastStore } from '@/store/useToast'

const auth = useAuthStore()
const toast = useToastStore()

// ── State ─────────────────────────────────────────────────────────────────────

interface HookServer {
  id: string
  name: string
  displayName?: string | null
  description?: string | null
  url: string
  active: boolean
  createdAt: string
  updatedAt: string
}

interface HookDefinition {
  name: string
  description: string
  payload: Record<string, { type: string; description: string; optional: boolean }>
}

interface HookAssignment {
  id: string
  hookServerId: string
  hookName: string
  assignmentType: 'agent' | 'mcp_tool'
  assignmentId: string
  assignmentName: string
  extraData?: Record<string, string> | null
  createdAt: string
}

interface Agent {
  id: string
  name: string
  slug: string
  description?: string | null
  mode: string
}

interface McpTool {
  toolName: string
  description: string
}

const servers = ref<HookServer[]>([])
const selectedServer = ref<HookServer | null>(null)
const discoveredHooks = ref<HookDefinition[]>([])
const assignments = ref<HookAssignment[]>([])
const agents = ref<Agent[]>([])
const mcpServers = ref<any[]>([])

const loadingServers = ref(false)
const loadingHooks = ref(false)
const loadingAssignments = ref(false)
const discoverError = ref('')

// ── Server form modal ─────────────────────────────────────────────────────────

const showServerModal = ref(false)
const editingServer = ref<HookServer | null>(null)
const serverForm = ref({
  name: '',
  displayName: '',
  description: '',
  url: '',
  active: true
})
const savingServer = ref(false)

function openCreateServer() {
  editingServer.value = null
  serverForm.value = { name: '', displayName: '', description: '', url: '', active: true }
  showServerModal.value = true
}

function openEditServer(server: HookServer) {
  editingServer.value = server
  serverForm.value = {
    name: server.name,
    displayName: server.displayName ?? '',
    description: server.description ?? '',
    url: server.url,
    active: server.active
  }
  showServerModal.value = true
}

async function saveServer() {
  savingServer.value = true
  try {
    if (editingServer.value) {
      const res = await api.updateHookServer(editingServer.value.id, {
        displayName: serverForm.value.displayName || undefined,
        description: serverForm.value.description || undefined,
        url: serverForm.value.url,
        active: serverForm.value.active
      })
      const updated = res.data
      const idx = servers.value.findIndex((s) => s.id === updated.id)
      if (idx !== -1) servers.value[idx] = updated
      if (selectedServer.value?.id === updated.id) selectedServer.value = updated
      toast.success('Hook server updated')
    } else {
      const res = await api.createHookServer({
        name: serverForm.value.name,
        displayName: serverForm.value.displayName || undefined,
        description: serverForm.value.description || undefined,
        url: serverForm.value.url,
        active: serverForm.value.active
      })
      servers.value.push(res.data)
      toast.success('Hook server created')
    }
    showServerModal.value = false
  } catch (e: any) {
    toast.error(e.message)
  } finally {
    savingServer.value = false
  }
}

async function deleteServer(server: HookServer) {
  if (!confirm(`Delete hook server "${server.displayName || server.name}"?`)) return
  try {
    await api.deleteHookServer(server.id)
    servers.value = servers.value.filter((s) => s.id !== server.id)
    if (selectedServer.value?.id === server.id) {
      selectedServer.value = null
      discoveredHooks.value = []
      assignments.value = []
    }
    toast.success('Hook server deleted')
  } catch (e: any) {
    toast.error(e.message)
  }
}

// ── Select server & discovery ─────────────────────────────────────────────────

async function selectServer(server: HookServer) {
  selectedServer.value = server
  discoveredHooks.value = []
  assignments.value = []
  discoverError.value = ''
  selectedHook.value = null
  await Promise.all([discoverHooks(server), loadAssignments(server)])
}

async function discoverHooks(server: HookServer) {
  loadingHooks.value = true
  discoverError.value = ''
  try {
    const res = await api.discoverHooks(server.id)
    discoveredHooks.value = res.data ?? []
  } catch (e: any) {
    discoverError.value = e.message
    discoveredHooks.value = []
  } finally {
    loadingHooks.value = false
  }
}

async function loadAssignments(server: HookServer) {
  loadingAssignments.value = true
  try {
    const res = await api.getHookAssignments(server.id)
    assignments.value = res.data ?? []
  } catch {
    assignments.value = []
  } finally {
    loadingAssignments.value = false
  }
}

// ── Hook detail & assignments ─────────────────────────────────────────────────

const selectedHook = ref<HookDefinition | null>(null)

function selectHook(hook: HookDefinition) {
  selectedHook.value = hook
  showAssignModal.value = false
}

const hookAssignments = computed(() =>
  assignments.value.filter((a) => a.hookName === selectedHook.value?.name)
)

// ── Assignment modal ──────────────────────────────────────────────────────────

const showAssignModal = ref(false)
const savingAssignment = ref(false)

// Multi-select state
const selectedAgentIds = ref<Set<string>>(new Set())
const selectedMcpServerId = ref('')
const selectedToolNames = ref<Set<string>>(new Set())
const mcpToolsForServer = ref<McpTool[]>([])
const loadingMcpTools = ref(false)

const totalSelected = computed(() => selectedAgentIds.value.size + selectedToolNames.value.size)

function openAssignModal() {
  selectedAgentIds.value = new Set()
  selectedMcpServerId.value = ''
  selectedToolNames.value = new Set()
  mcpToolsForServer.value = []
  showAssignModal.value = true
}

function toggleAgent(agent: Agent) {
  if (selectedAgentIds.value.has(agent.id)) {
    selectedAgentIds.value.delete(agent.id)
  } else {
    selectedAgentIds.value.add(agent.id)
  }
  // trigger reactivity
  selectedAgentIds.value = new Set(selectedAgentIds.value)
}

async function onMcpServerChange(mcpServerId: string) {
  selectedToolNames.value = new Set()
  if (!mcpServerId) { mcpToolsForServer.value = []; return }
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

function toggleTool(tool: McpTool) {
  if (selectedToolNames.value.has(tool.toolName)) {
    selectedToolNames.value.delete(tool.toolName)
  } else {
    selectedToolNames.value.add(tool.toolName)
  }
  selectedToolNames.value = new Set(selectedToolNames.value)
}

async function saveAssignments() {
  if (!selectedServer.value || !selectedHook.value) return
  if (totalSelected.value === 0) {
    toast.error('Select at least one agent or tool')
    return
  }
  savingAssignment.value = true
  try {
    const hookName = selectedHook.value.name
    const serverId = selectedServer.value.id
    const created: HookAssignment[] = []

    // Save agent assignments
    for (const agentId of selectedAgentIds.value) {
      const agent = agents.value.find((a) => a.id === agentId)
      if (!agent) continue
      // Skip if already assigned
      if (assignments.value.some((a) => a.hookName === hookName && a.assignmentType === 'agent' && a.assignmentId === agentId)) continue
      const res = await api.createHookAssignment(serverId, {
        hookName,
        assignmentType: 'agent',
        assignmentId: agent.id,
        assignmentName: agent.name
      })
      created.push(res.data)
    }

    // Save tool assignments
    const mcpServer = mcpServers.value.find((s) => s.id === selectedMcpServerId.value)
    for (const toolName of selectedToolNames.value) {
      // Skip if already assigned
      if (assignments.value.some((a) => a.hookName === hookName && a.assignmentType === 'mcp_tool' && a.assignmentName === toolName && a.assignmentId === selectedMcpServerId.value)) continue
      const res = await api.createHookAssignment(serverId, {
        hookName,
        assignmentType: 'mcp_tool',
        assignmentId: selectedMcpServerId.value,
        assignmentName: toolName,
        extraData: mcpServer ? { mcpServerName: mcpServer.name, mcpServerUrl: mcpServer.url ?? '', toolName } : undefined
      })
      created.push(res.data)
    }

    assignments.value.push(...created)
    showAssignModal.value = false
    toast.success(`${created.length} assignment${created.length !== 1 ? 's' : ''} added`)
  } catch (e: any) {
    toast.error(e.message)
  } finally {
    savingAssignment.value = false
  }
}

async function removeAssignment(assignment: HookAssignment) {
  if (!selectedServer.value) return
  try {
    await api.deleteHookAssignment(selectedServer.value.id, assignment.id)
    assignments.value = assignments.value.filter((a) => a.id !== assignment.id)
    toast.success('Assignment removed')
  } catch (e: any) {
    toast.error(e.message)
  }
}

// ── Load data ─────────────────────────────────────────────────────────────────

async function loadServers() {
  loadingServers.value = true
  try {
    const res = await api.getHookServers()
    servers.value = res.data ?? []
  } catch (e: any) {
    toast.error(e.message)
  } finally {
    loadingServers.value = false
  }
}

onMounted(async () => {
  await loadServers()
  try {
    const [agentsRes, mcpRes] = await Promise.all([api.getAgents(), api.getMcpServers()])
    agents.value = agentsRes.data ?? []
    mcpServers.value = mcpRes.data ?? []
  } catch { /* non-critical */ }
})
</script>

<template>
  <div class="flex h-full bg-slate-950 text-white overflow-hidden">
    <!-- ── Left Panel: Hook Servers ──────────────────────────────────────────── -->
    <div class="w-72 shrink-0 flex flex-col border-r border-slate-800">
      <div class="flex items-center justify-between px-4 py-4 border-b border-slate-800">
        <h2 class="text-sm font-semibold text-slate-100">Hook Servers</h2>
        <button
          v-if="auth.hasPermission('hook_servers', 'create')"
          @click="openCreateServer"
          class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium transition-colors"
        >
          <i class="mdi mdi-plus text-base"></i>
          New
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-3 space-y-1.5">
        <div v-if="loadingServers" class="text-center py-8 text-slate-500 text-sm">Loading...</div>
        <div v-else-if="servers.length === 0" class="text-center py-8 text-slate-500 text-sm">No hook servers yet</div>
        <button
          v-for="server in servers"
          :key="server.id"
          @click="selectServer(server)"
          class="w-full text-left rounded-lg p-3 transition-colors border"
          :class="selectedServer?.id === server.id
            ? 'bg-indigo-600/20 border-indigo-500/50 text-white'
            : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white'"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="text-sm font-medium truncate">{{ server.displayName || server.name }}</p>
              <p class="text-xs text-slate-500 truncate mt-0.5">{{ server.url }}</p>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <span
                class="inline-block w-2 h-2 rounded-full mt-0.5"
                :class="server.active ? 'bg-emerald-500' : 'bg-slate-600'"
              ></span>
            </div>
          </div>
          <p v-if="server.description" class="text-xs text-slate-500 mt-1.5 line-clamp-2">{{ server.description }}</p>
          <div class="flex gap-1 mt-2" @click.stop>
            <button
              v-if="auth.hasPermission('hook_servers', 'update')"
              @click="openEditServer(server)"
              class="p-1 rounded text-slate-500 hover:text-indigo-400 hover:bg-slate-800 transition-colors"
              title="Edit"
            >
              <i class="mdi mdi-pencil text-sm"></i>
            </button>
            <button
              v-if="auth.hasPermission('hook_servers', 'delete')"
              @click="deleteServer(server)"
              class="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
              title="Delete"
            >
              <i class="mdi mdi-delete text-sm"></i>
            </button>
          </div>
        </button>
      </div>
    </div>

    <!-- ── Right Panel: Hooks & Assignments ──────────────────────────────────── -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Empty state -->
      <div v-if="!selectedServer" class="flex-1 flex items-center justify-center text-slate-600">
        <div class="text-center">
          <i class="mdi mdi-webhook text-5xl mb-3 block"></i>
          <p class="text-sm">Select a hook server to view its hooks</p>
        </div>
      </div>

      <template v-else>
        <!-- ── Hook List ─────────────────────────────────────────────────────── -->
        <div class="w-72 shrink-0 flex flex-col border-r border-slate-800">
          <div class="flex items-center justify-between px-4 py-4 border-b border-slate-800">
            <div>
              <h3 class="text-sm font-semibold text-slate-100">Hooks</h3>
              <p class="text-xs text-slate-500 mt-0.5">{{ selectedServer.displayName || selectedServer.name }}</p>
            </div>
            <button
              @click="discoverHooks(selectedServer!)"
              :disabled="loadingHooks"
              class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Refresh hooks"
            >
              <i class="mdi mdi-refresh text-base" :class="loadingHooks ? 'animate-spin' : ''"></i>
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-3 space-y-1.5">
            <div v-if="loadingHooks" class="text-center py-8 text-slate-500 text-sm">Discovering hooks...</div>
            <div v-else-if="discoverError" class="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
              <i class="mdi mdi-alert-circle mr-1"></i>{{ discoverError }}
            </div>
            <div v-else-if="discoveredHooks.length === 0" class="text-center py-8 text-slate-500 text-sm">No hooks found</div>
            <button
              v-for="hook in discoveredHooks"
              :key="hook.name"
              @click="selectHook(hook)"
              class="w-full text-left rounded-lg p-3 transition-colors border"
              :class="selectedHook?.name === hook.name
                ? 'bg-indigo-600/20 border-indigo-500/50 text-white'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white'"
            >
              <div class="flex items-center justify-between gap-2">
                <p class="text-xs font-mono font-medium truncate">{{ hook.name }}</p>
                <span
                  v-if="assignments.filter(a => a.hookName === hook.name).length > 0"
                  class="shrink-0 px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 text-xs"
                >
                  {{ assignments.filter(a => a.hookName === hook.name).length }}
                </span>
              </div>
              <p v-if="hook.description" class="text-xs text-slate-500 mt-1 line-clamp-2">{{ hook.description }}</p>
            </button>
          </div>
        </div>

        <!-- ── Hook Detail & Assignments ─────────────────────────────────────── -->
        <div class="flex-1 flex flex-col overflow-hidden">
          <div v-if="!selectedHook" class="flex-1 flex items-center justify-center text-slate-600">
            <div class="text-center">
              <i class="mdi mdi-hook text-4xl mb-2 block"></i>
              <p class="text-sm">Select a hook to manage its assignments</p>
            </div>
          </div>

          <template v-else>
            <div class="px-6 py-4 border-b border-slate-800 flex items-start justify-between gap-4">
              <div>
                <h3 class="font-semibold text-slate-100 font-mono">{{ selectedHook.name }}</h3>
                <p v-if="selectedHook.description" class="text-sm text-slate-400 mt-1">{{ selectedHook.description }}</p>
              </div>
              <button
                v-if="auth.hasPermission('hook_servers', 'update')"
                @click="openAssignModal"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium transition-colors shrink-0"
              >
                <i class="mdi mdi-plus text-base"></i>
                Add Assignment
              </button>
            </div>

            <div class="flex-1 overflow-y-auto p-6 space-y-6">
              <!-- Payload schema -->
              <div v-if="Object.keys(selectedHook.payload ?? {}).length > 0">
                <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Payload Schema</h4>
                <div class="rounded-lg border border-slate-800 overflow-hidden">
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="bg-slate-900 border-b border-slate-800">
                        <th class="text-left px-4 py-2.5 text-xs font-medium text-slate-400">Field</th>
                        <th class="text-left px-4 py-2.5 text-xs font-medium text-slate-400">Type</th>
                        <th class="text-left px-4 py-2.5 text-xs font-medium text-slate-400">Description</th>
                        <th class="text-left px-4 py-2.5 text-xs font-medium text-slate-400">Required</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="(field, fieldName) in selectedHook.payload"
                        :key="fieldName"
                        class="border-b border-slate-800/50 last:border-0"
                      >
                        <td class="px-4 py-2.5 font-mono text-xs text-slate-300">{{ fieldName }}</td>
                        <td class="px-4 py-2.5">
                          <span class="px-1.5 py-0.5 rounded bg-slate-800 text-indigo-400 text-xs font-mono">{{ field.type }}</span>
                        </td>
                        <td class="px-4 py-2.5 text-xs text-slate-400">{{ field.description }}</td>
                        <td class="px-4 py-2.5">
                          <span v-if="!field.optional" class="text-xs text-emerald-400">required</span>
                          <span v-else class="text-xs text-slate-600">optional</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- Assignments -->
              <div>
                <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Assignments
                  <span class="ml-2 text-slate-600 normal-case font-normal">— called when this hook fires</span>
                </h4>

                <div v-if="loadingAssignments" class="text-sm text-slate-500">Loading assignments...</div>
                <div v-else-if="hookAssignments.length === 0" class="text-sm text-slate-600 italic">
                  No assignments yet. Add agents or tools to call when this hook fires.
                </div>
                <div v-else class="space-y-2">
                  <div
                    v-for="assignment in hookAssignments"
                    :key="assignment.id"
                    class="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-900 border border-slate-800"
                  >
                    <div class="flex items-center gap-3">
                      <div
                        class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        :class="assignment.assignmentType === 'agent' ? 'bg-indigo-500/20' : 'bg-amber-500/20'"
                      >
                        <i
                          class="mdi text-sm"
                          :class="assignment.assignmentType === 'agent' ? 'mdi-robot text-indigo-400' : 'mdi-tools text-amber-400'"
                        ></i>
                      </div>
                      <div>
                        <p class="text-sm font-medium text-slate-200">{{ assignment.assignmentName }}</p>
                        <p class="text-xs text-slate-500">
                          {{ assignment.assignmentType === 'agent' ? 'Agent' : 'MCP Tool' }}
                          <template v-if="assignment.extraData?.mcpServerName"> · {{ assignment.extraData.mcpServerName }}</template>
                        </p>
                      </div>
                    </div>
                    <button
                      v-if="auth.hasPermission('hook_servers', 'update')"
                      @click="removeAssignment(assignment)"
                      class="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
                    >
                      <i class="mdi mdi-close text-sm"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </template>
    </div>
  </div>

  <!-- ── Server Modal ─────────────────────────────────────────────────────────── -->
  <Teleport to="body">
    <div v-if="showServerModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/60" @click="showServerModal = false"></div>
      <div class="relative z-10 w-full max-w-md bg-slate-900 rounded-xl border border-slate-700 shadow-2xl">
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h3 class="font-semibold text-slate-100">{{ editingServer ? 'Edit' : 'New' }} Hook Server</h3>
          <button @click="showServerModal = false" class="text-slate-400 hover:text-white transition-colors">
            <i class="mdi mdi-close text-xl"></i>
          </button>
        </div>

        <form @submit.prevent="saveServer" class="p-6 space-y-4">
          <div v-if="!editingServer">
            <label class="block text-xs font-medium text-slate-400 mb-1.5">Name <span class="text-red-400">*</span></label>
            <input
              v-model="serverForm.name"
              required
              placeholder="my-hook-server"
              class="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <p class="text-xs text-slate-500 mt-1">Lowercase letters, numbers, hyphens and underscores only</p>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-400 mb-1.5">Display Name</label>
            <input
              v-model="serverForm.displayName"
              placeholder="My Hook Server"
              class="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-400 mb-1.5">Base URL <span class="text-red-400">*</span></label>
            <input
              v-model="serverForm.url"
              required
              type="url"
              placeholder="http://localhost:4000/event-source"
              class="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <p class="text-xs text-slate-500 mt-1">The server must expose <code class="text-indigo-400">/hooks</code> and <code class="text-indigo-400">/hooks/stream</code> under this URL</p>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-400 mb-1.5">Description</label>
            <textarea
              v-model="serverForm.description"
              rows="2"
              placeholder="Optional description..."
              class="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
            ></textarea>
          </div>

          <div class="flex items-center gap-2">
            <input
              v-model="serverForm.active"
              type="checkbox"
              id="serverActive"
              class="w-4 h-4 rounded border-slate-600 accent-indigo-600"
            />
            <label for="serverActive" class="text-sm text-slate-300">Active (subscribe to events on startup)</label>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <button type="button" @click="showServerModal = false" class="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              :disabled="savingServer"
              class="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {{ savingServer ? 'Saving...' : editingServer ? 'Update' : 'Create' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>

  <!-- ── Assignment Modal ─────────────────────────────────────────────────────── -->
  <Teleport to="body">
    <div v-if="showAssignModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/60" @click="showAssignModal = false"></div>
      <div class="relative z-10 w-full max-w-2xl bg-slate-900 rounded-xl border border-slate-700 shadow-2xl flex flex-col max-h-[85vh]">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div>
            <h3 class="font-semibold text-slate-100">Add Assignments</h3>
            <p class="text-xs text-slate-500 mt-0.5">
              Hook: <span class="font-mono text-indigo-400">{{ selectedHook?.name }}</span>
              <span v-if="totalSelected > 0" class="ml-2 px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400">
                {{ totalSelected }} selected
              </span>
            </p>
          </div>
          <button @click="showAssignModal = false" class="text-slate-400 hover:text-white transition-colors">
            <i class="mdi mdi-close text-xl"></i>
          </button>
        </div>

        <!-- Body: two columns -->
        <div class="flex-1 overflow-hidden grid grid-cols-2 divide-x divide-slate-800">
          <!-- Agents column -->
          <div class="flex flex-col overflow-hidden">
            <div class="px-4 py-3 border-b border-slate-800 shrink-0">
              <h4 class="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <i class="mdi mdi-robot text-indigo-400"></i>
                Agents
                <span v-if="selectedAgentIds.size > 0" class="ml-auto px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 text-xs">
                  {{ selectedAgentIds.size }}
                </span>
              </h4>
            </div>
            <div class="flex-1 overflow-y-auto">
              <div v-if="agents.length === 0" class="px-4 py-6 text-sm text-slate-500 italic text-center">No agents available</div>
              <button
                v-for="agent in agents"
                :key="agent.id"
                type="button"
                @click="toggleAgent(agent)"
                class="w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors border-b border-slate-800/50 last:border-0"
                :class="selectedAgentIds.has(agent.id) ? 'bg-indigo-600/15 text-indigo-200' : 'text-slate-300 hover:bg-slate-800'"
              >
                <div
                  class="w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors"
                  :class="selectedAgentIds.has(agent.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-600'"
                >
                  <i v-if="selectedAgentIds.has(agent.id)" class="mdi mdi-check text-white text-xs"></i>
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-medium truncate">{{ agent.name }}</p>
                  <p v-if="agent.description" class="text-xs text-slate-500 truncate">{{ agent.description }}</p>
                </div>
              </button>
            </div>
          </div>

          <!-- MCP Tools column -->
          <div class="flex flex-col overflow-hidden">
            <div class="px-4 py-3 border-b border-slate-800 shrink-0">
              <h4 class="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <i class="mdi mdi-tools text-amber-400"></i>
                MCP Tools
                <span v-if="selectedToolNames.size > 0" class="ml-auto px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs">
                  {{ selectedToolNames.size }}
                </span>
              </h4>
            </div>
            <!-- MCP server selector -->
            <div class="px-4 py-2 border-b border-slate-800 shrink-0">
              <select
                v-model="selectedMcpServerId"
                @change="onMcpServerChange(selectedMcpServerId)"
                class="w-full px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="">Select MCP server...</option>
                <option v-for="mcp in mcpServers" :key="mcp.id" :value="mcp.id">
                  {{ mcp.displayName || mcp.name }}
                </option>
              </select>
            </div>
            <div class="flex-1 overflow-y-auto">
              <div v-if="!selectedMcpServerId" class="px-4 py-6 text-sm text-slate-500 italic text-center">Select a server above</div>
              <div v-else-if="loadingMcpTools" class="px-4 py-6 text-sm text-slate-500 text-center">Loading tools...</div>
              <div v-else-if="mcpToolsForServer.length === 0" class="px-4 py-6 text-sm text-slate-500 italic text-center">No tools available</div>
              <button
                v-for="tool in mcpToolsForServer"
                :key="tool.toolName"
                type="button"
                @click="toggleTool(tool)"
                class="w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors border-b border-slate-800/50 last:border-0"
                :class="selectedToolNames.has(tool.toolName) ? 'bg-amber-600/15 text-amber-200' : 'text-slate-300 hover:bg-slate-800'"
              >
                <div
                  class="w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors"
                  :class="selectedToolNames.has(tool.toolName) ? 'bg-amber-600 border-amber-600' : 'border-slate-600'"
                >
                  <i v-if="selectedToolNames.has(tool.toolName)" class="mdi mdi-check text-white text-xs"></i>
                </div>
                <div class="min-w-0">
                  <p class="text-xs font-mono font-medium truncate">{{ tool.toolName }}</p>
                  <p v-if="tool.description" class="text-xs text-slate-500 truncate">{{ tool.description }}</p>
                </div>
              </button>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between px-6 py-4 border-t border-slate-800 shrink-0">
          <p class="text-xs text-slate-500">
            <template v-if="totalSelected === 0">No items selected</template>
            <template v-else>
              <span v-if="selectedAgentIds.size > 0">{{ selectedAgentIds.size }} agent{{ selectedAgentIds.size !== 1 ? 's' : '' }}</span>
              <span v-if="selectedAgentIds.size > 0 && selectedToolNames.size > 0"> + </span>
              <span v-if="selectedToolNames.size > 0">{{ selectedToolNames.size }} tool{{ selectedToolNames.size !== 1 ? 's' : '' }}</span>
              <span> will be assigned</span>
            </template>
          </p>
          <div class="flex gap-2">
            <button type="button" @click="showAssignModal = false" class="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
              Cancel
            </button>
            <button
              @click="saveAssignments"
              :disabled="savingAssignment || totalSelected === 0"
              class="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {{ savingAssignment ? 'Saving...' : `Add ${totalSelected > 0 ? totalSelected : ''} Assignment${totalSelected !== 1 ? 's' : ''}` }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
