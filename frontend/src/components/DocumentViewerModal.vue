<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import TextAreaComplete from '@/components/TextAreaComplete.vue'
import * as api from '@/api/api'

interface DocumentVersion {
  id: string
  stageId: string
  name: string
  content: string
  active: boolean
  originalId: string | null
  createdAt: string
  updatedAt: string
}

const props = defineProps<{
  documentId: string
  canEdit?: boolean
  subtitle?: string | null
}>()

const emit = defineEmits<{
  close: []
  saved: [doc: DocumentVersion]
  error: [message: string]
}>()

type Tab = 'content' | 'history'
const tab = ref<Tab>('content')

const activeDocument = ref<DocumentVersion | null>(null)
const loading = ref(false)
const editing = ref(false)
const editForm = ref({ name: '', content: '' })
const saving = ref(false)

const history = ref<DocumentVersion[]>([])
const historyLoading = ref(false)
const selectedVersionId = ref<string | null>(null)

async function loadDocument() {
  loading.value = true
  try {
    const res = await api.getTraceabilityDocument(props.documentId)
    activeDocument.value = res.data
    editForm.value = { name: res.data.name, content: res.data.content ?? '' }
  } catch (e: any) {
    emit('error', e.message)
  } finally {
    loading.value = false
  }
}

async function loadHistory() {
  if (!activeDocument.value) return
  historyLoading.value = true
  try {
    const res = await api.getTraceabilityDocumentHistory(activeDocument.value.id)
    history.value = res.data ?? []
    if (history.value.length > 0 && !selectedVersionId.value) {
      selectedVersionId.value = history.value[0].id
    }
  } catch (e: any) {
    emit('error', e.message)
  } finally {
    historyLoading.value = false
  }
}

watch(tab, (t) => {
  if (t === 'history' && history.value.length === 0) loadHistory()
})

async function save() {
  if (!activeDocument.value) return
  saving.value = true
  try {
    const res = await api.updateTraceabilityDocument(activeDocument.value.id, editForm.value)
    activeDocument.value = res.data
    editing.value = false
    history.value = [] // invalidate; will reload on tab switch
    selectedVersionId.value = null
    emit('saved', res.data)
  } catch (e: any) {
    emit('error', e.message)
  } finally {
    saving.value = false
  }
}

function startEditing() {
  if (!activeDocument.value) return
  editForm.value = { name: activeDocument.value.name, content: activeDocument.value.content ?? '' }
  editing.value = true
}

function cancelEdit() {
  editing.value = false
  if (activeDocument.value) {
    editForm.value = { name: activeDocument.value.name, content: activeDocument.value.content ?? '' }
  }
}

// ── Diff (line-level LCS) ────────────────────────────────────────────────────
type DiffOp = 'equal' | 'add' | 'remove'
interface DiffLine { op: DiffOp; left: string | null; right: string | null; leftNum: number | null; rightNum: number | null }

function diffLines(oldText: string, newText: string): DiffLine[] {
  const a = oldText.split('\n')
  const b = newText.split('\n')
  const n = a.length, m = b.length
  // DP table for LCS lengths
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const result: DiffLine[] = []
  let i = 0, j = 0, leftLine = 1, rightLine = 1
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      result.push({ op: 'equal', left: a[i], right: b[j], leftNum: leftLine++, rightNum: rightLine++ })
      i++; j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ op: 'remove', left: a[i], right: null, leftNum: leftLine++, rightNum: null })
      i++
    } else {
      result.push({ op: 'add', left: null, right: b[j], leftNum: null, rightNum: rightLine++ })
      j++
    }
  }
  while (i < n) result.push({ op: 'remove', left: a[i++], right: null, leftNum: leftLine++, rightNum: null })
  while (j < m) result.push({ op: 'add', left: null, right: b[j++], leftNum: null, rightNum: rightLine++ })
  return result
}

const selectedVersion = computed(() =>
  history.value.find((v) => v.id === selectedVersionId.value) ?? null
)

