<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'
import { useAuthStore } from '@/store/useAuth'
import { useToastStore } from '@/store/useToast'
import * as api from '@/api/api'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const toast = useToastStore()

const traceability = ref<any>(null)
const roles = ref<any[]>([])
const loading = ref(false)

function roleNameById(id: string) {
  if (!id) return ''
  return roles.value.find(r => r.id === id)?.name ?? id
}
const editingTitle = ref(false)
const editForm = ref({ title: '', description: '', status: '' })

// Task panel state
const activeStage = ref<any>(null)
const showTaskForm = ref(false)
const taskForm = ref({ title: '', description: '', type: 'task', status: 'todo' })
const editingTask = ref<any>(null)

// Link panel state
const showLinkForm = ref(false)
const linkForm = ref({ label: '', url: '', platform: 'generic' })

const canUpdate = computed(() => auth.hasPermission('traceability', 'update'))

const statusOptions = [
  { value: 'active', label: 'Activo' },
  { value: 'completed', label: 'Completado' },
  { value: 'archived', label: 'Archivado' },
]

const stageStatusLabel: Record<string, string> = {
  pending: 'Pendiente', active: 'En progreso', completed: 'Completado', blocked: 'Bloqueado', 'in-review': 'En revisión',
}
const stageStatusClass: Record<string, string> = {
  pending: 'bg-slate-700 text-slate-300',
  active: 'bg-blue-500/20 text-blue-300',
  completed: 'bg-emerald-500/20 text-emerald-300',
  blocked: 'bg-red-500/20 text-red-300',
  'in-review': 'bg-amber-500/20 text-amber-300',
}

const taskStatusClass: Record<string, string> = {
  todo: 'text-slate-400',
  'in-progress': 'text-blue-400',
  done: 'text-emerald-400',
  blocked: 'text-red-400',
}

const platformIcons: Record<string, string> = {
  jira: '🟦', confluence: '🟩', github: '⬛', gitlab: '🟧', generic: '🔗',
}

async function fetchData() {
  loading.value = true
  try {
    const [res, rolesRes] = await Promise.all([
      api.getTraceabilityById(route.params.id as string),
      api.getRoles(),
    ])
    traceability.value = res.data
    editForm.value = { title: res.data.title, description: res.data.description ?? '', status: res.data.status }
    roles.value = Array.isArray(rolesRes) ? rolesRes : (rolesRes as any).data ?? []
  } catch (e: any) {
    toast.error(e.message)
  } finally {
    loading.value = false
  }
}

