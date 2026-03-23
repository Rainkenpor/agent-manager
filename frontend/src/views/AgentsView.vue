<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import AppLayout from '@/components/AppLayout.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useToastStore } from '@/store/useToast'
import * as api from '@/api/api'
import type { Agent, AgentTool } from '@/types/types'

const toast = useToastStore()

const agents = ref<Agent[]>([])
const availableTools = ref<AgentTool[]>([])
const loading = ref(false)

// Modal
const showModal = ref(false)
const editingAgent = ref<Agent | null>(null)
const saving = ref(false)

interface AgentFormData {
  name: string
  slug: string
  description: string
  mode: 'primary' | 'subagent'
  model: string
  temperature: string
  content: string
  isActive: boolean
  tools: Record<string, boolean>
  subagentIds: string[]
}

const defaultForm = (): AgentFormData => ({
  name: '',
  slug: '',
  description: '',
  mode: 'primary',
  model: 'gpt-4o',
  temperature: '0.7',
  content: '',
  isActive: true,
  tools: {},
  subagentIds: [],
})

const agentForm = ref<AgentFormData>(defaultForm())

// Delete
const deleteTarget = ref<Agent | null>(null)
const deleting = ref(false)

// Detail view
const detailAgent = ref<Agent | null>(null)

const primaryAgents = computed(() => agents.value.filter((a) => a.mode === 'primary'))
const subagents = computed(() => agents.value.filter((a) => a.mode === 'subagent'))

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

watch(
  () => agentForm.value.name,
  (val) => {
    if (!editingAgent.value) {
      agentForm.value.slug = slugify(val)
    }
  },
)

async function fetchData() {
  loading.value = true
  try {
    const [agentsRes, toolsRes] = await Promise.all([api.getAgents(), api.getAgentTools()])
    agents.value = agentsRes.data ?? agentsRes as any
    availableTools.value = toolsRes.data ?? toolsRes as any
  } catch (e: any) {
    toast.error(e.message ?? 'Failed to load agents')
  } finally {
    loading.value = false
  }
}

onMounted(fetchData)

function openCreate() {
  editingAgent.value = null
  const form = defaultForm()
  // Initialize tools
  for (const tool of availableTools.value) {
    form.tools[tool.name] = false
  }
  agentForm.value = form
  showModal.value = true
}

function openEdit(agent: Agent) {
  editingAgent.value = agent
  const form: AgentFormData = {
    name: agent.name,
    slug: agent.slug,
    description: agent.description ?? '',
    mode: agent.mode,
    model: agent.model,
    temperature: agent.temperature,
    content: agent.content,
    isActive: agent.isActive,
    tools: { ...agent.tools },
    subagentIds: (agent.subagents ?? []).map((s) => s.id),
  }
  // Ensure all available tools are represented
  for (const tool of availableTools.value) {
    if (!(tool.name in form.tools)) {
      form.tools[tool.name] = false
    }
  }
  agentForm.value = form
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingAgent.value = null
}

async function saveAgent() {
  saving.value = true
  try {
    const payload: any = {
      name: agentForm.value.name,
      slug: agentForm.value.slug,
      description: agentForm.value.description || undefined,
      mode: agentForm.value.mode,
      model: agentForm.value.model,
      temperature: agentForm.value.temperature,
      content: agentForm.value.content,
      isActive: agentForm.value.isActive,
      tools: agentForm.value.tools,
    }
    if (agentForm.value.mode === 'primary') {
      payload.subagentIds = agentForm.value.subagentIds
    }

    if (editingAgent.value) {
      await api.updateAgent(editingAgent.value.id, payload)
      toast.success('Agent updated')
    } else {
      await api.createAgent(payload)
      toast.success('Agent created')
    }
    closeModal()
    await fetchData()
  } catch (e: any) {
    toast.error(e.message ?? 'Failed to save agent')
  } finally {
    saving.value = false
  }
}

function confirmDelete(agent: Agent) {
  deleteTarget.value = agent
}

async function doDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await api.deleteAgent(deleteTarget.value.id)
    toast.success('Agent deleted')
    deleteTarget.value = null
    await fetchData()
  } catch (e: any) {
    toast.error(e.message ?? 'Failed to delete agent')
  } finally {
    deleting.value = false
  }
}

function openDetail(agent: Agent) {
  detailAgent.value = agent
}

function toggleSubagent(id: string) {
  const idx = agentForm.value.subagentIds.indexOf(id)
  if (idx === -1) {
    agentForm.value.subagentIds.push(id)
  } else {
    agentForm.value.subagentIds.splice(idx, 1)
  }
}

function toolsBySource(source: string) {
  return availableTools.value.filter((t) => t.source === source)
}