const previousVersion = computed(() => {
  if (!selectedVersion.value) return null
  const idx = history.value.findIndex((v) => v.id === selectedVersion.value!.id)
  return idx >= 0 && idx + 1 < history.value.length ? history.value[idx + 1] : null
})

const currentDiff = computed<DiffLine[]>(() => {
  if (!selectedVersion.value) return []
  const oldText = previousVersion.value?.content ?? ''
  const newText = selectedVersion.value.content ?? ''
  return diffLines(oldText, newText)
})

const diffStats = computed(() => {
  let adds = 0, removes = 0
  for (const d of currentDiff.value) {
    if (d.op === 'add') adds++
    else if (d.op === 'remove') removes++
  }
  return { adds, removes }
})

function shortId(id: string): string {
  return id.slice(0, 7)
}

function fmtDate(s: string): string {
  return new Date(s).toLocaleString()
}

onMounted(loadDocument)
</script>

<template>
  <teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      @mousedown.self="emit('close')">
      <div class="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-5xl h-[90vh] flex flex-col">

        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0 gap-4">
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <svg class="w-5 h-5 text-teal-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div v-if="!editing" class="flex-1 min-w-0">
              <h3 class="font-semibold text-white truncate">{{ activeDocument?.name || 'Cargando…' }}</h3>
              <p v-if="subtitle" class="text-xs text-slate-500 mt-0.5 truncate">{{ subtitle }}</p>
            </div>
            <input v-else v-model="editForm.name"
              class="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <template v-if="!editing">
              <button v-if="canEdit && tab === 'content' && activeDocument" @click="startEditing"
                class="px-3 py-1.5 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors">
                Editar
              </button>
            </template>
            <template v-else>
              <button @click="cancelEdit"
                class="px-3 py-1.5 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors">
                Cancelar
              </button>
              <button @click="save" :disabled="saving"
                class="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors">
                {{ saving ? 'Guardando…' : 'Guardar' }}
              </button>
            </template>
            <button @click="emit('close')"
              class="p-1.5 text-slate-500 hover:text-slate-300 transition-colors rounded-lg hover:bg-slate-800">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Tabs -->
        <div v-if="!editing" class="px-6 pt-3 border-b border-slate-800 shrink-0 flex gap-1">
          <button @click="tab = 'content'"
            class="px-3 py-2 text-xs font-medium rounded-t-lg transition-colors border-b-2" :class="tab === 'content'
              ? 'text-white border-indigo-400'
              : 'text-slate-400 hover:text-slate-200 border-transparent'">
            Contenido
          </button>
          <button @click="tab = 'history'"
            class="px-3 py-2 text-xs font-medium rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5"
            :class="tab === 'history'
              ? 'text-white border-indigo-400'
              : 'text-slate-400 hover:text-slate-200 border-transparent'">
            Historial
            <span v-if="history.length > 0"
              class="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-300">{{
                history.length }}</span>
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-hidden min-h-0">
          <!-- Loading -->
          <div v-if="loading" class="flex justify-center py-10">
            <div class="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
          </div>

          <!-- Content tab — view mode -->
          <div v-else-if="tab === 'content' && !editing" class="h-full overflow-y-auto p-6">
            <pre v-if="activeDocument?.content" class="whitespace-pre-wrap text-sm text-slate-300 font-mono">{{
              activeDocument.content }}</pre>
            <p v-else class="text-slate-500 text-sm italic">Sin contenido. Haz clic en Editar para añadir.</p>
          </div>

          <!-- Content tab — edit mode -->
          <div v-else-if="tab === 'content' && editing" class="h-full flex flex-col p-6 min-h-0">
            <label class="block text-xs text-slate-400 mb-1.5 shrink-0">Contenido (markdown)</label>
            <div class="flex-1 min-h-0">
              <TextAreaComplete v-model="editForm.content"
                class="w-full h-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none leading-relaxed"
                placeholder="Escribe el contenido en markdown..." />
            </div>
          </div>

          <!-- History tab -->
          <div v-else class="h-full flex min-h-0">
            <!-- Version list -->
            <div class="w-56 shrink-0 border-r border-slate-800 overflow-y-auto">
              <div v-if="historyLoading" class="flex justify-center py-6">
                <div class="animate-spin w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full" />
              </div>
              <div v-else-if="history.length === 0" class="px-3 py-6 text-center text-slate-500 text-xs">
                Sin historial
              </div>
              <button v-for="(v, i) in history" :key="v.id"
                class="w-full text-left px-3 py-2.5 border-b border-slate-800/60 transition-colors"
                :class="selectedVersionId === v.id ? 'bg-slate-800' : 'hover:bg-slate-800/50'"
                @click="selectedVersionId = v.id">
                <div class="flex items-center gap-2">
                  <span class="text-[10px] font-mono text-slate-500 shrink-0">{{ shortId(v.id) }}</span>
                  <span v-if="v.active"
                    class="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold shrink-0">
                    Actual
                  </span>
                  <span v-else
                    class="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-400 font-medium shrink-0">
                    v{{ history.length - i }}
                  </span>
                </div>
                <p class="text-xs text-slate-300 truncate mt-1">{{ v.name }}</p>
                <p class="text-[10px] text-slate-500 mt-0.5">{{ fmtDate(v.updatedAt) }}</p>
              </button>
            </div>

            <!-- Diff viewer -->
            <div class="flex-1 flex flex-col min-w-0">
              <div v-if="selectedVersion"
                class="px-4 py-2 border-b border-slate-800 shrink-0 flex items-center gap-3 text-xs">
                <span class="font-mono text-slate-400">{{ shortId(selectedVersion.id) }}</span>
                <span class="text-slate-500">vs</span>
                <span class="font-mono text-slate-400">{{ previousVersion ? shortId(previousVersion.id) : '∅ (inicial)'
                  }}</span>
                <span class="ml-auto flex gap-2">
                  <span class="text-emerald-400">+{{ diffStats.adds }}</span>
                  <span class="text-rose-400">−{{ diffStats.removes }}</span>
                </span>
              </div>
              <div class="flex-1 overflow-y-auto bg-slate-950/50 font-mono text-xs">
                <div v-if="!selectedVersion" class="px-4 py-6 text-center text-slate-500">
                  Selecciona una versión para ver los cambios
                </div>
                <div v-else-if="currentDiff.length === 0" class="px-4 py-6 text-center text-slate-500">
                  Documento vacío
                </div>
                <div v-else>
                  <div v-for="(line, idx) in currentDiff" :key="idx" class="flex border-b border-slate-900/60" :class="{
                    'bg-emerald-500/10': line.op === 'add',
                    'bg-rose-500/10': line.op === 'remove'
                  }">
                    <span
                      class="w-10 shrink-0 text-right px-2 py-1 text-slate-600 select-none border-r border-slate-800">
                      {{ line.leftNum ?? '' }}
                    </span>
                    <span
                      class="w-10 shrink-0 text-right px-2 py-1 text-slate-600 select-none border-r border-slate-800">
                      {{ line.rightNum ?? '' }}
                    </span>
                    <span class="w-5 shrink-0 px-1 py-1 text-center select-none" :class="{
                      'text-emerald-400': line.op === 'add',
                      'text-rose-400': line.op === 'remove',
                      'text-slate-700': line.op === 'equal'
                    }">
                      {{ line.op === 'add' ? '+' : line.op === 'remove' ? '−' : ' ' }}
                    </span>
                    <pre class="flex-1 px-2 py-1 whitespace-pre-wrap break-all" :class="{
                      'text-emerald-200': line.op === 'add',
                      'text-rose-200': line.op === 'remove',
                      'text-slate-400': line.op === 'equal'
                    }">{{ line.op === 'add' ? line.right : line.left }}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div v-if="!editing && activeDocument && tab === 'content'"
          class="px-6 py-3 border-t border-slate-800 shrink-0 flex gap-4 text-xs text-slate-600">
          <span>Creado: {{ fmtDate(activeDocument.createdAt) }}</span>
          <span>Actualizado: {{ fmtDate(activeDocument.updatedAt) }}</span>
        </div>

      </div>
    </div>
  </teleport>
</template>