async function saveEdit() {
  try {
    await api.updateTraceability(traceability.value.id, editForm.value)
    toast.success('Actualizado')
    editingTitle.value = false
    await fetchData()
  } catch (e: any) {
    toast.error(e.message)
  }
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

function openTaskPanel(stage: any) {
  activeStage.value = stage
  showTaskForm.value = false
  editingTask.value = null
  taskForm.value = { title: '', description: '', type: 'task', status: 'todo' }
}

async function createTask() {
  if (!taskForm.value.title) return
  try {
    const res = await api.createTraceabilityTask({ stageId: activeStage.value.id, ...taskForm.value })
    const updatedStage = res.data.stage
    // Update the stage in local state
    const idx = traceability.value.stages.findIndex((s: any) => s.id === activeStage.value.id)
    if (idx >= 0) {
      traceability.value.stages[idx].tasks = updatedStage.tasks
      traceability.value.stages[idx].status = updatedStage.status
      activeStage.value = traceability.value.stages[idx]
    }
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
    const updatedStage = res.data.stage
    const idx = traceability.value.stages.findIndex((s: any) => s.id === activeStage.value.id)
    if (idx >= 0) {
      traceability.value.stages[idx].tasks = updatedStage.tasks
      traceability.value.stages[idx].status = updatedStage.status
      activeStage.value = traceability.value.stages[idx]
    }
  } catch (e: any) {
    toast.error(e.message)
  }
}

async function deleteTask(task: any) {
  try {
    const res = await api.deleteTraceabilityTask(task.id, activeStage.value.id)
    const updatedStage = res.data.stage
    const idx = traceability.value.stages.findIndex((s: any) => s.id === activeStage.value.id)
    if (idx >= 0) {
      traceability.value.stages[idx].tasks = updatedStage.tasks
      traceability.value.stages[idx].status = updatedStage.status
      activeStage.value = traceability.value.stages[idx]
    }
    toast.success('Tarea eliminada')
  } catch (e: any) {
    toast.error(e.message)
  }
}

// ── Links ─────────────────────────────────────────────────────────────────────

async function createLink() {
  if (!linkForm.value.label || !linkForm.value.url) return
  try {
    const res = await api.createTraceabilityLink({ stageId: activeStage.value.id, ...linkForm.value })
    const idx = traceability.value.stages.findIndex((s: any) => s.id === activeStage.value.id)
    if (idx >= 0) {
      traceability.value.stages[idx].links.push(res.data)
      activeStage.value = traceability.value.stages[idx]
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
    const idx = traceability.value.stages.findIndex((s: any) => s.id === activeStage.value.id)
    if (idx >= 0) {
      traceability.value.stages[idx].links = traceability.value.stages[idx].links.filter((l: any) => l.id !== link.id)
      activeStage.value = traceability.value.stages[idx]
    }
    toast.success('Link eliminado')
  } catch (e: any) {
    toast.error(e.message)
  }
}

// Group stages by parallelGroup for rendering
const stageGroups = computed(() => {
  if (!traceability.value?.stages) return []
  const stages = [...traceability.value.stages].sort((a, b) => a.order - b.order)
  const groups: any[][] = []
  const seen = new Set<string>()
  for (const stage of stages) {
    if (stage.parallelGroup) {
      if (!seen.has(stage.parallelGroup)) {
        seen.add(stage.parallelGroup)
        groups.push(stages.filter(s => s.parallelGroup === stage.parallelGroup))
      }
    } else {
      groups.push([stage])
    }
  }
  return groups
})

onMounted(fetchData)
</script>

<template>
  <AppLayout>
    <div class="p-6 bg-slate-950 text-white min-h-full flex gap-6">
      <!-- Main content -->
      <div class="flex-1 min-w-0">
        <!-- Back -->
        <button @click="router.push('/traceability')" class="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-5 transition-colors">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          Trazabilidades
        </button>

        <div v-if="loading" class="flex justify-center py-20">
          <div class="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
        </div>

        <div v-else-if="traceability">
          <!-- Header -->
          <div class="mb-6">
            <div v-if="!editingTitle" class="flex items-start gap-3">
              <div class="flex-1">
                <h1 class="text-2xl font-bold text-white">{{ traceability.title }}</h1>
                <p v-if="traceability.description" class="text-slate-400 text-sm mt-1">{{ traceability.description }}</p>
                <div class="flex items-center gap-3 mt-2 text-xs text-slate-500">
                  <span v-if="traceability.templateName">Template: <span class="text-slate-400">{{ traceability.templateName }}</span></span>
                  <span class="px-2 py-0.5 rounded-full font-medium"
                    :class="traceability.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : traceability.status === 'archived' ? 'bg-slate-500/10 text-slate-400' : 'bg-blue-500/10 text-blue-400'">
                    {{ traceability.status }}
                  </span>
                </div>
              </div>
              <button v-if="canUpdate" @click="editingTitle = true"
                class="shrink-0 px-3 py-1.5 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors">
                Editar
              </button>
            </div>
            <div v-else class="bg-slate-900 rounded-xl border border-slate-700 p-4 space-y-3">
              <input v-model="editForm.title" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <textarea v-model="editForm.description" rows="2" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              <select v-model="editForm.status" class="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none">
                <option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
              </select>
              <div class="flex gap-2">
                <button @click="editingTitle = false" class="px-3 py-1.5 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors">Cancelar</button>
                <button @click="saveEdit" class="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">Guardar</button>
              </div>
            </div>
          </div>

          <!-- Stages flow -->
          <div class="space-y-3">
            <h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wider">Etapas del flujo</h2>

            <div v-for="(group, gi) in stageGroups" :key="gi">
              <!-- Parallel group indicator -->
              <div v-if="group.length > 1" class="flex items-center gap-2 mb-1">
                <div class="w-2 h-2 rounded-full bg-amber-400" />
                <span class="text-xs text-amber-400 font-medium">Etapas paralelas</span>
              </div>

              <div :class="group.length > 1 ? 'grid grid-cols-2 gap-3 pl-4 border-l-2 border-amber-400/30' : ''">
                <div v-for="stage in group" :key="stage.id"
                  class="bg-slate-900 rounded-xl border p-4 cursor-pointer transition-all"
                  :class="activeStage?.id === stage.id ? 'border-indigo-500 ring-1 ring-indigo-500/30' : 'border-slate-800 hover:border-slate-700'"
                  @click="openTaskPanel(stage)">
                  <div class="flex items-start justify-between gap-3">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-1">
                        <span class="text-xs text-slate-500 font-mono">#{{ stage.order + 1 }}</span>
                        <h3 class="font-medium text-white text-sm truncate">{{ stage.name }}</h3>
                      </div>
                      <p v-if="stage.role" class="text-xs text-slate-500 mb-2">{{ roleNameById(stage.role) }}</p>
                      <span class="text-xs px-2 py-0.5 rounded-full font-medium" :class="stageStatusClass[stage.status]">
                        {{ stageStatusLabel[stage.status] }}
                      </span>
                    </div>
                    <div class="shrink-0 text-right text-xs text-slate-500">
                      <div>{{ stage.tasks?.filter((t: any) => t.status === 'done').length ?? 0 }}/{{ stage.tasks?.length ?? 0 }} tareas</div>
                      <div v-if="stage.links?.length" class="mt-0.5">{{ stage.links.length }} link{{ stage.links.length > 1 ? 's' : '' }}</div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Arrow between groups -->
              <div v-if="gi < stageGroups.length - 1" class="flex justify-center py-1">
                <svg class="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Side panel: stage detail -->
      <div v-if="activeStage" class="w-96 shrink-0 bg-slate-900 rounded-2xl border border-slate-800 p-5 h-fit sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="font-semibold text-white">{{ activeStage.name }}</h3>
            <p v-if="activeStage.role" class="text-xs text-slate-400 mt-0.5">{{ roleNameById(activeStage.role) }}</p>
          </div>
          <span class="text-xs px-2 py-0.5 rounded-full font-medium" :class="stageStatusClass[activeStage.status]">
            {{ stageStatusLabel[activeStage.status] }}
          </span>
        </div>

        <!-- Tasks -->
        <div class="mb-5">
          <div class="flex items-center justify-between mb-3">
            <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tareas</h4>
            <button v-if="canUpdate" @click="showTaskForm = !showTaskForm"
              class="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">+ Añadir</button>
          </div>

          <!-- Task form -->
          <div v-if="showTaskForm" class="bg-slate-800 rounded-lg p-3 mb-3 space-y-2">
            <input v-model="taskForm.title" placeholder="Título de la tarea..." type="text"
              class="w-full bg-slate-700 border border-slate-600 rounded px-2.5 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            <textarea v-model="taskForm.description" placeholder="Descripción..." rows="2"
              class="w-full bg-slate-700 border border-slate-600 rounded px-2.5 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none" />
            <div class="flex gap-2">
              <select v-model="taskForm.type" class="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-white text-xs focus:outline-none">
                <option value="task">Tarea</option>
                <option value="bug">Bug</option>
              </select>
              <select v-model="taskForm.status" class="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-white text-xs focus:outline-none">
                <option value="todo">Por hacer</option>
                <option value="in-progress">En progreso</option>
                <option value="done">Hecho</option>
                <option value="blocked">Bloqueado</option>
              </select>
            </div>
            <div class="flex gap-2">
              <button @click="showTaskForm = false" class="flex-1 py-1 text-xs rounded bg-slate-600 hover:bg-slate-500 text-slate-300 transition-colors">Cancelar</button>
              <button @click="createTask" :disabled="!taskForm.title" class="flex-1 py-1 text-xs rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors">Crear</button>
            </div>
          </div>

          <!-- Task list -->
          <div v-if="activeStage.tasks?.length" class="space-y-2">
            <div v-for="task in activeStage.tasks" :key="task.id"
              class="flex items-start gap-2 p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors group">
              <button v-if="canUpdate" @click="updateTask(task, { status: task.status === 'done' ? 'todo' : 'done' })"
                class="mt-0.5 w-4 h-4 shrink-0 rounded border transition-colors"
                :class="task.status === 'done' ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600 hover:border-emerald-500'">
                <svg v-if="task.status === 'done'" class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                </svg>
              </button>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="text-xs" :class="task.type === 'bug' ? 'text-red-400' : 'text-slate-500'">
                    {{ task.type === 'bug' ? '🐛' : '✓' }}
                  </span>
                  <span class="text-xs font-medium" :class="[task.status === 'done' ? 'line-through text-slate-500' : 'text-white', taskStatusClass[task.status]]">
                    {{ task.title }}
                  </span>
                </div>
                <div v-if="task.description" class="text-xs text-slate-500 mt-0.5 truncate">{{ task.description }}</div>
                <div class="flex items-center gap-2 mt-1">
                  <select v-if="canUpdate" :value="task.status" @change="updateTask(task, { status: ($event.target as HTMLSelectElement).value })"
                    class="text-xs bg-transparent border-0 p-0 focus:outline-none" :class="taskStatusClass[task.status]">
                    <option value="todo">Por hacer</option>
                    <option value="in-progress">En progreso</option>
                    <option value="done">Hecho</option>
                    <option value="blocked">Bloqueado</option>
                  </select>
                </div>
              </div>
              <button v-if="canUpdate" @click="deleteTask(task)"
                class="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all shrink-0">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <p v-else-if="!showTaskForm" class="text-xs text-slate-500 italic">Sin tareas</p>
        </div>

        <!-- Links -->
        <div>
          <div class="flex items-center justify-between mb-3">
            <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Links</h4>
            <button v-if="canUpdate" @click="showLinkForm = !showLinkForm"
              class="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">+ Añadir</button>
          </div>

          <!-- Link form -->
          <div v-if="showLinkForm" class="bg-slate-800 rounded-lg p-3 mb-3 space-y-2">
            <input v-model="linkForm.label" placeholder="Etiqueta (ej: PROJ-123)" type="text"
              class="w-full bg-slate-700 border border-slate-600 rounded px-2.5 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            <input v-model="linkForm.url" placeholder="https://..." type="url"
              class="w-full bg-slate-700 border border-slate-600 rounded px-2.5 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            <select v-model="linkForm.platform" class="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-white text-xs focus:outline-none">
              <option value="jira">Jira</option>
              <option value="confluence">Confluence</option>
              <option value="github">GitHub</option>
              <option value="gitlab">GitLab</option>
              <option value="generic">Genérico</option>
            </select>
            <div class="flex gap-2">
              <button @click="showLinkForm = false" class="flex-1 py-1 text-xs rounded bg-slate-600 hover:bg-slate-500 text-slate-300 transition-colors">Cancelar</button>
              <button @click="createLink" :disabled="!linkForm.label || !linkForm.url" class="flex-1 py-1 text-xs rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors">Añadir</button>
            </div>
          </div>

          <!-- Link list -->
          <div v-if="activeStage.links?.length" class="space-y-1.5">
            <div v-for="link in activeStage.links" :key="link.id"
              class="flex items-center gap-2 p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors group">
              <span class="text-sm">{{ platformIcons[link.platform] ?? '🔗' }}</span>
              <a :href="link.url" target="_blank" class="flex-1 min-w-0 text-xs text-indigo-400 hover:text-indigo-300 truncate transition-colors">
                {{ link.label }}
              </a>
              <button v-if="canUpdate" @click="deleteLink(link)"
                class="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all shrink-0">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <p v-else-if="!showLinkForm" class="text-xs text-slate-500 italic">Sin links</p>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
