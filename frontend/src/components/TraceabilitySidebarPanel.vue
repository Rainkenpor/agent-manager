<script setup lang="ts">
import { ref, watch } from 'vue'
import * as api from '@/api/api'
import DocumentViewerModal from '@/components/DocumentViewerModal.vue'

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

const props = defineProps<{ conversationId: string; activeStageId?: string | null }>()

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
const viewingDocumentId = ref<string | null>(null)

// ── Lookups ───────────────────────────────────────────────────────────────────

const stageStatusLabel: Record<string, string> = {
  pending: 'Pendiente',
  active: 'Activa',
  completed: 'Completada',
  blocked: 'Bloqueada',
  'in-review': 'En revisión',
}

const stageStatusClass: Record<string, string> = {
  pending: 'bg-base-100 text-base-content',
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
      if (props.activeStageId) expandedStages.value = new Set([props.activeStageId])
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
watch(() => props.activeStageId, (id) => {
  if (id) {
    expandedStages.value = new Set([...expandedStages.value, id])
  }
})

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

function openDocument(doc: TraceabilityDocument) {
  viewingDocumentId.value = doc.id
}

function onDocumentSaved(savedDoc: { id: string; name: string }) {
  for (const trac of linkedTraceabilities.value) {
    for (const stage of trac.stages) {
      const idx = stage.documents.findIndex((d) => d.id === viewingDocumentId.value || d.id === savedDoc.id)
      if (idx !== -1) {
        stage.documents[idx] = { id: savedDoc.id, name: savedDoc.name }
        viewingDocumentId.value = savedDoc.id
        return
      }
    }
  }
  viewingDocumentId.value = savedDoc.id
}
</script>

<template>
  <!-- Sidebar panel -->
  <div class="w-72 shrink-0 flex flex-col border-l border-base-300 bg-base-100 overflow-hidden">

    <!-- Header -->
    <div class="px-4 py-3 border-b border-base-300 flex items-center justify-between shrink-0">
      <div class="flex items-center gap-2 min-w-0">
        <svg class="w-4 h-4 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <span class="text-xs font-semibold text-base-content truncate">Trazabilidad</span>
        <span v-if="linkedTraceabilities.length > 0"
          class="shrink-0 px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-medium">
          {{ linkedTraceabilities.length }}
        </span>
      </div>
      <button @click="emit('close')" class="shrink-0 text-base-content/50 hover:text-base-content transition-colors">
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
      <p class="text-base-content/50 text-xs">Sin trazabilidad vinculada</p>
    </div>

    <!-- Traceabilities list -->
    <div v-else class="flex-1 overflow-y-auto divide-y divide-base-300/60">

      <div v-for="trac in linkedTraceabilities" :key="trac.id">

        <!-- Traceability header (collapsible) -->
        <button class="w-full px-4 py-2.5 flex items-center gap-2 hover:bg-base-200/40 transition-colors text-left"
          @click="toggleTraceability(trac.id)">
          <svg class="w-3 h-3 text-indigo-400 shrink-0 transition-transform"
            :class="expandedTraceabilities.has(trac.id) ? 'rotate-90' : ''" fill="none" stroke="currentColor"
            viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
          </svg>
          <span class="flex-1 text-xs font-semibold text-base-content truncate">{{ trac.title }}</span>
          <span class="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium" :class="{
            'bg-green-500/20 text-green-300': trac.status === 'completed',
            'bg-indigo-500/20 text-indigo-300': trac.status === 'active',
            'bg-base-100 text-base-content/60': trac.status === 'archived',
          }">
            {{ trac.status === 'completed' ? 'Completada' : trac.status === 'active' ? 'Activa' : 'Archivada' }}
          </span>
        </button>

        <!-- Traceability stages (expanded) -->
        <div v-if="expandedTraceabilities.has(trac.id)" class="divide-y divide-base-300/40 bg-base-300/20">

          <div v-for="stage in topoSort(trac.stages)" :key="stage.id"
            :class="stage.id === activeStageId ? 'bg-indigo-500/10 border-l-2 border-indigo-400' : ''">

            <!-- Stage header -->
            <button
              class="w-full pl-6 pr-4 py-2 flex items-center gap-2 hover:bg-base-200/40 transition-colors text-left"
              @click="toggleStage(stage.id)">
              <svg class="w-3 h-3 shrink-0 transition-transform"
                :class="[
                  expandedStages.has(stage.id) ? 'rotate-90' : '',
                  stage.id === activeStageId ? 'text-indigo-300' : 'text-base-content/50'
                ]" fill="none" stroke="currentColor"
                viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
              </svg>
              <span class="flex-1 text-xs font-medium truncate"
                :class="stage.id === activeStageId ? 'text-base-content' : 'text-base-content'">{{ stage.name }}</span>
              <span v-if="stage.id === activeStageId"
                class="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-indigo-500/30 text-indigo-200"
                title="Este chat está vinculado a este stage">
                En uso
              </span>
              <span class="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium"
                :class="stageStatusClass[stage.status] ?? 'bg-base-100 text-base-content/60'">
                {{ stageStatusLabel[stage.status] ?? stage.status }}
              </span>
            </button>

            <!-- Stage content (expanded) -->
            <div v-if="expandedStages.has(stage.id)" class="pl-8 pr-4 pb-3 space-y-3 pt-1">

              <!-- Tasks -->
              <div v-if="stage.tasks.length">
                <p class="text-[10px] uppercase tracking-wider text-base-content/50 font-semibold mb-1.5">Tareas</p>
                <div class="space-y-1.5">
                  <div v-for="task in stage.tasks" :key="task.id"
                    class="flex items-start gap-2 cursor-pointer select-none" @click.prevent="toggleTask(task)">
                    <div class="mt-0.5 shrink-0">
                      <div v-if="togglingTaskId === task.id"
                        class="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                      <div v-else class="w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors"
                        :class="task.status === 'done'
                          ? 'bg-indigo-600 border-indigo-500'
                          : 'border-base-content/20 hover:border-indigo-500'">
                        <svg v-if="task.status === 'done'" class="w-2.5 h-2.5 text-base-content" fill="none"
                          stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                    <span class="text-xs leading-snug pt-px"
                      :class="task.status === 'done' ? 'text-base-content/50 line-through' : 'text-base-content'">
                      {{ task.title }}
                      <span v-if="task.type === 'bug'"
                        class="ml-1 px-1 py-0 rounded bg-red-500/20 text-red-400 text-[9px] font-medium">bug</span>
                    </span>
                  </div>
                </div>
              </div>

              <!-- Documents -->
              <div v-if="stage.documents.length">
                <p class="text-[10px] uppercase tracking-wider text-base-content/50 font-semibold mb-1.5">Documentos</p>
                <div class="space-y-1">
                  <button v-for="doc in stage.documents" :key="doc.id"
                    class="w-full flex items-center gap-1.5 text-xs text-base-content/60 hover:text-teal-300 transition-colors text-left group"
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
                <p class="text-[10px] uppercase tracking-wider text-base-content/50 font-semibold mb-1.5">Links</p>
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
                class="text-xs text-base-content/40 italic">Sin elementos</p>
            </div>

          </div>
        </div>

      </div>
    </div>

  </div>

  <DocumentViewerModal v-if="viewingDocumentId" :document-id="viewingDocumentId" :can-edit="true"
    @close="viewingDocumentId = null" @saved="onDocumentSaved" @error="emit('error', $event)" />
</template>
