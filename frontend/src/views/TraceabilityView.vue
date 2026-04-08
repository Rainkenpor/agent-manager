<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import AppLayout from '@/components/AppLayout.vue'
import { useAuthStore } from '@/store/useAuth'
import { useToastStore } from '@/store/useToast'
import * as api from '@/api/api'

const auth = useAuthStore()
const toast = useToastStore()

// ── Tabs ─────────────────────────────────────────────────────────────────────
const activeTab = ref<'traceabilities' | 'templates'>('traceabilities')

// ── Shared data ───────────────────────────────────────────────────────────────
const templates = ref<any[]>([])
const traceabilities = ref<any[]>([])
const roles = ref<any[]>([])
const agents = ref<any[]>([])
const loading = ref(false)

const canCreate = computed(() => auth.hasPermission('traceability', 'create'))
const canUpdate = computed(() => auth.hasPermission('traceability', 'update'))
const canDelete = computed(() => auth.hasPermission('traceability', 'delete'))

function roleNameById(id: string) {
  if (!id) return ''
  return roles.value.find(r => r.id === id)?.name ?? id
}

function agentNameById(id: string) {
  if (!id) return ''
  return agents.value.find(a => a.id === id)?.name ?? id
}

async function fetchAll() {
  loading.value = true
  try {
    const [tplRes, tracRes, rolesRes, agentsRes] = await Promise.all([
      api.getTraceabilityTemplates(),
      api.getTraceabilities(),
      api.getRoles(),
      api.getAgents(),
    ])
    templates.value = tplRes.data ?? []
    traceabilities.value = tracRes.data ?? []
    roles.value = Array.isArray(rolesRes) ? rolesRes : (rolesRes as any).data ?? []
    agents.value = (Array.isArray(agentsRes) ? agentsRes : (agentsRes as any).data ?? []).filter((a: any) => a.isActive)
  } catch (e: any) {
    toast.error(e.message)
  } finally {
    loading.value = false
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: TRAZABILIDADES
// ══════════════════════════════════════════════════════════════════════════════

const showCreateTrac = ref(false)
const deleteTracTarget = ref<any>(null)
const tracForm = ref({ title: '', description: '', templateId: '' })

// ── Active traceability (detail panel) ────────────────────────────────────────
const activeTrac = ref<any>(null)
const loadingTrac = ref(false)
const editingTrac = ref(false)
const editTracForm = ref({ title: '', description: '', status: '' })

const tracStatusLabel: Record<string, string> = { active: 'Activo', completed: 'Completado', archived: 'Archivado' }
const tracStatusClass: Record<string, string> = {
  active: 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20',
  completed: 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20',
  archived: 'bg-slate-500/10 text-slate-400 ring-1 ring-slate-500/20',
}

const stageStatusLabel: Record<string, string> = {
  pending: 'Pendiente', active: 'En progreso', completed: 'Completado',
  blocked: 'Bloqueado', 'in-review': 'En revisión',
}
const stageStatusClass: Record<string, string> = {
  pending: 'bg-slate-700 text-slate-300',
  active: 'bg-blue-500/20 text-blue-300',
  completed: 'bg-emerald-500/20 text-emerald-300',
  blocked: 'bg-red-500/20 text-red-300',
  'in-review': 'bg-amber-500/20 text-amber-300',
}
const taskStatusClass: Record<string, string> = {
  todo: 'text-slate-400', 'in-progress': 'text-blue-400', done: 'text-emerald-400', blocked: 'text-red-400',
}
const platformIcons: Record<string, string> = {
  jira: '🟦', confluence: '🟩', github: '⬛', gitlab: '🟧', generic: '🔗',
}

async function selectTrac(summary: any) {
  if (activeTrac.value?.id === summary.id) return
  loadingTrac.value = true
  editingTrac.value = false
  activeStage.value = null
  try {
    const res = await api.getTraceabilityById(summary.id)
    activeTrac.value = res.data
    editTracForm.value = { title: res.data.title, description: res.data.description ?? '', status: res.data.status }
  } catch (e: any) {
    toast.error(e.message)
  } finally {
    loadingTrac.value = false
  }
}

async function createTraceability() {
  if (!tracForm.value.title || !tracForm.value.templateId) return
  try {
    const res = await api.createTraceability(tracForm.value)
    toast.success('Trazabilidad creada')
    showCreateTrac.value = false
    tracForm.value = { title: '', description: '', templateId: '' }
    await fetchAll()
    await selectTrac(res.data)
  } catch (e: any) {
    toast.error(e.message)
  }
}

async function saveTrac() {
  if (!activeTrac.value) return
  try {
    await api.updateTraceability(activeTrac.value.id, editTracForm.value)
    toast.success('Actualizado')
    editingTrac.value = false
    const res = await api.getTraceabilityById(activeTrac.value.id)
    activeTrac.value = res.data
    await fetchAll()
  } catch (e: any) {
    toast.error(e.message)
  }
}

async function confirmDeleteTrac() {
  if (!deleteTracTarget.value) return
  try {
    await api.deleteTraceability(deleteTracTarget.value.id)
    toast.success('Trazabilidad eliminada')
    if (activeTrac.value?.id === deleteTracTarget.value.id) activeTrac.value = null
    deleteTracTarget.value = null
    await fetchAll()
  } catch (e: any) {
    toast.error(e.message)
  }
}

// DAG layers: topological sort of stages by predecessor relationships
function computeDagLayers(stages: any[]): any[][] {
  if (!stages.length) return []
  const layerOf = new Map<string, number>()
  const remaining = new Set(stages.map((s: any) => s.id))
  let layer = 0
  while (remaining.size > 0) {
    const ready = [...remaining].filter((id) => {
      const s = stages.find((x: any) => x.id === id)
      if (!s?.predecessors?.length) return true
      return s.predecessors.every((pid: string) => layerOf.has(pid))
    })
    if (!ready.length) { for (const id of remaining) layerOf.set(id, layer); break }
    for (const id of ready) { layerOf.set(id, layer); remaining.delete(id) }
    layer++
  }
  const maxLayer = Math.max(...Array.from(layerOf.values()), 0)
  const result: any[][] = []
  for (let l = 0; l <= maxLayer; l++) result.push(stages.filter((s: any) => layerOf.get(s.id) === l))
  return result
}

const dagLayers = computed(() => {
  if (!activeTrac.value?.stages) return []
  return computeDagLayers(activeTrac.value.stages)
})

const templateDagLayers = computed(() => {
  if (!activeTemplate.value?.stages) return []
  return computeDagLayers([...activeTemplate.value.stages].sort((a: any, b: any) => a.order - b.order))
})

// ── Stage / Task / Link ───────────────────────────────────────────────────────
const activeStage = ref<any>(null)
const showTaskForm = ref(false)
const taskForm = ref({ title: '', description: '', type: 'task', status: 'todo' })
const showLinkForm = ref(false)
const linkForm = ref({ label: '', url: '', platform: 'generic' })

function openStagePanel(stage: any) {
  activeStage.value = activeStage.value?.id === stage.id ? null : stage
  showTaskForm.value = false
  showLinkForm.value = false
  taskForm.value = { title: '', description: '', type: 'task', status: 'todo' }
  linkForm.value = { label: '', url: '', platform: 'generic' }
}

function syncStageInTrac(updatedStage: any) {
  if (!activeTrac.value) return
  const idx = activeTrac.value.stages.findIndex((s: any) => s.id === updatedStage.id)
  if (idx >= 0) {
    activeTrac.value.stages[idx] = { ...activeTrac.value.stages[idx], ...updatedStage }
    activeStage.value = activeTrac.value.stages[idx]
  }
}

async function createTask() {
  if (!taskForm.value.title) return
  try {
    const res = await api.createTraceabilityTask({ stageId: activeStage.value.id, ...taskForm.value })
    syncStageInTrac(res.data.stage)
    taskForm.value = { title: '', description: '', type: 'task', status: 'todo' }
    showTaskForm.value = false
    toast.success('Tarea creada')
  } catch (e: any) {
    toast.error(e.message)
  }
}

async function updateTask(task: any, patch: any) {
  try {
    const res = await api.updateTraceabilityTask(task.id, patch)
    syncStageInTrac(res.data.stage)
  } catch (e: any) {
    toast.error(e.message)
  }
}

async function deleteTask(task: any) {
  try {
    const res = await api.deleteTraceabilityTask(task.id, activeStage.value.id)
    syncStageInTrac(res.data.stage)
    toast.success('Tarea eliminada')
  } catch (e: any) {
    toast.error(e.message)
  }
}

async function createLink() {
  if (!linkForm.value.label || !linkForm.value.url) return
  try {
    const res = await api.createTraceabilityLink({ stageId: activeStage.value.id, ...linkForm.value })
    const idx = activeTrac.value.stages.findIndex((s: any) => s.id === activeStage.value.id)
    if (idx >= 0) {
      activeTrac.value.stages[idx].links.push(res.data)
      activeStage.value = activeTrac.value.stages[idx]
    }
    linkForm.value = { label: '', url: '', platform: 'generic' }
    showLinkForm.value = false
    toast.success('Link añadido')
  } catch (e: any) {
    toast.error(e.message)
  }
}

async function deleteLink(link: any) {
  try {
    await api.deleteTraceabilityLink(link.id)
    const idx = activeTrac.value.stages.findIndex((s: any) => s.id === activeStage.value.id)
    if (idx >= 0) {
      activeTrac.value.stages[idx].links = activeTrac.value.stages[idx].links.filter((l: any) => l.id !== link.id)
      activeStage.value = activeTrac.value.stages[idx]
    }
    toast.success('Link eliminado')
  } catch (e: any) {
    toast.error(e.message)
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: TEMPLATES
// ══════════════════════════════════════════════════════════════════════════════

const activeTemplate = ref<any>(null)
const showCreateTemplate = ref(false)
const deleteTplTarget = ref<any>(null)
const editingTemplate = ref(false)
const templateForm = ref({ name: '', description: '' })
const editTplForm = ref({ name: '', description: '' })

const showStageForm = ref(false)
const editingStage = ref<any>(null)
const stageForm = ref({
  name: '', description: '', role: '', order: 0, parallelGroup: '',
  type: 'manual' as 'manual' | 'agent', agentId: '' as string | null, predecessors: [] as string[],
})

function openTemplate(t: any) {
  activeTemplate.value = t
  editingTemplate.value = false
  editTplForm.value = { name: t.name, description: t.description ?? '' }
  showStageForm.value = false
  editingStage.value = null
}

async function createTemplate() {
  if (!templateForm.value.name) return
  try {
    const res = await api.createTraceabilityTemplate(templateForm.value)
    toast.success('Template creado')
    showCreateTemplate.value = false
    templateForm.value = { name: '', description: '' }
    await fetchAll()
    activeTemplate.value = templates.value.find(t => t.id === res.data.id) ?? null
  } catch (e: any) {
    toast.error(e.message)
  }
}

async function saveEditTemplate() {
  if (!activeTemplate.value || !editTplForm.value.name) return
  try {
    await api.updateTraceabilityTemplate(activeTemplate.value.id, editTplForm.value)
    toast.success('Template actualizado')
    editingTemplate.value = false
    const prevId = activeTemplate.value.id
    await fetchAll()
    activeTemplate.value = templates.value.find(t => t.id === prevId) ?? null
  } catch (e: any) {
    toast.error(e.message)
  }
}

async function confirmDeleteTemplate() {
  if (!deleteTplTarget.value) return
  try {
    await api.deleteTraceabilityTemplate(deleteTplTarget.value.id)
    toast.success('Template eliminado')
    if (activeTemplate.value?.id === deleteTplTarget.value.id) activeTemplate.value = null
    deleteTplTarget.value = null
    await fetchAll()
  } catch (e: any) {
    toast.error(e.message)
  }
}

function openStageForm(stage?: any) {
  if (stage) {
    editingStage.value = stage
    stageForm.value = {
      name: stage.name, description: stage.description ?? '',
      role: stage.role ?? '', order: stage.order, parallelGroup: stage.parallelGroup ?? '',
      type: stage.type ?? 'manual', agentId: stage.agentId ?? null,
      predecessors: Array.isArray(stage.predecessors) ? [...stage.predecessors] : [],
    }
  } else {
    editingStage.value = null
    stageForm.value = {
      name: '', description: '', role: '',
      order: activeTemplate.value?.stages?.length ?? 0, parallelGroup: '',
      type: 'manual', agentId: null, predecessors: [],
    }
  }
  showStageForm.value = true
}

async function saveStage() {
  if (!stageForm.value.name) return
  const payload = {
    ...stageForm.value,
    role: stageForm.value.role || undefined,
    parallelGroup: stageForm.value.parallelGroup || undefined,
    description: stageForm.value.description || undefined,
    agentId: stageForm.value.type === 'agent' ? (stageForm.value.agentId || null) : null,
    predecessors: stageForm.value.predecessors,
  }
  try {
    if (editingStage.value) {
      await api.updateTemplateStage(editingStage.value.id, payload)
      toast.success('Etapa actualizada')
    } else {
      await api.createTemplateStage({ templateId: activeTemplate.value.id, ...payload })
      toast.success('Etapa creada')
    }
    showStageForm.value = false
    editingStage.value = null
    const prevId = activeTemplate.value.id
    await fetchAll()
    activeTemplate.value = templates.value.find(t => t.id === prevId) ?? null
  } catch (e: any) {
    toast.error(e.message)
  }
}

function togglePredecessor(stageId: string) {
  const idx = stageForm.value.predecessors.indexOf(stageId)
  if (idx >= 0) stageForm.value.predecessors.splice(idx, 1)
  else stageForm.value.predecessors.push(stageId)
}

async function deleteStage(stage: any) {
  try {
    await api.deleteTemplateStage(stage.id)
    toast.success('Etapa eliminada')
    const prevId = activeTemplate.value.id
    await fetchAll()
    activeTemplate.value = templates.value.find(t => t.id === prevId) ?? null
  } catch (e: any) {
    toast.error(e.message)
  }
}

onMounted(fetchAll)
</script>

<template>
  <AppLayout>
    <div class="p-6 bg-slate-950 text-white min-h-full flex flex-col">

      <!-- Header -->
      <div class="flex items-center justify-between mb-5">
        <div>
          <h1 class="text-2xl font-bold text-white">Trazabilidad</h1>
          <p class="text-slate-400 text-sm mt-0.5">Flujos de trabajo con etapas, tareas y trazabilidad de avance</p>
        </div>
        <button v-if="activeTab === 'traceabilities' && canCreate" @click="showCreateTrac = true"
          class="px-4 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors">
          + Nueva Trazabilidad
        </button>
        <button v-if="activeTab === 'templates' && canCreate" @click="showCreateTemplate = true"
          class="px-4 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors">
          + Nuevo Template
        </button>
      </div>

      <!-- Tabs -->
      <div class="flex gap-1 mb-5 bg-slate-900 rounded-xl p-1 w-fit">
        <button v-for="tab in [{ key: 'traceabilities', label: 'Trazabilidades' }, { key: 'templates', label: 'Templates' }]"
          :key="tab.key" @click="activeTab = tab.key as any"
          class="px-4 py-2 text-sm rounded-lg font-medium transition-colors"
          :class="activeTab === tab.key ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'">
          {{ tab.label }}
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex justify-center py-20">
        <div class="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>

      <!-- ══════════════════════════════════════════════════════════════════════ -->
      <!-- TAB: TRAZABILIDADES -->
      <!-- ══════════════════════════════════════════════════════════════════════ -->
      <div v-if="!loading && activeTab === 'traceabilities'" class="flex gap-5 flex-1 min-h-0">

        <!-- Left: list -->
        <div class="w-72 shrink-0 space-y-2 overflow-y-auto">
          <div v-if="traceabilities.length === 0" class="text-center py-16 text-slate-500">
            <svg class="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
            </svg>
            <p class="text-sm">No hay trazabilidades</p>
            <p class="text-xs mt-1 text-slate-600">
              <span v-if="templates.length === 0">Crea un template primero</span>
              <span v-else>Pulsa "+ Nueva Trazabilidad"</span>
            </p>
          </div>

          <div v-for="item in traceabilities" :key="item.id"
            class="rounded-xl border p-3 cursor-pointer transition-all"
            :class="activeTrac?.id === item.id
              ? 'bg-slate-800 border-indigo-500 ring-1 ring-indigo-500/30'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'"
            @click="selectTrac(item)">
            <div class="flex items-start justify-between gap-2 mb-2">
              <p class="font-medium text-white text-sm truncate flex-1">{{ item.title }}</p>
              <span class="text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0" :class="tracStatusClass[item.status]">
                {{ tracStatusLabel[item.status] }}
              </span>
            </div>
            <div class="flex items-center justify-between gap-2">
              <div class="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                <div class="h-full bg-teal-500 rounded-full"
                  :style="`width:${item.stageCount ? Math.round((item.completedStages / item.stageCount) * 100) : 0}%`" />
              </div>
              <span class="text-xs text-slate-500 shrink-0">
                {{ item.completedStages }}/{{ item.stageCount }}
              </span>
              <button v-if="canDelete" @click.stop="deleteTracTarget = item"
                class="text-slate-600 hover:text-red-400 transition-colors shrink-0">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p v-if="item.templateName" class="text-xs text-slate-600 mt-1.5 truncate">{{ item.templateName }}</p>
          </div>
        </div>

        <!-- Center: traceability detail -->
        <div class="flex-1 min-w-0 overflow-y-auto">
          <!-- Empty state -->
          <div v-if="!activeTrac && !loadingTrac"
            class="flex flex-col items-center justify-center h-64 text-slate-500">
            <svg class="w-12 h-12 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
            </svg>
            <p>Selecciona una trazabilidad</p>
          </div>

          <div v-if="loadingTrac" class="flex justify-center py-20">
            <div class="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
          </div>

          <div v-if="activeTrac && !loadingTrac">
            <!-- Header -->
            <div class="mb-5">
              <div v-if="!editingTrac" class="flex items-start justify-between gap-3">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-3 flex-wrap">
                    <h2 class="text-xl font-bold text-white">{{ activeTrac.title }}</h2>
                    <span class="text-xs px-2 py-0.5 rounded-full font-medium"
                      :class="tracStatusClass[activeTrac.status]">
                      {{ tracStatusLabel[activeTrac.status] }}
                    </span>
                  </div>
                  <p v-if="activeTrac.description" class="text-slate-400 text-sm mt-1">{{ activeTrac.description }}</p>
                  <p v-if="activeTrac.templateName" class="text-xs text-slate-600 mt-1">Template: {{ activeTrac.templateName }}</p>
                </div>
                <button v-if="canUpdate" @click="editingTrac = true"
                  class="shrink-0 px-3 py-1.5 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors">
                  Editar
                </button>
              </div>

              <div v-else class="bg-slate-900 rounded-xl border border-slate-700 p-4 space-y-3">
                <input v-model="editTracForm.title"
                  class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <textarea v-model="editTracForm.description" rows="2"
                  class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                <select v-model="editTracForm.status"
                  class="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none">
                  <option value="active">Activo</option>
                  <option value="completed">Completado</option>
                  <option value="archived">Archivado</option>
                </select>
                <div class="flex gap-2">
                  <button @click="editingTrac = false"
                    class="px-3 py-1.5 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors">Cancelar</button>
                  <button @click="saveTrac"
                    class="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">Guardar</button>
                </div>
              </div>
            </div>

            <!-- Stage DAG flow -->
            <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Etapas del flujo</h3>
            <div class="space-y-2">
              <div v-for="(layer, li) in dagLayers" :key="li">
                <div v-if="layer.length > 1" class="flex items-center gap-2 mb-1">
                  <div class="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  <span class="text-xs text-amber-400 font-medium">En paralelo</span>
                </div>
                <div :class="layer.length > 1 ? 'grid grid-cols-2 gap-2 pl-4 border-l-2 border-amber-400/30' : ''">
                  <div v-for="stage in layer" :key="stage.id"
                    class="rounded-xl border p-4 cursor-pointer transition-all select-none"
                    :class="[
                      stage.type === 'agent' ? 'bg-violet-950/30' : 'bg-slate-900',
                      activeStage?.id === stage.id
                        ? 'border-indigo-500 ring-1 ring-indigo-500/30'
                        : stage.type === 'agent' ? 'border-violet-800/40 hover:border-violet-700/60' : 'border-slate-800 hover:border-slate-700'
                    ]"
                    @click="openStagePanel(stage)">
                    <div class="flex items-start justify-between gap-3">
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1 flex-wrap">
                          <span v-if="stage.type === 'agent'"
                            class="text-xs px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400 font-medium shrink-0">
                            🤖 Agente
                          </span>
                          <span class="font-medium text-white text-sm truncate">{{ stage.name }}</span>
                        </div>
                        <p v-if="stage.type === 'agent' && stage.agentId" class="text-xs text-violet-400 mb-1.5">
                          {{ agentNameById(stage.agentId) }}
                        </p>
                        <p v-if="stage.role" class="text-xs text-slate-500 mb-1.5">{{ roleNameById(stage.role) }}</p>
                        <div class="flex items-center gap-2 flex-wrap">
                          <span class="text-xs px-2 py-0.5 rounded-full font-medium" :class="stageStatusClass[stage.status]">
                            {{ stageStatusLabel[stage.status] }}
                          </span>
                          <span v-if="stage.status === 'in-review' && stage.type === 'agent'"
                            class="text-xs text-violet-400 animate-pulse">ejecutando…</span>
                        </div>
                        <div v-if="stage.predecessors?.length" class="flex flex-wrap gap-1 mt-1.5">
                          <span v-for="pid in stage.predecessors" :key="pid"
                            class="text-xs px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 truncate max-w-24">
                            ← {{ activeTrac?.stages?.find((s: any) => s.id === pid)?.name ?? pid }}
                          </span>
                        </div>
                      </div>
                      <div class="text-right text-xs text-slate-500 shrink-0">
                        <div>{{ stage.tasks?.filter((t: any) => t.status === 'done').length ?? 0 }}/{{ stage.tasks?.length ?? 0 }} ✓</div>
                        <div v-if="stage.links?.length" class="mt-0.5">{{ stage.links.length }} 🔗</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-if="li < dagLayers.length - 1" class="flex justify-center py-1">
                  <svg class="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: stage tasks/links panel -->
        <div v-if="activeStage"
          class="w-80 shrink-0 bg-slate-900 rounded-2xl border border-slate-800 p-5 overflow-y-auto self-start sticky top-0">
          <!-- Stage header -->
          <div class="flex items-start justify-between gap-2 mb-4">
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-white text-sm">{{ activeStage.name }}</h3>
              <p v-if="activeStage.role" class="text-xs text-slate-400 mt-0.5">{{ roleNameById(activeStage.role) }}</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="text-xs px-2 py-0.5 rounded-full font-medium" :class="stageStatusClass[activeStage.status]">
                {{ stageStatusLabel[activeStage.status] }}
              </span>
              <button @click="activeStage = null" class="text-slate-600 hover:text-slate-400 transition-colors">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <!-- ── Tasks ── -->
          <div class="mb-5">
            <div class="flex items-center justify-between mb-2">
              <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tareas</h4>
              <button v-if="canUpdate" @click="showTaskForm = !showTaskForm"
                class="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">+ Añadir</button>
            </div>

            <div v-if="showTaskForm" class="bg-slate-800 rounded-lg p-3 mb-3 space-y-2">
              <input v-model="taskForm.title" placeholder="Título..." type="text"
                class="w-full bg-slate-700 border border-slate-600 rounded px-2.5 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              <textarea v-model="taskForm.description" placeholder="Descripción..." rows="2"
                class="w-full bg-slate-700 border border-slate-600 rounded px-2.5 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none" />
              <div class="flex gap-2">
                <select v-model="taskForm.type"
                  class="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-white text-xs focus:outline-none">
                  <option value="task">Tarea</option>
                  <option value="bug">Bug</option>
                </select>
                <select v-model="taskForm.status"
                  class="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-white text-xs focus:outline-none">
                  <option value="todo">Por hacer</option>
                  <option value="in-progress">En progreso</option>
                  <option value="done">Hecho</option>
                  <option value="blocked">Bloqueado</option>
                </select>
              </div>
              <div class="flex gap-2">
                <button @click="showTaskForm = false"
                  class="flex-1 py-1 text-xs rounded bg-slate-600 hover:bg-slate-500 text-slate-300 transition-colors">Cancelar</button>
                <button @click="createTask" :disabled="!taskForm.title"
                  class="flex-1 py-1 text-xs rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors">Crear</button>
              </div>
            </div>

            <div v-if="activeStage.tasks?.length" class="space-y-1.5">
              <div v-for="task in activeStage.tasks" :key="task.id"
                class="flex items-start gap-2 p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors group">
                <button v-if="canUpdate"
                  @click="updateTask(task, { status: task.status === 'done' ? 'todo' : 'done' })"
                  class="mt-0.5 w-4 h-4 shrink-0 rounded border transition-colors flex items-center justify-center"
                  :class="task.status === 'done' ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600 hover:border-emerald-500'">
                  <svg v-if="task.status === 'done'" class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="text-xs" :class="task.type === 'bug' ? 'text-red-400' : 'text-slate-600'">
                      {{ task.type === 'bug' ? '🐛' : '✓' }}
                    </span>
                    <span class="text-xs font-medium truncate"
                      :class="task.status === 'done' ? 'line-through text-slate-500' : 'text-white'">
                      {{ task.title }}
                    </span>
                  </div>
                  <select v-if="canUpdate" :value="task.status"
                    @change="updateTask(task, { status: ($event.target as HTMLSelectElement).value })"
                    class="mt-0.5 text-xs bg-transparent border-0 p-0 focus:outline-none cursor-pointer"
                    :class="taskStatusClass[task.status]">
                    <option value="todo">Por hacer</option>
                    <option value="in-progress">En progreso</option>
                    <option value="done">Hecho</option>
                    <option value="blocked">Bloqueado</option>
                  </select>
                </div>
                <button v-if="canUpdate" @click="deleteTask(task)"
                  class="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all shrink-0">
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <p v-else-if="!showTaskForm" class="text-xs text-slate-600 italic">Sin tareas</p>
          </div>

          <!-- ── Links ── -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Links</h4>
              <button v-if="canUpdate" @click="showLinkForm = !showLinkForm"
                class="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">+ Añadir</button>
            </div>

            <div v-if="showLinkForm" class="bg-slate-800 rounded-lg p-3 mb-3 space-y-2">
              <input v-model="linkForm.label" placeholder="Etiqueta (ej: PROJ-123)" type="text"
                class="w-full bg-slate-700 border border-slate-600 rounded px-2.5 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              <input v-model="linkForm.url" placeholder="https://..." type="url"
                class="w-full bg-slate-700 border border-slate-600 rounded px-2.5 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              <select v-model="linkForm.platform"
                class="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-white text-xs focus:outline-none">
                <option value="jira">Jira</option>
                <option value="confluence">Confluence</option>
                <option value="github">GitHub</option>
                <option value="gitlab">GitLab</option>
                <option value="generic">Genérico</option>
              </select>
              <div class="flex gap-2">
                <button @click="showLinkForm = false"
                  class="flex-1 py-1 text-xs rounded bg-slate-600 hover:bg-slate-500 text-slate-300 transition-colors">Cancelar</button>
                <button @click="createLink" :disabled="!linkForm.label || !linkForm.url"
                  class="flex-1 py-1 text-xs rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors">Añadir</button>
              </div>
            </div>

            <div v-if="activeStage.links?.length" class="space-y-1.5">
              <div v-for="link in activeStage.links" :key="link.id"
                class="flex items-center gap-2 p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors group">
                <span class="text-sm shrink-0">{{ platformIcons[link.platform] ?? '🔗' }}</span>
                <a :href="link.url" target="_blank"
                  class="flex-1 min-w-0 text-xs text-indigo-400 hover:text-indigo-300 truncate transition-colors">
                  {{ link.label }}
                </a>
                <button v-if="canUpdate" @click="deleteLink(link)"
                  class="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all shrink-0">
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <p v-else-if="!showLinkForm" class="text-xs text-slate-600 italic">Sin links</p>
          </div>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════════════════════════════ -->
      <!-- TAB: TEMPLATES -->
      <!-- ══════════════════════════════════════════════════════════════════════ -->
      <div v-if="!loading && activeTab === 'templates'" class="flex gap-5 flex-1 min-h-0">

        <!-- Left: template list -->
        <div class="w-72 shrink-0 space-y-2 overflow-y-auto">
          <div v-if="templates.length === 0" class="text-center py-16 text-slate-500 text-sm">
            No hay templates
          </div>
          <div v-for="t in templates" :key="t.id"
            class="rounded-xl border p-3 cursor-pointer transition-all"
            :class="activeTemplate?.id === t.id
              ? 'bg-slate-800 border-indigo-500 ring-1 ring-indigo-500/30'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'"
            @click="openTemplate(t)">
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1 min-w-0">
                <p class="font-medium text-white text-sm truncate">{{ t.name }}</p>
                <p class="text-xs text-slate-500 mt-0.5">
                  {{ t.stages?.length ?? 0 }} etapa{{ (t.stages?.length ?? 0) !== 1 ? 's' : '' }}
                </p>
              </div>
              <button v-if="canDelete" @click.stop="deleteTplTarget = t"
                class="text-slate-600 hover:text-red-400 transition-colors shrink-0 mt-0.5">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Right: template detail -->
        <div class="flex-1 min-w-0 overflow-y-auto">
          <div v-if="!activeTemplate" class="flex flex-col items-center justify-center h-64 text-slate-500">
            <svg class="w-12 h-12 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p>Selecciona un template para ver sus etapas</p>
          </div>

          <div v-else>
            <!-- Template header -->
            <div v-if="!editingTemplate" class="flex items-start justify-between mb-5">
              <div>
                <h2 class="text-xl font-bold text-white">{{ activeTemplate.name }}</h2>
                <p v-if="activeTemplate.description" class="text-slate-400 text-sm mt-1">{{ activeTemplate.description }}</p>
              </div>
              <button v-if="canUpdate" @click="editingTemplate = true"
                class="px-3 py-1.5 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors shrink-0">
                Editar
              </button>
            </div>

            <div v-else class="bg-slate-900 rounded-xl border border-slate-700 p-4 mb-5 space-y-3">
              <input v-model="editTplForm.name" placeholder="Nombre"
                class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <input v-model="editTplForm.description" placeholder="Descripción (opcional)"
                class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <div class="flex gap-2">
                <button @click="editingTemplate = false"
                  class="px-3 py-1.5 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors">Cancelar</button>
                <button @click="saveEditTemplate"
                  class="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">Guardar</button>
              </div>
            </div>

            <!-- Stages header -->
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Etapas</h3>
              <button v-if="canUpdate" @click="openStageForm()"
                class="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
                + Añadir etapa
              </button>
            </div>

            <!-- Stage form -->
            <div v-if="showStageForm" class="bg-slate-900 rounded-xl border border-slate-700 p-4 mb-4 space-y-3">
              <h4 class="text-sm font-medium text-white">{{ editingStage ? 'Editar etapa' : 'Nueva etapa' }}</h4>

              <!-- Type toggle -->
              <div class="flex gap-2">
                <button v-for="t in [{ val: 'manual', label: '👤 Manual' }, { val: 'agent', label: '🤖 Agente' }]"
                  :key="t.val" @click="stageForm.type = t.val as any"
                  class="flex-1 py-1.5 text-xs rounded-lg font-medium transition-colors"
                  :class="stageForm.type === t.val
                    ? t.val === 'agent' ? 'bg-violet-600 text-white' : 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'">
                  {{ t.label }}
                </button>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs text-slate-400 mb-1">Nombre *</label>
                  <input v-model="stageForm.name" type="text" placeholder="Ej: Implementación"
                    class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div v-if="stageForm.type === 'agent'">
                  <label class="block text-xs text-slate-400 mb-1">Agente *</label>
                  <select v-model="stageForm.agentId"
                    class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                    <option value="">Seleccionar agente…</option>
                    <option v-for="a in agents" :key="a.id" :value="a.id">{{ a.name }}</option>
                  </select>
                </div>
                <div v-else>
                  <label class="block text-xs text-slate-400 mb-1">Rol</label>
                  <select v-model="stageForm.role"
                    class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Sin rol asignado</option>
                    <option v-for="r in roles" :key="r.id" :value="r.id">{{ r.name }}</option>
                  </select>
                </div>
              </div>

              <!-- Predecessors multi-select -->
              <div v-if="activeTemplate?.stages?.length">
                <label class="block text-xs text-slate-400 mb-1.5">Predecesores</label>
                <div class="space-y-1 max-h-36 overflow-y-auto">
                  <label v-for="s in activeTemplate.stages.filter((s: any) => s.id !== editingStage?.id)" :key="s.id"
                    class="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
                    <input type="checkbox" :value="s.id" :checked="stageForm.predecessors.includes(s.id)"
                      @change="togglePredecessor(s.id)"
                      class="rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0" />
                    <span class="text-xs text-slate-300 flex-1">{{ s.name }}</span>
                    <span v-if="s.type === 'agent'" class="text-xs text-violet-400">🤖</span>
                  </label>
                </div>
              </div>

              <div>
                <label class="block text-xs text-slate-400 mb-1">Descripción</label>
                <textarea v-model="stageForm.description" rows="2" placeholder="Descripción de la etapa..."
                  class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
              <div class="flex gap-2">
                <button @click="showStageForm = false; editingStage = null"
                  class="px-3 py-1.5 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors">Cancelar</button>
                <button @click="saveStage" :disabled="!stageForm.name || (stageForm.type === 'agent' && !stageForm.agentId)"
                  class="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors">
                  {{ editingStage ? 'Actualizar' : 'Crear' }}
                </button>
              </div>
            </div>

            <!-- Template Stage DAG list -->
            <div v-if="activeTemplate.stages?.length" class="space-y-2">
              <div v-for="(layer, li) in templateDagLayers" :key="li">
                <div v-if="layer.length > 1" class="flex items-center gap-2 mb-1">
                  <div class="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  <span class="text-xs text-amber-400 font-medium">En paralelo</span>
                </div>
                <div :class="layer.length > 1 ? 'grid grid-cols-2 gap-2 pl-4 border-l-2 border-amber-400/30' : ''">
                  <div v-for="stage in layer" :key="stage.id"
                    class="rounded-xl border p-4 hover:border-slate-700 transition-colors"
                    :class="stage.type === 'agent' ? 'bg-violet-950/30 border-violet-800/40' : 'bg-slate-900 border-slate-800'">
                    <div class="flex items-start gap-3">
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                          <span v-if="stage.type === 'agent'"
                            class="text-xs px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400 font-medium shrink-0">🤖</span>
                          <span class="font-medium text-white text-sm">{{ stage.name }}</span>
                          <span v-if="stage.type === 'agent' && stage.agentId"
                            class="text-xs px-2 py-0.5 rounded-full bg-violet-900/40 text-violet-300">
                            {{ agentNameById(stage.agentId) }}
                          </span>
                          <span v-if="stage.role && stage.type !== 'agent'"
                            class="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                            {{ roleNameById(stage.role) }}
                          </span>
                        </div>
                        <p v-if="stage.description" class="text-xs text-slate-500 mt-1">{{ stage.description }}</p>
                        <div v-if="stage.predecessors?.length" class="flex flex-wrap gap-1 mt-1.5">
                          <span v-for="pid in stage.predecessors" :key="pid"
                            class="text-xs px-1.5 py-0.5 rounded bg-slate-800 text-slate-500">
                            ← {{ activeTemplate.stages.find((s: any) => s.id === pid)?.name ?? pid }}
                          </span>
                        </div>
                      </div>
                      <div v-if="canUpdate" class="flex gap-3 shrink-0">
                        <button @click="openStageForm(stage)" class="text-xs text-slate-500 hover:text-white transition-colors">Editar</button>
                        <button v-if="canDelete" @click="deleteStage(stage)" class="text-xs text-slate-500 hover:text-red-400 transition-colors">Eliminar</button>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-if="li < templateDagLayers.length - 1" class="flex justify-center py-1">
                  <svg class="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
            <div v-else-if="!showStageForm" class="text-center py-10 text-slate-500 text-sm">
              Sin etapas — añade la primera etapa para definir el flujo
            </div>
          </div>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════════════════════════════ -->
      <!-- MODALS -->
      <!-- ══════════════════════════════════════════════════════════════════════ -->

      <!-- Create Traceability -->
      <div v-if="showCreateTrac" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div class="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-md p-6">
          <h2 class="text-lg font-semibold text-white mb-5">Nueva Trazabilidad</h2>
          <div class="space-y-4">
            <div>
              <label class="block text-sm text-slate-400 mb-1">Template *</label>
              <select v-model="tracForm.templateId"
                class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Seleccionar template...</option>
                <option v-for="t in templates" :key="t.id" :value="t.id">
                  {{ t.name }} ({{ t.stages?.length ?? 0 }} etapas)
                </option>
              </select>
              <p v-if="templates.length === 0" class="text-xs text-amber-400 mt-1">
                No hay templates.
                <button @click="showCreateTrac = false; activeTab = 'templates'" class="underline">
                  Crea uno en la pestaña Templates
                </button>.
              </p>
            </div>
            <div>
              <label class="block text-sm text-slate-400 mb-1">Título *</label>
              <input v-model="tracForm.title" type="text" placeholder="Ej: Feature PROJ-123 - Login SSO"
                class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label class="block text-sm text-slate-400 mb-1">Descripción</label>
              <textarea v-model="tracForm.description" rows="3" placeholder="Descripción opcional..."
                class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            </div>
          </div>
          <div class="flex gap-3 mt-6">
            <button @click="showCreateTrac = false"
              class="flex-1 py-2 text-sm rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors">Cancelar</button>
            <button @click="createTraceability" :disabled="!tracForm.title || !tracForm.templateId"
              class="flex-1 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium transition-colors">Crear</button>
          </div>
        </div>
      </div>

      <!-- Delete Traceability -->
      <div v-if="deleteTracTarget" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div class="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-sm p-6 text-center">
          <div class="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
            <svg class="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <h3 class="font-semibold text-white mb-2">Eliminar trazabilidad</h3>
          <p class="text-slate-400 text-sm mb-5">
            ¿Eliminar "<span class="text-white">{{ deleteTracTarget.title }}</span>"? Esta acción no se puede deshacer.
          </p>
          <div class="flex gap-3">
            <button @click="deleteTracTarget = null"
              class="flex-1 py-2 text-sm rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors">Cancelar</button>
            <button @click="confirmDeleteTrac"
              class="flex-1 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium transition-colors">Eliminar</button>
          </div>
        </div>
      </div>

      <!-- Create Template -->
      <div v-if="showCreateTemplate" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div class="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-sm p-6">
          <h2 class="text-lg font-semibold text-white mb-5">Nuevo Template</h2>
          <div class="space-y-3">
            <div>
              <label class="block text-sm text-slate-400 mb-1">Nombre *</label>
              <input v-model="templateForm.name" type="text" placeholder="Ej: Ciclo de vida de feature"
                class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label class="block text-sm text-slate-400 mb-1">Descripción</label>
              <textarea v-model="templateForm.description" rows="2" placeholder="Descripción opcional..."
                class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            </div>
          </div>
          <div class="flex gap-3 mt-5">
            <button @click="showCreateTemplate = false"
              class="flex-1 py-2 text-sm rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors">Cancelar</button>
            <button @click="createTemplate" :disabled="!templateForm.name"
              class="flex-1 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium transition-colors">Crear</button>
          </div>
        </div>
      </div>

      <!-- Delete Template -->
      <div v-if="deleteTplTarget" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div class="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-sm p-6 text-center">
          <div class="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
            <svg class="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <h3 class="font-semibold text-white mb-2">Eliminar template</h3>
          <p class="text-slate-400 text-sm mb-5">
            ¿Eliminar "<span class="text-white">{{ deleteTplTarget.name }}</span>"? Las trazabilidades existentes no se verán afectadas.
          </p>
          <div class="flex gap-3">
            <button @click="deleteTplTarget = null"
              class="flex-1 py-2 text-sm rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors">Cancelar</button>
            <button @click="confirmDeleteTemplate"
              class="flex-1 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium transition-colors">Eliminar</button>
          </div>
        </div>
      </div>

    </div>
  </AppLayout>
</template>
