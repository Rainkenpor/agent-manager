<script setup lang="ts">
import { ref, onMounted } from 'vue'
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

// Modal
const showModal = ref(false)
const editingServer = ref<McpServer | null>(null)
const saving = ref(false)

interface ServerForm {
  name: string
  displayName: string
  description: string
  type: 'http' | 'stdio'
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
                  <!-- Connection status -->
                  <span v-if="connectionStatus[server.id] === 'checking'"
                    class="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-400">
                    <svg class="w-2.5 h-2.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
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
                class="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-slate-200 hover:text-red-600 hover:bg-red-50 transition-colors"
                @click="confirmDelete(server)">
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
                :disabled="reconnecting[server.id]"
                @click="reconnect(server)">
                <svg class="w-3.5 h-3.5" :class="{ 'animate-spin': reconnecting[server.id] }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {{ reconnecting[server.id] ? 'Connecting...' : 'Reconnect' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>

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
