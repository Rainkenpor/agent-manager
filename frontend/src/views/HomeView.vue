<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'
import { useAuthStore } from '@/store/useAuth'
import { useToastStore } from '@/store/useToast'
import * as api from '@/api/api'

const router = useRouter()
const auth = useAuthStore()
const toast = useToastStore()

const stages = ref<any[]>([])
const loading = ref(false)
const activeTab = ref<'current' | 'all'>('current')

// Modal state
const activeModal = ref<any>(null)
const activeDoc = ref<any>(null)
const docLoading = ref(false)

const canUpdate = computed(() => auth.hasPermission('traceability', 'update'))

// ── Status config ─────────────────────────────────────────────────────────────

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
  todo: 'text-slate-400', 'in-progress': 'text-blue-400',
  done: 'text-emerald-400', blocked: 'text-red-400',
}
const platformIcons: Record<string, string> = {
  jira: '🟦', confluence: '🟩', github: '⬛', gitlab: '🟧', generic: '🔗',
}

// Kanban columns
const columns = [
  { key: 'active', label: 'En progreso', color: 'border-blue-500/40', dot: 'bg-blue-400' },
  { key: 'in-review', label: 'En revisión', color: 'border-amber-500/40', dot: 'bg-amber-400' },
  { key: 'pending', label: 'Pendiente', color: 'border-slate-600/40', dot: 'bg-slate-400' },
  { key: 'blocked', label: 'Bloqueado', color: 'border-red-500/40', dot: 'bg-red-400' },
  { key: 'completed', label: 'Completado', color: 'border-emerald-500/40', dot: 'bg-emerald-400' },
]

const getStatus = (status: string) => {
  return { todo: 'Por hacer', 'in-progress': 'En progreso', done: 'Hecho', blocked: 'Bloqueado' }[status]
}

// ── Data ──────────────────────────────────────────────────────────────────────

async function fetchMyStages() {
  loading.value = true
  try {
    const res = await api.getMyStages()
    stages.value = res.data ?? []
  } catch (e: any) {
    toast.error(e.message)
  } finally {
    loading.value = false
  }
}

const visibleStages = computed(() =>
  activeTab.value === 'current'
    ? stages.value.filter(s =>
        s.status !== 'completed' &&
        (!s.predecessors?.length || s.predecessorsCompleted)
      )
    : stages.value
)

function stagesForColumn(status: string) {
  return visibleStages.value.filter(s => s.status === status)
}

function taskProgress(stage: any) {
  const total = stage.tasks?.length ?? 0
  const done = stage.tasks?.filter((t: any) => t.status === 'done').length ?? 0
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 }
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function openModal(stage: any) {
  activeModal.value = JSON.parse(JSON.stringify(stage)) // deep copy
  activeDoc.value = null
}

function closeModal() {
  activeModal.value = null
  activeDoc.value = null
}

async function toggleTask(task: any) {
  if (!canUpdate.value) return
  const newStatus = task.status === 'done' ? 'todo' : 'done'
  try {
    const res = await api.updateTraceabilityTask(task.id, { status: newStatus })
    // const updatedTask = res.data?.task ?? res.data
    // Update in modal
    const idx = activeModal.value.tasks.findIndex((t: any) => t.id === task.id)
    if (idx >= 0) activeModal.value.tasks[idx] = { ...activeModal.value.tasks[idx], status: newStatus }
    // Sync stage status returned by backend
    if (res.data?.stage) {
      activeModal.value.status = res.data.stage.status
    }
    // Sync in main list
    const si = stages.value.findIndex(s => s.id === activeModal.value.id)
    if (si >= 0) {
      const ti = stages.value[si].tasks.findIndex((t: any) => t.id === task.id)
      if (ti >= 0) stages.value[si].tasks[ti].status = newStatus
      if (res.data?.stage) stages.value[si].status = res.data.stage.status
    }
  } catch (e: any) {
    toast.error(e.message)
  }
}

async function changeTaskStatus(task: any, status: string) {
  if (!canUpdate.value) return
  try {
    const res = await api.updateTraceabilityTask(task.id, { status })
    const idx = activeModal.value.tasks.findIndex((t: any) => t.id === task.id)
    if (idx >= 0) activeModal.value.tasks[idx] = { ...activeModal.value.tasks[idx], status }
    if (res.data?.stage) activeModal.value.status = res.data.stage.status
    const si = stages.value.findIndex(s => s.id === activeModal.value.id)
    if (si >= 0) {
      const ti = stages.value[si].tasks.findIndex((t: any) => t.id === task.id)
      if (ti >= 0) stages.value[si].tasks[ti].status = status
      if (res.data?.stage) stages.value[si].status = res.data.stage.status
    }
  } catch (e: any) {
    toast.error(e.message)
  }
}

