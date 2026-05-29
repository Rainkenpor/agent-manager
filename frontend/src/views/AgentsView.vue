<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import * as api from '@/api/api'
import AppModal from '@/components/AppModal.vue'
import Card from '@/components/Card.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import PageLayout from '@/components/PageLayout.vue'
import TextAreaComplete from '@/components/TextAreaComplete.vue'
import { useToastStore } from '@/store/useToast'
import type { Agent, AgentGroup, AgentTool } from '@/types/types'

const toast = useToastStore()

const agents = ref<Agent[]>([])
const availableTools = ref<AgentTool[]>([])
const groups = ref<AgentGroup[]>([])
const activeTab = ref<string>('__all__')
const showGroupsModal = ref(false)
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
	groupIds: string[]
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
	groupIds: [],
	model: '',
	temperature: '0.7',
	content: '',
	isActive: true,
	tools: {},
	subagentIds: []
})

const agentForm = ref<AgentFormData>(defaultForm())

// Delete
const deleteTarget = ref<Agent | null>(null)
const deleting = ref(false)

// Detail view
const detailAgent = ref<Agent | null>(null)

const groupById = computed(() => {
	const map = new Map<string, AgentGroup>()
	for (const g of groups.value) map.set(g.id, g)
	return map
})

const agentGroupCountByTab = computed(() => {
	const counts: Record<string, number> = { __all__: agents.value.length, __ungrouped__: 0 }
	for (const g of groups.value) counts[g.id] = 0
	for (const a of agents.value) {
		if (!a.groupIds || a.groupIds.length === 0) counts.__ungrouped__ += 1
		else for (const gid of a.groupIds) if (counts[gid] !== undefined) counts[gid] += 1
	}
	return counts
})

const filteredAgents = computed(() => {
	if (activeTab.value === '__all__') return agents.value
	if (activeTab.value === '__ungrouped__') return agents.value.filter((a) => !a.groupIds?.length)
	return agents.value.filter((a) => a.groupIds?.includes(activeTab.value))
})

const primaryAgents = computed(() => filteredAgents.value.filter((a) => a.mode === 'primary'))
const subagents = computed(() => filteredAgents.value.filter((a) => a.mode === 'subagent'))

function groupColorOrFallback(g: AgentGroup | undefined): string {
	return g?.color || '#a855f7'
}

function groupChipStyle(groupId: string): { backgroundColor: string; color: string; borderColor: string } {
	const g = groupById.value.get(groupId)
	const color = groupColorOrFallback(g)
	return {
		backgroundColor: `${color}1f`,
		color: color,
		borderColor: `${color}66`
	}
}

function tabStyle(groupId: string, active: boolean): Record<string, string> {
	const g = groupById.value.get(groupId)
	if (!g) return {}
	const color = groupColorOrFallback(g)
	if (active) {
		return { backgroundColor: `${color}26`, color: color, borderColor: color }
	}
	return { color: color, borderColor: 'transparent' }
}

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
	}
)

