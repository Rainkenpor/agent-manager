<script setup lang="ts">
import { ref, watch } from 'vue'
import * as api from '@/api/api'

interface TraceabilityTask {
  id: string
  stageId: string
  title: string
  description?: string | null
  type: 'task' | 'bug'
  status: 'todo' | 'in-progress' | 'done' | 'blocked'
}

interface TraceabilityLink {
  id: string
  label: string
  url: string
  platform: string
}

interface TraceabilityDocument {
  id: string
  name: string
}

interface TraceabilityStage {
  id: string
  name: string
  status: 'pending' | 'active' | 'completed' | 'blocked' | 'in-review'
  assignedUserId?: string | null
  predecessors: string[]
  tasks: TraceabilityTask[]
  links: TraceabilityLink[]
  documents: TraceabilityDocument[]
}

interface LinkedTraceability {
  id: string
  title: string
  status: 'active' | 'completed' | 'archived'
  stages: TraceabilityStage[]
}

const props = defineProps<{ conversationId: string }>()

const emit = defineEmits<{
  close: []
  loaded: [hasTraceability: boolean]
  error: [message: string]
}>()

// ── State ─────────────────────────────────────────────────────────────────────

const linkedTraceabilities = ref<LinkedTraceability[]>([])
const loading = ref(false)
const expandedTraceabilities = ref<Set<string>>(new Set())
const expandedStages = ref<Set<string>>(new Set())
const togglingTaskId = ref<string | null>(null)

// Document viewer
const activeDocument = ref<any>(null)
const docViewerLoading = ref(false)
const editingDocument = ref(false)
const editDocForm = ref({ name: '', content: '' })
const savingDocument = ref(false)

// ── Lookups ───────────────────────────────────────────────────────────────────

const stageStatusLabel: Record<string, string> = {
  pending: 'Pendiente',
  active: 'Activa',
  completed: 'Completada',
  blocked: 'Bloqueada',
  'in-review': 'En revisión',
}

const stageStatusClass: Record<string, string> = {
  pending: 'bg-slate-700 text-slate-300',
  active: 'bg-indigo-500/20 text-indigo-300',
  completed: 'bg-green-500/20 text-green-300',
  blocked: 'bg-red-500/20 text-red-300',
  'in-review': 'bg-amber-500/20 text-amber-300',
}

const platformIcon: Record<string, string> = {
  jira: '🔷',
  confluence: '📄',
  github: '🐙',
  gitlab: '🦊',
  generic: '🔗',
}

// ── DAG topological sort ──────────────────────────────────────────────────────

function topoSort(stages: TraceabilityStage[]): TraceabilityStage[] {
  const result: TraceabilityStage[] = []
  const visited = new Set<string>()
  const map = new Map(stages.map((s) => [s.id, s]))
  function visit(s: TraceabilityStage) {
    if (visited.has(s.id)) return
    visited.add(s.id)
    for (const pid of s.predecessors) {
      const pred = map.get(pid)
      if (pred) visit(pred)
    }
    result.push(s)
  }
  for (const s of stages) visit(s)
  return result
}

// ── Data loading ──────────────────────────────────────────────────────────────

async function load(conversationId: string) {
  loading.value = true
  linkedTraceabilities.value = []
  expandedTraceabilities.value = new Set()
  expandedStages.value = new Set()
  try {
    const res = await api.getTraceabilityByConversation(conversationId)
    linkedTraceabilities.value = Array.isArray(res.data) ? res.data : res.data ? [res.data] : []
    if (linkedTraceabilities.value.length > 0) {
      expandedTraceabilities.value = new Set([linkedTraceabilities.value[0].id])
    }
    emit('loaded', linkedTraceabilities.value.length > 0)
  } catch {
    linkedTraceabilities.value = []
    emit('loaded', false)
  } finally {
    loading.value = false
  }
}

watch(() => props.conversationId, (id) => { if (id) load(id) }, { immediate: true })

// ── Tasks ─────────────────────────────────────────────────────────────────────

async function toggleTask(task: TraceabilityTask) {
  if (togglingTaskId.value) return
  togglingTaskId.value = task.id
  const newStatus: TraceabilityTask['status'] = task.status === 'done' ? 'todo' : 'done'
  try {
    await api.updateTraceabilityTask(task.id, { status: newStatus })
    for (const trac of linkedTraceabilities.value) {
      for (const stage of trac.stages) {
        const idx = stage.tasks.findIndex((t) => t.id === task.id)
        if (idx !== -1) {
          stage.tasks[idx] = { ...stage.tasks[idx], status: newStatus }
          break
        }
      }
    }
  } catch (e: any) {
    emit('error', e.message)
  } finally {
    togglingTaskId.value = null
  }
}

// ── Traceabilities ────────────────────────────────────────────────────────────

function toggleTraceability(tracId: string) {
  if (expandedTraceabilities.value.has(tracId)) expandedTraceabilities.value.delete(tracId)
  else expandedTraceabilities.value.add(tracId)
  expandedTraceabilities.value = new Set(expandedTraceabilities.value)
}