const toolSources = computed(() => {
  const s = new Set(availableTools.value.map((t) => t.source))
  return Array.from(s)
})
</script>

<template>
  <AppLayout>
    <div class="p-8">
      <!-- Header -->
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-2xl font-bold text-white">Agents</h1>
          <p class="text-slate-500 text-sm mt-0.5">Manage primary agents and subagents</p>
        </div>
        <button
          class="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
          @click="openCreate">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Create Agent
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-20">
        <svg class="animate-spin h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>

      <div v-else class="space-y-10">
        <!-- Primary Agents -->
        <section>
          <h2 class="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-indigo-500 inline-block"></span>
            Primary Agents
            <span class="ml-1 text-xs font-normal text-white">({{ primaryAgents.length }})</span>
          </h2>
          <div v-if="!primaryAgents.length"
            class="text-slate-400 text-sm py-6 text-center bg-slate-900 rounded-xl border border-slate-700">
            No primary agents yet
          </div>
          <div v-else class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <div v-for="agent in primaryAgents" :key="agent.id"
              class="bg-slate-900 rounded-xl border border-slate-700 shadow-sm hover:shadow-md transition-shadow p-5 cursor-pointer"
              @click="openDetail(agent)">
              <div class="flex items-start justify-between mb-3">
                <div class="flex-1 min-w-0">
                  <h3 class="font-semibold text-white truncate">{{ agent.name }}</h3>
                  <p class="text-xs text-slate-400 font-mono mt-0.5 truncate">{{ agent.slug }}</p>
                </div>
                <div class="flex items-center gap-1.5 ml-3 shrink-0">
                  <span
                    class="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">primary</span>
                  <span class="px-2 py-0.5 rounded-full text-xs font-medium"
                    :class="agent.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'">
                    {{ agent.isActive ? 'active' : 'inactive' }}
                  </span>
                </div>
              </div>

              <p v-if="agent.description" class="text-sm text-slate-500 mb-3 line-clamp-2">{{ agent.description }}</p>

              <div class="flex items-center gap-2 text-xs text-slate-500 mb-4 flex-wrap">
                <span class="flex items-center gap-1 bg-slate-100 rounded-md px-2 py-1">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
                  </svg>
                  {{ agent.model }}
                </span>
                <span class="flex items-center gap-1 bg-slate-100 rounded-md px-2 py-1">
                  T: {{ agent.temperature }}
                </span>
                <span v-if="(agent.subagents ?? []).length"
                  class="flex items-center gap-1 bg-violet-50 text-violet-600 rounded-md px-2 py-1">
                  {{ (agent.subagents ?? []).length }} subagent{{ (agent.subagents ?? []).length !== 1 ? 's' : '' }}
                </span>
              </div>

              <div class="flex items-center gap-2 pt-3 border-t border-slate-700" @click.stop>
                <button
                  class="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-slate-100 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                  @click="openEdit(agent)">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
                <button
                  class="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-slate-100 hover:text-red-600 hover:bg-red-50 transition-colors"
                  @click="confirmDelete(agent)">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- Subagents -->
        <section>
          <h2 class="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-violet-500 inline-block"></span>
            Subagents
            <span class="ml-1 text-xs font-normal text-white">({{ subagents.length }})</span>
          </h2>
          <div v-if="!subagents.length"
            class="text-slate-400 text-sm py-6 text-center bg-slate-900 rounded-xl border border-slate-700">
            No subagents yet
          </div>
          <div v-else class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <div v-for="agent in subagents" :key="agent.id"
              class="bg-slate-900 rounded-xl border border-slate-700 shadow-sm hover:shadow-md transition-shadow p-5 cursor-pointer"
              @click="openDetail(agent)">
              <div class="flex items-start justify-between mb-3">
                <div class="flex-1 min-w-0">
                  <h3 class="font-semibold text-white truncate">{{ agent.name }}</h3>
                  <p class="text-xs text-slate-400 font-mono mt-0.5 truncate">{{ agent.slug }}</p>
                </div>
                <div class="flex items-center gap-1.5 ml-3 shrink-0">
                  <span
                    class="px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">subagent</span>
                  <span class="px-2 py-0.5 rounded-full text-xs font-medium"
                    :class="agent.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'">
                    {{ agent.isActive ? 'active' : 'inactive' }}
                  </span>
                </div>
              </div>

              <p v-if="agent.description" class="text-sm text-slate-500 mb-3 line-clamp-2">{{ agent.description }}</p>

              <div class="flex items-center gap-2 text-xs text-slate-500 mb-4 flex-wrap">
                <span class="flex items-center gap-1 bg-slate-100 rounded-md px-2 py-1">{{ agent.model }}</span>
                <span class="flex items-center gap-1 bg-slate-100 rounded-md px-2 py-1">T: {{ agent.temperature
                }}</span>
              </div>

              <div class="flex items-center gap-2 pt-3 border-t border-slate-100" @click.stop>
                <button
                  class="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                  @click="openEdit(agent)">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
                <button
                  class="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                  @click="confirmDelete(agent)">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- Agent Create / Edit Modal -->
    <div v-if="showModal" class="fixed inset-0 z-40 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closeModal" />
      <div
        class="relative bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[92vh] overflow-hidden">
        <!-- Header -->
        <div class="px-6 py-5 border-b border-slate-700 flex items-center justify-between shrink-0">
          <h2 class="text-lg font-semibold text-white">{{ editingAgent ? 'Edit Agent' : 'Create Agent' }}</h2>
          <button class="p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-700 transition"
            @click="closeModal">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto px-6 py-5">
          <form id="agent-form" class="space-y-5" @submit.prevent="saveAgent">
            <!-- Name + Slug -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-white mb-1.5">Name <span
                    class="text-red-500">*</span></label>
                <input v-model="agentForm.name" type="text" placeholder="My Agent" required
                  class="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
              </div>
              <div>
                <label class="block text-sm font-medium text-white mb-1.5">Slug <span
                    class="text-red-500">*</span></label>
                <input v-model="agentForm.slug" type="text" placeholder="my-agent" required
                  class="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
              </div>
            </div>

            <!-- Description -->
            <div>
              <label class="block text-sm font-medium text-white mb-1.5">Description</label>
              <input v-model="agentForm.description" type="text" placeholder="What does this agent do?"
                class="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
            </div>

            <!-- Mode + Active -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-white mb-1.5">Mode <span
                    class="text-red-500">*</span></label>
                <select v-model="agentForm.mode"
                  class="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ">
                  <option class="bg-slate-800" value="primary">Primary</option>
                  <option class="bg-slate-800" value="subagent">Subagent</option>
                </select>
              </div>
              <div class="flex flex-col">
                <label class="block text-sm font-medium text-white mb-1.5">Status</label>
                <label class="flex items-center gap-2.5 cursor-pointer mt-2">
                  <input v-model="agentForm.isActive" type="checkbox"
                    class="w-4 h-4 text-indigo-600 rounded border-slate-300 text-white focus:ring-indigo-500" />
                  <span class="text-sm text-white">Active</span>
                </label>
              </div>
            </div>

            <!-- Model + Temperature -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-white mb-1.5">Model <span
                    class="text-red-500">*</span></label>
                <input v-model="agentForm.model" type="text" placeholder="gpt-4o" required
                  class="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
              </div>
              <div>
                <label class="block text-sm font-medium text-white mb-1.5">Temperature</label>
                <input v-model="agentForm.temperature" type="text" placeholder="0.7"
                  class="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
              </div>
            </div>

            <!-- Content (system prompt) -->
            <div>
              <label class="block text-sm font-medium text-white mb-1.5">System Prompt / Content</label>
              <textarea v-model="agentForm.content" placeholder="Write the agent system prompt here..." rows="6"
                class="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y font-mono" />
            </div>

            <!-- Tools -->
            <div v-if="availableTools.length">
              <label class="block text-sm font-medium text-white mb-2">Tools</label>
              <div class="border border-slate-200 rounded-lg overflow-hidden">
                <div v-for="source in toolSources" :key="source">
                  <div class="px-4 py-2 bg-slate-800 border-b border-slate-200">
                    <span class="text-xs font-semibold text-white uppercase tracking-wider">{{ source }}</span>
                  </div>
                  <div class="divide-y divide-slate-100">
                    <label v-for="tool in toolsBySource(source)" :key="tool.name"
                      class="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700 cursor-pointer transition-colors">
                      <input v-model="agentForm.tools[tool.name]" type="checkbox"
                        class="w-4 h-4 rounded border-slate-300 text-white focus:ring-indigo-500" />
                      <div class="flex-1 min-w-0">
                        <span class="text-sm font-medium text-white">{{ tool.name }}</span>
                        <span v-if="tool.description" class="text-xs text-slate-400 ml-2">{{ tool.description }}</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="text-xs text-slate-400">No tools available</div>

            <!-- Subagents (only for primary) -->
            <div v-if="agentForm.mode === 'primary' && subagents.length">
              <label class="block text-sm font-medium text-white mb-2">Assign Subagents</label>
              <div class="border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden">
                <label v-for="sub in subagents" :key="sub.id"
                  class="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors">
                  <input type="checkbox" :checked="agentForm.subagentIds.includes(sub.id)"
                    class="w-4 h-4 text-indigo-600 rounded border-slate-300 text-white focus:ring-indigo-500"
                    @change="toggleSubagent(sub.id)" />
                  <div>
                    <span class="text-sm font-medium text-white">{{ sub.name }}</span>
                    <span class="text-xs text-slate-400 font-mono ml-2">{{ sub.slug }}</span>
                  </div>
                </label>
              </div>
            </div>
          </form>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-slate-200 flex gap-3 shrink-0">
          <button type="button"
            class="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 text-white text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            @click="closeModal">
            Cancel
          </button>
          <button type="submit" form="agent-form" :disabled="saving"
            class="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors">
            {{ saving ? 'Saving...' : editingAgent ? 'Save Changes' : 'Create Agent' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Agent Detail Modal -->
    <div v-if="detailAgent" class="fixed inset-0 z-40 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="detailAgent = null" />
      <div
        class="relative bg-slate-900 rounded-2xl shadow-2xl w-full max-w-xl mx-4 flex flex-col max-h-[85vh] overflow-hidden">
        <div class="px-6 py-5 border-b border-slate-700 flex items-center justify-between shrink-0">
          <div>
            <h2 class="text-lg font-semibold text-white">{{ detailAgent.name }}</h2>
            <p class="text-xs text-slate-400 font-mono">{{ detailAgent.slug }}</p>
          </div>
          <button class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
            @click="detailAgent = null">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <!-- Badges -->
          <div class="flex flex-wrap gap-2">
            <span
              :class="detailAgent.mode === 'primary' ? 'bg-indigo-100 text-indigo-700' : 'bg-violet-100 text-violet-700'"
              class="px-2.5 py-1 rounded-full text-xs font-semibold">
              {{ detailAgent.mode }}
            </span>
            <span :class="detailAgent.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'"
              class="px-2.5 py-1 rounded-full text-xs font-semibold">
              {{ detailAgent.isActive ? 'active' : 'inactive' }}
            </span>
            <span class="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full text-xs font-mono">{{ detailAgent.model
            }}</span>
            <span class="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full text-xs">T: {{ detailAgent.temperature
            }}</span>
          </div>

          <!-- Description -->
          <div v-if="detailAgent.description">
            <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Description</h3>
            <p class="text-sm text-slate-600">{{ detailAgent.description }}</p>
          </div>

          <!-- System Prompt -->
          <div v-if="detailAgent.content">
            <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">System Prompt</h3>
            <pre
              class="text-xs bg-slate-800 rounded-lg p-3 text-slate-200 overflow-x-auto whitespace-pre-wrap font-mono border border-slate-700">{{ detailAgent.content }}</pre>
          </div>

          <!-- Tools -->
          <div>
            <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Tools</h3>
            <div class="flex flex-wrap gap-1.5">
              <template v-for="(enabled, toolName) in detailAgent.tools" :key="toolName">
                <span v-if="enabled" class="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-700 text-white">{{
                  toolName }}</span>
              </template>
              <span v-if="!Object.values(detailAgent.tools).some(Boolean)" class="text-slate-400 text-xs">No tools
                enabled</span>
            </div>
          </div>

          <!-- Subagents (only for primary) -->
          <div v-if="detailAgent.mode === 'primary' && (detailAgent.subagents ?? []).length">
            <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Subagents</h3>
            <div class="space-y-1.5">
              <div v-for="sub in detailAgent.subagents" :key="sub.id"
                class="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700">
                <span class="text-sm font-medium text-white">{{ sub.name }}</span>
                <span class="text-xs text-slate-400 font-mono">{{ sub.slug }}</span>
              </div>
            </div>
          </div>

          <!-- Timestamps -->
          <div class="text-xs text-slate-400 space-y-1 pt-2 border-t border-slate-700">
            <div>Created: {{ new Date(detailAgent.createdAt).toLocaleString() }}</div>
            <div>Updated: {{ new Date(detailAgent.updatedAt).toLocaleString() }}</div>
          </div>
        </div>
        <div class="px-6 py-4 border-t border-slate-700 flex gap-3 shrink-0">
          <button
            class="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 text-white text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            @click="detailAgent = null">
            Close
          </button>
          <button
            class="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
            @click="() => { openEdit(detailAgent!); detailAgent = null }">
            Edit Agent
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirm -->
    <ConfirmDialog v-if="deleteTarget" title="Delete Agent"
      :message="`Are you sure you want to delete &quot;${deleteTarget.name}&quot;? This action cannot be undone.`"
      :loading="deleting" @confirm="doDelete" @cancel="deleteTarget = null" />
  </AppLayout>
</template>