async function openDoc(doc: any) {
  if (activeDoc.value?.id === doc.id) { activeDoc.value = null; return }
  docLoading.value = true
  activeDoc.value = { id: doc.id, name: doc.name, content: null }
  try {
    const res = await api.getTraceabilityDocument(doc.id)
    activeDoc.value = res.data
  } catch (e: any) {
    toast.error(e.message)
  } finally {
    docLoading.value = false
  }
}

onMounted(fetchMyStages)
</script>

<template>
  <AppLayout>
    <div class="min-h-full bg-slate-950 text-white p-6">

      <!-- Header -->
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-white">Mi panel</h1>
          <p class="text-slate-400 text-sm mt-0.5">Etapas de trazabilidad asignadas a ti</p>
        </div>
        <button @click="fetchMyStages"
          class="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors">
          <svg class="w-3.5 h-3.5" :class="loading ? 'animate-spin' : ''" fill="none" viewBox="0 0 24 24"
            stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Actualizar
        </button>
      </div>

      <!-- Tabs -->
      <div v-if="!loading" class="flex gap-1 mb-5 bg-slate-900 rounded-xl p-1 w-fit">
        <button @click="activeTab = 'current'"
          class="px-4 py-2 text-sm rounded-lg font-medium transition-colors flex items-center gap-2"
          :class="activeTab === 'current' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'">
          Actuales
          <span class="text-xs font-mono px-1.5 py-0.5 rounded-full"
            :class="activeTab === 'current' ? 'bg-indigo-500/50' : 'bg-slate-800 text-slate-500'">
            {{ stages.filter(s => s.status !== 'completed' && (!s.predecessors?.length || s.predecessorsCompleted)).length }}
          </span>
        </button>
        <button @click="activeTab = 'all'"
          class="px-4 py-2 text-sm rounded-lg font-medium transition-colors flex items-center gap-2"
          :class="activeTab === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'">
          Todas
          <span class="text-xs font-mono px-1.5 py-0.5 rounded-full"
            :class="activeTab === 'all' ? 'bg-indigo-500/50' : 'bg-slate-800 text-slate-500'">
            {{ stages.length }}
          </span>
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex justify-center py-24">
        <div class="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>

      <!-- Empty -->
      <div v-else-if="!stages.length" class="flex flex-col items-center justify-center py-24 text-slate-500">
        <svg class="w-14 h-14 mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p class="text-lg font-medium text-slate-400">Sin etapas asignadas</p>
        <p class="text-sm mt-1">Cuando te asignen una etapa de trazabilidad aparecerá aquí</p>
        <button @click="router.push('/traceability')"
          class="mt-4 px-4 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
          Ver trazabilidades
        </button>
      </div>

      <!-- Empty current tab -->
      <div v-else-if="visibleStages.length === 0"
        class="flex flex-col items-center justify-center py-16 text-slate-500">
        <svg class="w-10 h-10 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p class="font-medium text-slate-400">Sin etapas pendientes de acción</p>
        <p class="text-sm mt-1">Todas tus etapas actuales tienen predecesores pendientes</p>
        <button @click="activeTab = 'all'" class="mt-3 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
          Ver todas mis etapas →
        </button>
      </div>

      <!-- Kanban board -->
      <div v-else class="flex gap-4 overflow-x-auto pb-2">
        <div v-for="col in columns" :key="col.key" class="shrink-0 w-72 flex flex-col gap-3">

          <!-- Column header -->
          <div class="flex items-center gap-2 px-1">
            <div class="w-2 h-2 rounded-full shrink-0" :class="col.dot" />
            <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">{{ col.label }}</span>
            <span class="ml-auto text-xs text-slate-600 font-mono">{{ stagesForColumn(col.key).length }}</span>
          </div>

          <!-- Empty column placeholder -->
          <div v-if="!stagesForColumn(col.key).length"
            class="rounded-xl border border-dashed border-slate-800 p-4 text-center text-xs text-slate-600 italic">
            Sin etapas
          </div>

          <!-- Cards -->
          <div v-for="stage in stagesForColumn(col.key)" :key="stage.id"
            class="bg-slate-900 rounded-xl border border-slate-800 hover:border-slate-700 p-4 cursor-pointer transition-all hover:shadow-lg hover:shadow-black/20 group"
            @click="openModal(stage)">

            <!-- Traceability badge + predecessor lock -->
            <div class="flex items-center gap-2 mb-3 flex-wrap">
              <span
                class="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-medium truncate max-w-[160px]">
                {{ stage.traceabilityTitle }}
              </span>
              <span v-if="!stage.predecessorsCompleted"
                class="text-xs px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-500 flex items-center gap-1 shrink-0"
                title="Hay predecesores sin completar">
                🔒 En espera
              </span>
            </div>

            <!-- Stage name -->
            <h3
              class="font-semibold text-white text-sm leading-snug mb-2 group-hover:text-indigo-300 transition-colors">
              {{ stage.name }}
            </h3>

            <!-- Task progress -->
            <div v-if="stage.tasks?.length" class="mb-3">
              <div class="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Tareas</span>
                <span class="font-mono">{{ taskProgress(stage).done }}/{{ taskProgress(stage).total }}</span>
              </div>
              <div class="h-1 bg-slate-800 rounded-full overflow-hidden">
                <div class="h-full bg-indigo-500 rounded-full transition-all"
                  :style="`width:${taskProgress(stage).pct}%`" />
              </div>
              <!-- Task preview (first 3) -->
              <div class="mt-2 space-y-1">
                <div v-for="task in stage.tasks.slice(0, 3)" :key="task.id" class="flex items-center gap-1.5 text-xs"
                  :class="task.status === 'done' ? 'text-slate-600' : 'text-slate-400'">
                  <span :class="task.status === 'done' ? 'text-emerald-500' : 'text-slate-600'">
                    {{ task.status === 'done' ? '✓' : '○' }}
                  </span>
                  <span :class="task.status === 'done' ? 'line-through' : ''">{{ task.title }}</span>
                </div>
                <div v-if="stage.tasks.length > 3" class="text-xs text-slate-600 pl-4">
                  +{{ stage.tasks.length - 3 }} más…
                </div>
              </div>
            </div>

            <!-- Quick access: links & docs -->
            <div v-if="stage.links?.length || stage.documents?.length"
              class="flex items-center gap-3 mt-2 pt-2 border-t border-slate-800">
              <div v-if="stage.links?.length" class="flex items-center gap-1 text-xs text-slate-500">
                <span>🔗</span>
                <span>{{ stage.links.length }} link{{ stage.links.length > 1 ? 's' : '' }}</span>
              </div>
              <div v-if="stage.documents?.length" class="flex items-center gap-1 text-xs text-slate-500">
                <span>📄</span>
                <span>{{ stage.documents.length }} doc{{ stage.documents.length > 1 ? 's' : '' }}</span>
              </div>
              <span class="ml-auto text-xs text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">Ver
                →</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Modal ──────────────────────────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="activeModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        @click.self="closeModal">
        <div
          class="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">

          <!-- Modal header -->
          <div class="flex items-start justify-between gap-4 p-5 border-b border-slate-800">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1 flex-wrap">
                <span class="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-medium">
                  {{ activeModal.traceabilityTitle }}
                </span>
                <span class="text-xs px-2 py-0.5 rounded-full font-medium"
                  :class="stageStatusClass[activeModal.status]">
                  {{ stageStatusLabel[activeModal.status] }}
                </span>
              </div>
              <h2 class="text-lg font-bold text-white">{{ activeModal.name }}</h2>
              <p v-if="activeModal.description" class="text-sm text-slate-400 mt-0.5">{{ activeModal.description }}</p>
            </div>
            <button @click="closeModal" class="shrink-0 text-slate-500 hover:text-white transition-colors p-1">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Modal body -->
          <div class="flex-1 overflow-y-auto p-5 space-y-6">

            <!-- Tasks -->
            <div>
              <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Tareas
                <span class="ml-2 text-slate-600 font-mono font-normal">
                  {{activeModal.tasks?.filter((t: any) => t.status === 'done').length ?? 0}}/{{
                    activeModal.tasks?.length ?? 0 }}
                </span>
              </h3>

              <div v-if="activeModal.tasks?.length" class="space-y-2">
                <div v-for="task in activeModal.tasks" :key="task.id"
                  class="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors group/task">

                  <!-- Checkbox -->
                  <button v-if="canUpdate" @click="toggleTask(task)"
                    class="mt-0.5 w-4 h-4 shrink-0 rounded border transition-colors flex items-center justify-center"
                    :class="task.status === 'done'
                      ? 'bg-emerald-500 border-emerald-500'
                      : 'border-slate-600 hover:border-emerald-500'">
                    <svg v-if="task.status === 'done'" class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24"
                      stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <div v-else
                    class="mt-0.5 w-4 h-4 shrink-0 rounded border border-slate-700 flex items-center justify-center">
                    <svg v-if="task.status === 'done'" class="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24"
                      stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>

                  <div class="flex-1 min-w-0">
                    <div class="flex items-start gap-2 justify-between">
                      <div class="flex-1">
                        <div class="flex items-center gap-1.5">
                          <span class="text-xs" :class="task.type === 'bug' ? 'text-red-400' : 'text-slate-600'">
                            {{ task.type === 'bug' ? '🐛' : '✓' }}
                          </span>
                          <span class="text-sm font-medium"
                            :class="task.status === 'done' ? 'line-through text-slate-500' : 'text-white'">
                            {{ task.title }}
                          </span>
                        </div>
                        <p v-if="task.description" class="text-xs text-slate-500 mt-0.5 ml-4">{{ task.description }}</p>
                      </div>
                      <select v-if="canUpdate" :value="task.status"
                        @change="changeTaskStatus(task, ($event.target as HTMLSelectElement).value)"
                        class="text-xs bg-slate-700 border border-slate-600 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 shrink-0"
                        :class="taskStatusClass[task.status]">
                        <option value="todo">Por hacer</option>
                        <option value="in-progress">En progreso</option>
                        <option value="done">Hecho</option>
                        <option value="blocked">Bloqueado</option>
                      </select>
                      <span v-else class="text-xs shrink-0" :class="taskStatusClass[task.status]">
                        {{ getStatus(task.status) }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <p v-else class="text-xs text-slate-600 italic">Sin tareas en esta etapa</p>
            </div>

            <!-- Links -->
            <div v-if="activeModal.links?.length">
              <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Links</h3>
              <div class="space-y-2">
                <a v-for="link in activeModal.links" :key="link.id" :href="link.url" target="_blank"
                  class="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors group/link">
                  <span class="text-base shrink-0">{{ platformIcons[link.platform] ?? '🔗' }}</span>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm text-indigo-400 group-hover/link:text-indigo-300 transition-colors truncate">{{
                      link.label }}</p>
                    <p class="text-xs text-slate-600 truncate">{{ link.url }}</p>
                  </div>
                  <svg class="w-3.5 h-3.5 text-slate-600 group-hover/link:text-slate-400 shrink-0 transition-colors"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>

            <!-- Documents -->
            <div v-if="activeModal.documents?.length">
              <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Documentos</h3>
              <div class="space-y-2">
                <div v-for="doc in activeModal.documents" :key="doc.id"
                  class="rounded-lg border border-slate-800 overflow-hidden">
                  <!-- Doc header / toggle -->
                  <button
                    class="w-full flex items-center gap-3 p-3 bg-slate-800/50 hover:bg-slate-800 transition-colors text-left"
                    @click="openDoc(doc)">
                    <span class="text-base shrink-0">📄</span>
                    <span class="flex-1 text-sm font-medium text-white truncate">{{ doc.name }}</span>
                    <svg class="w-4 h-4 text-slate-500 shrink-0 transition-transform"
                      :class="activeDoc?.id === doc.id ? 'rotate-180' : ''" fill="none" viewBox="0 0 24 24"
                      stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <!-- Doc content -->
                  <div v-if="activeDoc?.id === doc.id" class="border-t border-slate-800 p-4 bg-slate-950">
                    <div v-if="docLoading" class="flex justify-center py-4">
                      <div class="animate-spin w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full" />
                    </div>
                    <pre v-else
                      class="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">{{ activeDoc.content || '(sin contenido)' }}</pre>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <!-- Modal footer -->
          <div class="flex items-center justify-between p-4 border-t border-slate-800">
            <button @click="() => { closeModal(); router.push('/traceability') }"
              class="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Ver trazabilidad completa
            </button>
            <button @click="closeModal"
              class="px-3 py-1.5 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </AppLayout>
</template>