// ── Stages ────────────────────────────────────────────────────────────────────

function toggleStage(stageId: string) {
  if (expandedStages.value.has(stageId)) expandedStages.value.delete(stageId)
  else expandedStages.value.add(stageId)
  expandedStages.value = new Set(expandedStages.value)
}

// ── Documents ─────────────────────────────────────────────────────────────────

async function openDocument(doc: TraceabilityDocument) {
  docViewerLoading.value = true
  editingDocument.value = false
  activeDocument.value = { ...doc }
  try {
    const res = await api.getTraceabilityDocument(doc.id)
    activeDocument.value = res.data
    editDocForm.value = { name: res.data.name, content: res.data.content ?? '' }
  } catch (e: any) {
    emit('error', e.message)
  } finally {
    docViewerLoading.value = false
  }
}

async function saveDocument() {
  if (!activeDocument.value) return
  savingDocument.value = true
  try {
    const res = await api.updateTraceabilityDocument(activeDocument.value.id, editDocForm.value)
    activeDocument.value = res.data
    editingDocument.value = false
    for (const trac of linkedTraceabilities.value) {
      for (const stage of trac.stages) {
        const idx = stage.documents.findIndex((d) => d.id === activeDocument.value.id)
        if (idx !== -1) { stage.documents[idx] = { id: res.data.id, name: res.data.name }; break }
      }
    }
  } catch (e: any) {
    emit('error', e.message)
  } finally {
    savingDocument.value = false
  }
}

function closeDocViewer() {
  activeDocument.value = null
  editingDocument.value = false
}
</script>