async function fetchData() {
	loading.value = true
	try {
		const [agentsRes, toolsRes, groupsRes] = await Promise.all([api.getAgents(), api.getAgentTools(), api.getAgentGroups()])
		agents.value = agentsRes.data ?? (agentsRes as any)
		availableTools.value = toolsRes.data ?? (toolsRes as any)
		groups.value = groupsRes.data ?? []
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
	selectedToolSource.value = toolGroups.value[0]?.key ?? ''
	showModal.value = true
}

function openEdit(agent: Agent) {
	editingAgent.value = agent
	const form: AgentFormData = {
		name: agent.name,
		slug: agent.slug,
		description: agent.description ?? '',
		mode: agent.mode,
		groupIds: [...(agent.groupIds ?? [])],
		model: agent.model,
		temperature: agent.temperature,
		content: agent.content,
		isActive: agent.isActive,
		tools: { ...agent.tools },
		subagentIds: (agent.subagents ?? []).map((s) => s.id)
	}
	// Ensure all available tools are represented
	for (const tool of availableTools.value) {
		if (!(tool.name in form.tools)) {
			form.tools[tool.name] = false
		}
	}
	agentForm.value = form
	selectedToolSource.value = toolGroups.value[0]?.key ?? ''
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
			groupIds: agentForm.value.groupIds,
			model: agentForm.value.model,
			temperature: agentForm.value.temperature,
			content: agentForm.value.content,
			isActive: agentForm.value.isActive,
			tools: agentForm.value.tools
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

async function duplicateAgent(agent: Agent) {
	try {
		await api.duplicateAgent(agent.id)
		toast.success(`Agente duplicado`)
		await fetchData()
	} catch (e: any) {
		toast.error(e.message ?? 'Failed to duplicate agent')
	}
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

function toolDisplayName(toolName: string): string {
	if (toolName.startsWith('mcp__')) {
		const idx = toolName.indexOf('__', 5)
		return idx !== -1 ? toolName.slice(idx + 2) : toolName
	}
	return toolName
}

function selectGroup(group: string) {
	if (selectedToolSource.value === group) {
		selectedToolSource.value = ''
		return
	}
	selectedToolSource.value = group
}

function checkGroup(group: { key: string; label: string; tools: AgentTool[] }) {
	if (group.tools.filter((t) => agentForm.value.tools[t.name]).length === group.tools.length) {
		group.tools.forEach((t) => (agentForm.value.tools[t.name] = false))
	} else {
		group.tools.forEach((t) => (agentForm.value.tools[t.name] = true))
	}
}

const toolGroups = computed(() => {
	const byKey: Record<string, AgentTool[]> = {}
	for (const tool of availableTools.value) {
		const key = tool.source === 'external' && tool.name.startsWith('mcp__') ? tool.name.slice(5).split('__')[0] : tool.source
		if (!byKey[key]) byKey[key] = []
		byKey[key].push(tool)
	}
	const order = ['builtin', 'registry']
	const result: Array<{ key: string; label: string; tools: AgentTool[] }> = []
	for (const k of order) {
		if (byKey[k]?.length) result.push({ key: k, label: k, tools: byKey[k] })
	}
	for (const [k, tools] of Object.entries(byKey)) {
		if (!order.includes(k)) result.push({ key: k, label: k, tools })
	}
	return result
})

const selectedToolSource = ref<string>('')

// ─── Group management ────────────────────────────────────────────────────────
const newGroupName = ref('')
const newGroupSlug = ref('')
const newGroupDescription = ref('')
const newGroupIcon = ref('mdi-folder-outline')
const newGroupColor = ref('#a855f7')
const savingGroup = ref(false)
const editingGroupId = ref<string | null>(null)
const SYSTEM_GROUP_SLUGS = new Set(['traceability', 'chat'])

function isSystemGroup(g: AgentGroup): boolean {
	return SYSTEM_GROUP_SLUGS.has(g.slug)
}

function groupAgentCount(groupId: string): number {
	return agents.value.filter((a) => a.groupIds?.includes(groupId)).length
}

function toggleFormGroup(groupId: string) {
	const idx = agentForm.value.groupIds.indexOf(groupId)
	if (idx === -1) agentForm.value.groupIds.push(groupId)
	else agentForm.value.groupIds.splice(idx, 1)
}

function resetGroupForm() {
	editingGroupId.value = null
	newGroupName.value = ''
	newGroupSlug.value = ''
	newGroupDescription.value = ''
	newGroupIcon.value = 'mdi-folder-outline'
	newGroupColor.value = '#a855f7'
}

function startEditGroup(g: AgentGroup) {
	editingGroupId.value = g.id
	newGroupName.value = g.name
	newGroupSlug.value = g.slug
	newGroupDescription.value = g.description ?? ''
	newGroupIcon.value = g.icon || 'mdi-folder-outline'
	newGroupColor.value = g.color || '#a855f7'
}

async function saveGroup() {
	const name = newGroupName.value.trim()
	const slug = newGroupSlug.value.trim() || slugify(name)
	if (!name || !slug) return
	savingGroup.value = true
	try {
		const payload = {
			name,
			slug,
			description: newGroupDescription.value.trim() || null,
			icon: newGroupIcon.value.trim() || null,
			color: newGroupColor.value || null
		}
		if (editingGroupId.value) {
			await api.updateAgentGroup(editingGroupId.value, payload)
			toast.success('Grupo actualizado')
		} else {
			await api.createAgentGroup(payload)
			toast.success('Grupo creado')
		}
		resetGroupForm()
		const res = await api.getAgentGroups()
		groups.value = res.data ?? []
	} catch (e: any) {
		toast.error(e.message ?? 'Failed to save group')
	} finally {
		savingGroup.value = false
	}
}

async function removeGroup(g: AgentGroup) {
	if (isSystemGroup(g)) {
		toast.error('No se puede eliminar un grupo del sistema')
		return
	}
	if (groupAgentCount(g.id) > 0) {
		toast.error('No se puede eliminar un grupo con agentes asignados')
		return
	}
	try {
		await api.deleteAgentGroup(g.id)
		groups.value = groups.value.filter((x) => x.id !== g.id)
		toast.success('Grupo eliminado')
	} catch (e: any) {
		toast.error(e.message ?? 'Failed to delete group')
	}
}

watch(newGroupName, (v) => {
	if (!newGroupSlug.value) newGroupSlug.value = slugify(v)
})
</script>

<template>
  <PageLayout title="Agents" description="Manage primary agents and subagents">
    <template #actions>
      <div class="flex items-center gap-2">
        <button
          class="flex items-center gap-2 bg-base-200 hover:bg-base-100 border border-base-content/20 text-base-content px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          @click="showGroupsModal = true">
          <span class="mdi mdi-folder-multiple-outline"></span>
          Grupos
        </button>
        <button
          class="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
          @click="openCreate">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Create Agent
        </button>
      </div>
    </template>

    <!-- Tabs por grupo -->
    <div v-if="!loading" class="flex flex-wrap items-center gap-1.5 mb-5 border-b border-base-300 pb-2">
      <button @click="activeTab = '__all__'"
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-colors" :class="activeTab === '__all__'
          ? 'bg-indigo-600/20 border-indigo-500 text-white'
          : 'border-transparent text-base-content/60 hover:text-base-content hover:bg-base-200'">
        <span class="mdi mdi-view-grid-outline"></span>
        Todos
        <span class="text-[10px] opacity-70">({{ agentGroupCountByTab.__all__ }})</span>
      </button>
      <button v-for="g in groups" :key="g.id" @click="activeTab = g.id"
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-colors"
        :style="tabStyle(g.id, activeTab === g.id)" :class="activeTab === g.id ? '' : 'hover:bg-base-200'">
        <span :class="['mdi', g.icon || 'mdi-folder-outline']"></span>
        {{ g.name }}
        <span class="text-[10px] opacity-70">({{ agentGroupCountByTab[g.id] || 0 }})</span>
      </button>
      <button @click="activeTab = '__ungrouped__'"
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-colors" :class="activeTab === '__ungrouped__'
          ? 'bg-base-100/40 border-base-content/30 text-base-content'
          : 'border-transparent text-base-content/50 hover:text-base-content hover:bg-base-200'">
        <span class="mdi mdi-folder-off-outline"></span>
        Sin grupo
        <span class="text-[10px] opacity-70">({{ agentGroupCountByTab.__ungrouped__ }})</span>
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
        <h2 class="text-base font-semibold text-base-content mb-4 flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-indigo-500 inline-block"></span>
          Listado de Agentes
          <span class="ml-1 text-xs font-normal text-base-content">({{ primaryAgents.length }})</span>
        </h2>
        <div v-if="!primaryAgents.length"
          class="text-base-content/60 text-sm py-6 text-center bg-base-300 rounded-xl border border-base-300">
          No existen agentes
        </div>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <Card v-for="agent in primaryAgents" :key="agent.id" @click="openDetail(agent)">
            <template #header>
              <div class="flex w-full">
                <div class="flex-1 overflow-auto ">
                  <h3 class="font-semibold text-base-content truncate">{{ agent.name }}</h3>
                  <p class="text-xs text-base-content/60 font-mono mt-0.5 truncate">{{ agent.slug }}</p>
                </div>
                <div class="flex items-start gap-1.5 flex-wrap justify-end">
                  <span v-for="gid in (agent.groupIds ?? [])" :key="gid"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border"
                    :style="groupChipStyle(gid)">
                    <span v-if="groupById.get(gid)?.icon" :class="['mdi', groupById.get(gid)?.icon]"></span>
                    {{ groupById.get(gid)?.name || 'grupo' }}
                  </span>
                  <span class="px-2 py-0.5 rounded-full text-xs font-medium"
                    :class="agent.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-base-100 text-base-content/50'">
                    {{ agent.isActive ? 'active' : 'inactive' }}
                  </span>
                </div>
              </div>
            </template>

            <p v-if="agent.description" class="text-sm text-base-content/50 mb-3 line-clamp-2">{{ agent.description }}</p>

            <div class="flex items-center gap-2 text-xs text-base-content/50 mb-4 flex-wrap">
              <span v-if="(agent.subagents ?? []).length"
                class="flex items-center gap-1 bg-violet-50 text-violet-600 rounded-md px-2 py-1">
                {{ (agent.subagents ?? []).length }} subagent{{ (agent.subagents ?? []).length !== 1 ? 's' : '' }}
              </span>
            </div>

            <template #options>
              <button
                class="btn w-full justify-start btn-ghost hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                @click="openEdit(agent)">
                <span class="mdi mdi-pencil"></span>
                Edit
              </button>
              <button
                class="btn w-full justify-start btn-ghost hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                @click="duplicateAgent(agent)">
                <span class="mdi mdi-content-copy"></span>
                Duplicate
              </button>
              <button class="btn w-full justify-start btn-ghost hover:text-red-600 hover:bg-red-50 transition-colors"
                @click="confirmDelete(agent)">
                <span class="mdi mdi-delete"></span>
                Delete
              </button>
            </template>
          </Card>
        </div>
      </section>

    </div>
  </PageLayout>

  <!-- Agent Create / Edit Modal -->
  <AppModal v-if="showModal" size="5xl" :full-height="true" :scroll-body="false"
    :title="editingAgent ? 'Editar Agente' : 'Crear Agente'" @close="closeModal">
    <div class="flex flex-1 overflow-auto min-h-0">
      <!-- Left: Form -->
      <div class="flex-1 flex flex-col overflow-auto px-6 py-5">
        <div class="overflow-auto p-2">
          <form id="agent-form" class="space-y-5" @submit.prevent="saveAgent">
            <!-- Name + Slug -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-base-content mb-1.5">Name <span
                    class="text-red-500">*</span></label>
                <input v-model="agentForm.name" type="text" placeholder="My Agent" required
                  class="w-full px-3 py-2.5 rounded-lg border border-base-content/20 bg-base-200 text-base-content text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label class="block text-sm font-medium text-base-content mb-1.5">Slug <span
                    class="text-red-500">*</span></label>
                <input v-model="agentForm.slug" type="text" placeholder="my-agent" required
                  class="w-full px-3 py-2.5 rounded-lg border border-base-content/20 bg-base-200 text-base-content text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>

            <!-- Description -->
            <div>
              <label class="block text-sm font-medium text-base-content mb-1.5">Description</label>
              <input v-model="agentForm.description" type="text" placeholder="What does this agent do?"
                class="w-full px-3 py-2.5 rounded-lg border border-base-content/20 bg-base-200 text-base-content text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <!-- Mode + Active -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-base-content mb-1.5">Mode <span
                    class="text-red-500">*</span></label>
                <select v-model="agentForm.mode"
                  class="w-full px-3 py-2.5 rounded-lg border border-base-content/20 bg-base-200 text-base-content text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="primary">Primary</option>
                  <option value="subagent">Subagent</option>
                </select>
              </div>
              <div class="flex flex-col">
                <label class="block text-sm font-medium text-base-content mb-1.5">Status</label>
                <label class="flex items-center gap-2.5 cursor-pointer mt-2">
                  <input v-model="agentForm.isActive" type="checkbox"
                    class="w-4 h-4 text-indigo-600 rounded border-base-content/20 focus:ring-indigo-500" />
                  <span class="text-sm text-base-content">Active</span>
                </label>
              </div>
            </div>

            <!-- Groups (multi-select) -->
            <div>
              <label class="block text-sm font-medium text-base-content mb-1.5">Grupos</label>
              <div v-if="!groups.length" class="text-xs text-base-content/50 italic">No hay grupos disponibles.</div>
              <div v-else class="flex flex-wrap gap-2">
                <button v-for="g in groups" :key="g.id" type="button" @click="toggleFormGroup(g.id)"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-colors"
                  :style="agentForm.groupIds.includes(g.id) ? groupChipStyle(g.id) : { borderColor: '#334155', color: '#94a3b8' }">
                  <span v-if="agentForm.groupIds.includes(g.id)" class="mdi mdi-check"></span>
                  <span v-else :class="['mdi', g.icon || 'mdi-folder-outline']"></span>
                  {{ g.name }}
                </button>
              </div>
              <p class="text-xs text-base-content/60 mt-1.5">
                Un agente puede pertenecer a varios grupos. Solo los agentes del grupo "Trazabilidad" se ofrecen al
                asignar etapas en las plantillas de trazabilidad.
              </p>
            </div>



            <!-- Content (system prompt) -->
            <div>
              <label class="block text-sm font-medium text-base-content mb-1.5">System Prompt / Content</label>
              <TextAreaComplete v-model="agentForm.content" placeholder="Write the agent system prompt here..." />
            </div>
          </form>
        </div>
      </div>

      <!-- Right: Tool selection panel -->
      <div class="w-80 border-l border-base-300/60 flex flex-col overflow-auto shrink-0">

        <div class="flex-1 flex flex-col overflow-auto p-2">
          <!-- Tools -->
          <div v-if="availableTools.length" class="overflow-auto flex-1 flex flex-col mb-3">
            <label class="block text-sm font-medium text-base-content mb-2">Tools</label>
            <div class="border border-base-300 rounded-lg flex flex-col overflow-auto">
              <div class="flex-1 overflow-auto border-r border-base-300 shrink-0 bg-base-200/50">
                <div v-for="group in toolGroups" :key="group.key">
                  <button type="button"
                    class="w-full text-left px-3 py-2.5 transition-colors flex items-center justify-between gap-1 border-l-2"
                    :class="selectedToolSource === group.key
                      ? 'bg-indigo-600/20 border-indigo-500 text-white'
                      : 'border-transparent text-base-content/60 hover:bg-base-100 hover:text-base-content'"
                    @click="selectGroup(group.key)">
                    <span class="text-xs font-semibold uppercase tracking-wider truncate">
                      <input type="checkbox" class="checkbox checkbox-sm mr-2"
                        :checked="group.tools.filter(t => agentForm.tools[t.name]).length === group.tools.length"
                        :indeterminate="group.tools.filter(t => agentForm.tools[t.name]).length > 0 && group.tools.filter(t => agentForm.tools[t.name]).length < group.tools.length"
                        @click.stop="" @change="checkGroup(group)" />
                      {{ group.label }}
                    </span>
                    <span class="text-xs shrink-0"
                      :class="selectedToolSource === group.key ? 'text-indigo-400' : 'text-base-content/40'">
                      {{group.tools.filter(t => agentForm.tools[t.name]).length}}/{{ group.tools.length }}
                    </span>
                  </button>
                  <div v-if="group.label === selectedToolSource">
                    <label v-for="tool in group.tools ?? []" :key="tool.name"
                      class="flex items-center gap-3 px-4 py-2.5 hover:bg-base-100 cursor-pointer transition-colors">
                      <input v-model="agentForm.tools[tool.name]" type="checkbox"
                        class="w-4 h-4 rounded border-base-content/20 text-indigo-600 focus:ring-indigo-500 shrink-0" />
                      <div class="flex-1 min-w-0">
                        <span class="text-sm font-mono font-medium text-base-content">{{ toolDisplayName(tool.name) }}</span>
                        <p v-if="tool.description" class="text-xs text-base-content/60 mt-0.5 line-clamp-2">{{
                          tool.description
                        }}</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
              <div class="overflow-y-auto divide-y divide-base-300/50">
                <div v-if="!selectedToolSource" class="flex items-center justify-center h-full text-base-content/50 text-xs">
                  Select a source
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-xs text-base-content/60 mb-20">No tools available</div>

          <!-- Subagents (only for primary) -->
          <div v-if="agentForm.mode === 'primary' && subagents.length" class="overflow-auto flex flex-col">
            <label class="block text-sm font-medium text-base-content mb-2">Assign Subagents</label>
            <div class="border border-base-300 rounded-lg divide-y divide-base-300/50 overflow-auto max-h-50">
              <label v-for="sub in subagents" :key="sub.id"
                class="flex items-center gap-3 px-4 py-2.5 hover:bg-base-200 cursor-pointer transition-colors">
                <input type="checkbox" :checked="agentForm.subagentIds.includes(sub.id)"
                  class="w-4 h-4 text-indigo-600 rounded border-base-content/20 focus:ring-indigo-500"
                  @change="toggleSubagent(sub.id)" />
                <div>
                  <span class="text-sm font-medium text-base-content">{{ sub.name }}</span>
                  <span class="text-xs text-base-content/60 font-mono ml-2">{{ sub.slug }}</span>
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-between gap-3">
        <button type="button" class="btn btn-ghost" @click="closeModal">
          Cancelar
        </button>
        <button type="submit" form="agent-form" :disabled="saving" class="btn btn-ghost btn-success">
          {{ saving ? 'Guardando...' : editingAgent ? 'Guardar Cambios' : 'Crear Agente' }}
        </button>
      </div>
    </template>
  </AppModal>

  <!-- Agent Detail Modal -->
  <AppModal v-if="detailAgent" size="5xl" :full-height="true" :scroll-body="false" :title="detailAgent.name"
    :description="detailAgent.slug" @close="() => detailAgent = null">

    <div class="flex-1 overflow-y-auto px-6 py-5 space-y-5">
      <!-- Badges -->
      <div class="flex flex-wrap gap-2">
        <span
          :class="detailAgent.mode === 'primary' ? 'bg-indigo-100 text-indigo-700' : 'bg-violet-100 text-violet-700'"
          class="px-2.5 py-1 rounded-full text-xs font-semibold">
          {{ detailAgent.mode }}
        </span>
        <span :class="detailAgent.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-base-100 text-base-content/50'"
          class="px-2.5 py-1 rounded-full text-xs font-semibold">
          {{ detailAgent.isActive ? 'active' : 'inactive' }}
        </span>
        <span class="bg-base-100 text-base-content/40 px-2.5 py-1 rounded-full text-xs font-mono">{{ detailAgent.model
        }}</span>
        <span class="bg-base-100 text-base-content/40 px-2.5 py-1 rounded-full text-xs">T: {{ detailAgent.temperature
        }}</span>
      </div>

      <!-- Description -->
      <div v-if="detailAgent.description">
        <h3 class="text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-1.5">Description</h3>
        <p class="text-sm text-base-content/40">{{ detailAgent.description }}</p>
      </div>

      <!-- System Prompt -->
      <div v-if="detailAgent.content">
        <h3 class="text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-1.5">System Prompt</h3>
        <pre class="text-xs bg-base-200 rounded-lg p-3 text-base-content overflow-x-auto whitespace-pre-wrap font-mono">{{
          detailAgent.content }}</pre>
      </div>

      <!-- Tools -->
      <div>
        <h3 class="text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-2">Tools</h3>
        <div class="flex flex-wrap gap-1.5">
          <template v-for="(enabled, toolName) in detailAgent.tools" :key="toolName">
            <span v-if="enabled" class="px-2.5 py-1 rounded-full text-xs font-medium bg-base-100 text-base-content">{{
              toolName }}</span>
          </template>
          <span v-if="!Object.values(detailAgent.tools).some(Boolean)" class="text-base-content/60 text-xs">No tools
            enabled</span>
        </div>
      </div>

      <!-- Subagents (only for primary) -->
      <div v-if="detailAgent.mode === 'primary' && (detailAgent.subagents ?? []).length">
        <h3 class="text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-2">Subagents</h3>
        <div class="space-y-1.5">
          <div v-for="sub in detailAgent.subagents" :key="sub.id"
            class="flex items-center gap-3 px-3 py-2 rounded-lg bg-base-200 border border-base-300">
            <span class="text-sm font-medium text-base-content">{{ sub.name }}</span>
            <span class="text-xs text-base-content/60 font-mono">{{ sub.slug }}</span>
          </div>
        </div>
      </div>

      <!-- Timestamps -->
      <div class="text-xs text-base-content/60 space-y-1 pt-2 border-t border-base-300">
        <div>Created: {{ new Date(detailAgent.createdAt).toLocaleString() }}</div>
        <div>Updated: {{ new Date(detailAgent.updatedAt).toLocaleString() }}</div>
      </div>
    </div>
    <template #footer>
      <div class="flex justify-between">
        <button class="btn btn-ghost" @click="detailAgent = null">
          Cerrar
        </button>
        <button class="btn btn-ghost btn-info" @click="() => { openEdit(detailAgent!); detailAgent = null }">
          Editar Agente
        </button>
      </div>
    </template>
  </AppModal>

  <!-- Delete Confirm -->
  <ConfirmDialog v-if="deleteTarget" title="Delete Agent"
    :message="`Are you sure you want to delete &quot;${deleteTarget.name}&quot;? This action cannot be undone.`"
    :loading="deleting" @confirm="doDelete" @cancel="deleteTarget = null" />

  <!-- Groups management modal -->
  <AppModal v-if="showGroupsModal" size="lg" title="Grupos de agentes"
    @close="() => { showGroupsModal = false; resetGroupForm() }">
    <div class="p-6 space-y-5">
      <p class="text-sm text-base-content/60">
        Organiza los agentes por grupos. Cada grupo puede tener su propio icono (clase <span
          class="font-mono text-base-content">mdi-*</span>)
        y color. El grupo <span class="font-mono text-cyan-300">traceability</span> alimenta las etapas de plantillas
        de trazabilidad.
      </p>

      <!-- Existing groups -->
      <div class="space-y-2 max-h-64 overflow-y-auto pr-1">
        <div v-for="g in groups" :key="g.id"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-base-200/60 border border-base-300">
          <span class="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-lg"
            :style="{ backgroundColor: `${g.color || '#a855f7'}26`, color: g.color || '#a855f7' }">
            <span :class="['mdi', g.icon || 'mdi-folder-outline']"></span>
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <p class="text-sm font-medium text-base-content truncate">{{ g.name }}</p>
              <span class="text-xs font-mono text-base-content/50">{{ g.slug }}</span>
              <span v-if="isSystemGroup(g)"
                class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20">
                sistema
              </span>
            </div>
            <p v-if="g.description" class="text-xs text-base-content/50 truncate">{{ g.description }}</p>
          </div>
          <span class="text-xs text-base-content/50 shrink-0">{{ groupAgentCount(g.id) }} agentes</span>
          <button class="text-base-content/50 hover:text-indigo-400 shrink-0" @click="startEditGroup(g)" title="Editar">
            <span class="mdi mdi-pencil"></span>
          </button>
          <button class="text-base-content/50 hover:text-red-400 shrink-0 disabled:opacity-30"
            :disabled="isSystemGroup(g) || groupAgentCount(g.id) > 0" @click="removeGroup(g)" title="Eliminar grupo">
            <span class="mdi mdi-delete"></span>
          </button>
        </div>
        <div v-if="!groups.length" class="text-sm text-base-content/50 text-center py-4">Aún no hay grupos</div>
      </div>

      <!-- Create / edit -->
      <div class="border-t border-base-300 pt-4 space-y-3">
        <div class="flex items-center justify-between">
          <p class="text-sm font-semibold text-base-content">
            {{ editingGroupId ? 'Editar grupo' : 'Nuevo grupo' }}
          </p>
          <button v-if="editingGroupId" class="text-xs text-base-content/60 hover:text-base-content" @click="resetGroupForm">
            Cancelar edición
          </button>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <input v-model="newGroupName" type="text" placeholder="Nombre"
            class="px-3 py-2 rounded-lg bg-base-200 border border-base-300 text-sm text-base-content placeholder:text-base-content/40 focus:outline-none focus:border-indigo-500" />
          <input v-model="newGroupSlug" type="text" placeholder="slug"
            class="px-3 py-2 rounded-lg bg-base-200 border border-base-300 text-sm text-base-content placeholder:text-base-content/40 font-mono focus:outline-none focus:border-indigo-500" />
        </div>
        <input v-model="newGroupDescription" type="text" placeholder="Descripción (opcional)"
          class="w-full px-3 py-2 rounded-lg bg-base-200 border border-base-300 text-sm text-base-content placeholder:text-base-content/40 focus:outline-none focus:border-indigo-500" />

        <div class="grid grid-cols-[1fr_auto] gap-3 items-center">
          <div>
            <label class="block text-xs text-base-content/60 mb-1">Icono (clase mdi-*)</label>
            <div class="flex items-center gap-2">
              <span class="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0"
                :style="{ backgroundColor: `${newGroupColor}26`, color: newGroupColor }">
                <span :class="['mdi', newGroupIcon || 'mdi-folder-outline']"></span>
              </span>
              <input v-model="newGroupIcon" type="text" placeholder="mdi-folder-outline"
                class="flex-1 px-3 py-2 rounded-lg bg-base-200 border border-base-300 text-sm text-base-content placeholder:text-base-content/40 font-mono focus:outline-none focus:border-indigo-500" />
            </div>
          </div>
          <div>
            <label class="block text-xs text-base-content/60 mb-1">Color</label>
            <input v-model="newGroupColor" type="color"
              class="w-16 h-9 rounded-lg bg-base-200 border border-base-300 cursor-pointer" />
          </div>
        </div>

        <div class="flex justify-end">
          <button @click="saveGroup" :disabled="savingGroup || !newGroupName.trim()"
            class="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium transition-colors">
            {{ savingGroup ? 'Guardando...' : (editingGroupId ? 'Guardar cambios' : 'Crear grupo') }}
          </button>
        </div>
      </div>
    </div>
  </AppModal>
</template>