<template>
  <!-- Sidebar panel -->
  <div class="w-72 shrink-0 flex flex-col border-l border-slate-800 bg-base-100 overflow-hidden">

    <!-- Header -->
    <div class="px-4 py-3 border-b border-slate-800 flex items-center justify-between shrink-0">
      <div class="flex items-center gap-2 min-w-0">
        <svg class="w-4 h-4 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <span class="text-xs font-semibold text-slate-300 truncate">Trazabilidad</span>
        <span v-if="linkedTraceabilities.length > 0"
          class="shrink-0 px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-medium">
          {{ linkedTraceabilities.length }}
        </span>
      </div>
      <button @click="emit('close')" class="shrink-0 text-slate-500 hover:text-slate-300 transition-colors">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-10">
      <div class="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
    </div>

    <!-- No traceability -->
    <div v-else-if="linkedTraceabilities.length === 0" class="px-4 py-6 text-center">
      <p class="text-slate-500 text-xs">Sin trazabilidad vinculada</p>
    </div>

    <!-- Traceabilities list -->
    <div v-else class="flex-1 overflow-y-auto divide-y divide-slate-800/60">

      <div v-for="trac in linkedTraceabilities" :key="trac.id">

        <!-- Traceability header (collapsible) -->
        <button
          class="w-full px-4 py-2.5 flex items-center gap-2 hover:bg-slate-800/40 transition-colors text-left"
          @click="toggleTraceability(trac.id)">
          <svg class="w-3 h-3 text-indigo-400 shrink-0 transition-transform"
            :class="expandedTraceabilities.has(trac.id) ? 'rotate-90' : ''"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
          </svg>
          <span class="flex-1 text-xs font-semibold text-slate-200 truncate">{{ trac.title }}</span>
          <span class="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium" :class="{
            'bg-green-500/20 text-green-300': trac.status === 'completed',
            'bg-indigo-500/20 text-indigo-300': trac.status === 'active',
            'bg-slate-700 text-slate-400': trac.status === 'archived',
          }">
            {{ trac.status === 'completed' ? 'Completada' : trac.status === 'active' ? 'Activa' : 'Archivada' }}
          </span>
        </button>

        <!-- Traceability stages (expanded) -->
        <div v-if="expandedTraceabilities.has(trac.id)" class="divide-y divide-slate-800/40 bg-slate-900/20">

          <div v-for="stage in topoSort(trac.stages)" :key="stage.id">

            <!-- Stage header -->
            <button
              class="w-full pl-6 pr-4 py-2 flex items-center gap-2 hover:bg-slate-800/40 transition-colors text-left"
              @click="toggleStage(stage.id)">
              <svg class="w-3 h-3 text-slate-500 shrink-0 transition-transform"
                :class="expandedStages.has(stage.id) ? 'rotate-90' : ''"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
              </svg>
              <span class="flex-1 text-xs font-medium text-slate-300 truncate">{{ stage.name }}</span>
              <span class="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium"
                :class="stageStatusClass[stage.status] ?? 'bg-slate-700 text-slate-400'">
                {{ stageStatusLabel[stage.status] ?? stage.status }}
              </span>
            </button>

            <!-- Stage content (expanded) -->
            <div v-if="expandedStages.has(stage.id)" class="pl-8 pr-4 pb-3 space-y-3 pt-1">

              <!-- Tasks -->
              <div v-if="stage.tasks.length">
                <p class="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">Tareas</p>
                <div class="space-y-1.5">
                  <div v-for="task in stage.tasks" :key="task.id"
                    class="flex items-start gap-2 cursor-pointer select-none" @click.prevent="toggleTask(task)">
                    <div class="mt-0.5 shrink-0">
                      <div v-if="togglingTaskId === task.id"
                        class="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                      <div v-else class="w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors"
                        :class="task.status === 'done'
                          ? 'bg-indigo-600 border-indigo-500'
                          : 'border-slate-600 hover:border-indigo-500'">
                        <svg v-if="task.status === 'done'" class="w-2.5 h-2.5 text-white" fill="none"
                          stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                    <span class="text-xs leading-snug pt-px"
                      :class="task.status === 'done' ? 'text-slate-500 line-through' : 'text-slate-300'">
                      {{ task.title }}
                      <span v-if="task.type === 'bug'"
                        class="ml-1 px-1 py-0 rounded bg-red-500/20 text-red-400 text-[9px] font-medium">bug</span>
                    </span>
                  </div>
                </div>
              </div>

              <!-- Documents -->
              <div v-if="stage.documents.length">
                <p class="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">Documentos</p>
                <div class="space-y-1">
                  <button v-for="doc in stage.documents" :key="doc.id"
                    class="w-full flex items-center gap-1.5 text-xs text-slate-400 hover:text-teal-300 transition-colors text-left group"
                    @click="openDocument(doc)">
                    <svg class="w-3 h-3 shrink-0 text-teal-500/60 group-hover:text-teal-400 transition-colors"
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span class="truncate">{{ doc.name }}</span>
                  </button>
                </div>
              </div>

              <!-- Links -->
              <div v-if="stage.links.length">
                <p class="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">Links</p>
                <div class="space-y-1">
                  <a v-for="link in stage.links" :key="link.id" :href="link.url" target="_blank" rel="noopener"
                    class="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors truncate">
                    <span class="shrink-0 text-[11px]">{{ platformIcon[link.platform] ?? '🔗' }}</span>
                    <span class="truncate">{{ link.label }}</span>
                  </a>
                </div>
              </div>

              <!-- Empty -->
              <p v-if="!stage.tasks.length && !stage.documents.length && !stage.links.length"
                class="text-xs text-slate-600 italic">Sin elementos</p>
            </div>

          </div>
        </div>

      </div>
    </div>

  </div>

  <!-- Document viewer modal (teleported to body to escape overflow:hidden) -->
  <teleport to="body">
    <div v-if="activeDocument"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      @mousedown.self="closeDocViewer">
      <div class="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-3xl max-h-[85vh] flex flex-col">

        <!-- Modal header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0 gap-4">
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <svg class="w-5 h-5 text-teal-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div v-if="!editingDocument" class="flex-1 min-w-0">
              <h3 class="font-semibold text-white truncate">{{ activeDocument.name }}</h3>
            </div>
            <input v-else v-model="editDocForm.name"
              class="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <template v-if="!editingDocument">
              <button
                @click="editingDocument = true; editDocForm = { name: activeDocument.name, content: activeDocument.content ?? '' }"
                class="px-3 py-1.5 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors">
                Editar
              </button>
            </template>
            <template v-else>
              <button @click="editingDocument = false"
                class="px-3 py-1.5 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors">
                Cancelar
              </button>
              <button @click="saveDocument" :disabled="savingDocument"
                class="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors">
                {{ savingDocument ? 'Guardando...' : 'Guardar' }}
              </button>
            </template>
            <button @click="closeDocViewer"
              class="p-1.5 text-slate-500 hover:text-slate-300 transition-colors rounded-lg hover:bg-slate-800">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Modal body -->
        <div class="flex-1 overflow-y-auto p-6 min-h-0">
          <div v-if="docViewerLoading" class="flex justify-center py-10">
            <div class="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
          </div>
          <div v-else-if="!editingDocument">
            <pre v-if="activeDocument.content"
              class="whitespace-pre-wrap text-sm text-slate-300 font-mono leading-relaxed">{{ activeDocument.content }}</pre>
            <p v-else class="text-slate-500 text-sm italic">Sin contenido. Haz clic en Editar para añadir.</p>
          </div>
          <div v-else>
            <label class="block text-xs text-slate-400 mb-1.5">Contenido (markdown)</label>
            <textarea v-model="editDocForm.content" rows="20"
              class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none leading-relaxed"
              placeholder="Escribe el contenido en markdown..." />
          </div>
        </div>

        <!-- Modal footer -->
        <div v-if="!editingDocument && activeDocument.updatedAt"
          class="px-6 py-3 border-t border-slate-800 shrink-0 flex gap-4 text-xs text-slate-600">
          <span>Creado: {{ new Date(activeDocument.createdAt).toLocaleString() }}</span>
          <span>Actualizado: {{ new Date(activeDocument.updatedAt).toLocaleString() }}</span>
        </div>

      </div>
    </div>
  </teleport>
</template>
