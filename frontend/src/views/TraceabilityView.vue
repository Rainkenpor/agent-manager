<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'
import { useAuthStore } from '@/store/useAuth'
import { useToastStore } from '@/store/useToast'
import * as api from '@/api/api'

const router = useRouter()
const auth = useAuthStore()
const toast = useToastStore()

// ── Tabs ─────────────────────────────────────────────────────────────────────
const activeTab = ref<'traceabilities' | 'templates'>('traceabilities')

// ── Shared data ───────────────────────────────────────────────────────────────
const templates = ref<any[]>([])
const traceabilities = ref<any[]>([])
const roles = ref<any[]>([])
const loading = ref(false)

function roleNameById(id: string) {
  return roles.value.find(r => r.id === id)?.name ?? id
}

const canCreate = computed(() => auth.hasPermission('traceability', 'create'))
const canUpdate = computed(() => auth.hasPermission('traceability', 'update'))
const canDelete = computed(() => auth.hasPermission('traceability', 'delete'))

async function fetchAll() {
  loading.value = true
  try {
    const [tplRes, tracRes, rolesRes] = await Promise.all([
      api.getTraceabilityTemplates(),
      api.getTraceabilities(),
      api.getRoles(),
    ])
    templates.value = tplRes.data ?? []
    traceabilities.value = tracRes.data ?? []
    roles.value = Array.isArray(rolesRes) ? rolesRes : (rolesRes as any).data ?? []
  } catch (e: any) {
    toast.error(e.message)
  } finally {
    loading.value = false
  }
}

// ── Traceability list ─────────────────────────────────────────────────────────
const showCreateTrac = ref(false)
const deleteTracTarget = ref<any>(null)
const tracForm = ref({ title: '', description: '', templateId: '' })

async function createTraceability() {
  if (!tracForm.value.title || !tracForm.value.templateId) return
  try {
    const res = await api.createTraceability(tracForm.value)
    toast.success('Trazabilidad creada')
    showCreateTrac.value = false
    tracForm.value = { title: '', description: '', templateId: '' }
    router.push(`/traceability/${res.data.id}`)
  } catch (e: any) {
    toast.error(e.message)
  }
}

async function confirmDeleteTrac() {
  if (!deleteTracTarget.value) return
  try {
    await api.deleteTraceability(deleteTracTarget.value.id)
    toast.success('Trazabilidad eliminada')
    deleteTracTarget.value = null
    await fetchAll()
  } catch (e: any) {
    toast.error(e.message)
  }
}

const tracStatusLabel: Record<string, string> = { active: 'Activo', completed: 'Completado', archived: 'Archivado' }
const tracStatusClass: Record<string, string> = {
  active: 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20',
  completed: 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20',
  archived: 'bg-slate-500/10 text-slate-400 ring-1 ring-slate-500/20',
}

// ── Templates ─────────────────────────────────────────────────────────────────
const activeTemplate = ref<any>(null)
const showCreateTemplate = ref(false)
const deleteTplTarget = ref<any>(null)
const editingTemplate = ref(false)
const templateForm = ref({ name: '', description: '' })
const editTplForm = ref({ name: '', description: '' })

// Stage form
const showStageForm = ref(false)
const editingStage = ref<any>(null)
const stageForm = ref({ name: '', description: '', role: '', order: 0, parallelGroup: '' })

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
    await fetchAll()
    activeTemplate.value = templates.value.find(t => t.id === activeTemplate.value.id) ?? null
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

// ── Template stages ───────────────────────────────────────────────────────────
function openStageForm(stage?: any) {
  if (stage) {
    editingStage.value = stage
    stageForm.value = {
      name: stage.name,
      description: stage.description ?? '',
      role: stage.role ?? '',
      order: stage.order,
      parallelGroup: stage.parallelGroup ?? '',
    }
  } else {
    editingStage.value = null
    stageForm.value = {
      name: '',
      description: '',
      role: '',
      order: activeTemplate.value?.stages?.length ?? 0,
      parallelGroup: '',
    }
  }
  showStageForm.value = true
}

async function saveStage() {
  if (!stageForm.value.name) return
  const payload = {
    ...stageForm.value,
    parallelGroup: stageForm.value.parallelGroup || undefined,
    role: stageForm.value.role || undefined,
    description: stageForm.value.description || undefined,
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
    await fetchAll()
    activeTemplate.value = templates.value.find(t => t.id === activeTemplate.value.id) ?? null
  } catch (e: any) {
    toast.error(e.message)
  }
}

async function deleteStage(stage: any) {
  try {
    await api.deleteTemplateStage(stage.id)
    toast.success('Etapa eliminada')
    await fetchAll()
    activeTemplate.value = templates.value.find(t => t.id === activeTemplate.value.id) ?? null
  } catch (e: any) {
    toast.error(e.message)
  }
}

onMounted(fetchAll)
</script>

<template>
  <AppLayout>
    <div class="p-6 bg-slate-950 text-white min-h-full">

      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-white">Trazabilidad</h1>
          <p class="text-slate-400 text-sm mt-1">Flujos de trabajo con etapas, tareas y trazabilidad de avance</p>
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
      <div class="flex gap-1 mb-6 bg-slate-900 rounded-xl p-1 w-fit">
        <button v-for="tab in [{ key: 'traceabilities', label: 'Trazabilidades' }, { key: 'templates', label: 'Templates' }]"
          :key="tab.key"
          @click="activeTab = tab.key as any"
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
      <template v-if="!loading && activeTab === 'traceabilities'">
        <div v-if="traceabilities.length === 0" class="text-center py-20">
          <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
            <svg class="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
            </svg>
          </div>
          <p class="text-slate-400">No hay trazabilidades aún</p>
          <p class="text-slate-500 text-sm mt-1">
            <span v-if="templates.length === 0">Primero crea un template en la pestaña Templates, luego vuelve aquí.</span>
            <span v-else>Crea una desde un template para comenzar.</span>
          </p>
        </div>

        <div v-else class="grid gap-4">
          <div v-for="item in traceabilities" :key="item.id"
            class="bg-slate-900 rounded-xl border border-slate-800 p-5 hover:border-slate-700 transition-colors cursor-pointer"
            @click="router.push(`/traceability/${item.id}`)">
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-3 mb-1">
                  <h3 class="font-semibold text-white truncate">{{ item.title }}</h3>
                  <span class="text-xs px-2 py-0.5 rounded-full font-medium shrink-0" :class="tracStatusClass[item.status]">
                    {{ tracStatusLabel[item.status] }}
                  </span>
                </div>
                <p v-if="item.description" class="text-slate-400 text-sm truncate">{{ item.description }}</p>
                <div class="flex items-center gap-4 mt-3 text-xs text-slate-500">
                  <span v-if="item.templateName">Template: <span class="text-slate-400">{{ item.templateName }}</span></span>
                  <span>Etapas: <span class="text-slate-400">{{ item.completedStages }}/{{ item.stageCount }}</span></span>
                  <span>{{ new Date(item.createdAt).toLocaleDateString('es') }}</span>
                </div>
              </div>
              <div class="flex flex-col items-end gap-2 shrink-0">
                <div class="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div class="h-full bg-teal-500 rounded-full transition-all"
                    :style="`width:${item.stageCount ? Math.round((item.completedStages / item.stageCount) * 100) : 0}%`" />
                </div>
                <span class="text-xs text-slate-500">
                  {{ item.stageCount ? Math.round((item.completedStages / item.stageCount) * 100) : 0 }}%
                </span>
                <button v-if="canDelete" @click.stop="deleteTracTarget = item"
                  class="text-xs text-slate-500 hover:text-red-400 transition-colors">Eliminar</button>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- ══════════════════════════════════════════════════════════════════════ -->
      <!-- TAB: TEMPLATES -->
      <!-- ══════════════════════════════════════════════════════════════════════ -->
      <template v-if="!loading && activeTab === 'templates'">
        <div class="flex gap-6">
          <!-- Template list (sidebar) -->
          <div class="w-64 shrink-0 space-y-2">
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

            <div v-if="templates.length === 0" class="text-center py-8 text-slate-500 text-sm">
              No hay templates
            </div>
          </div>

          <!-- Template detail -->
          <div class="flex-1 min-w-0">
            <div v-if="!activeTemplate" class="flex flex-col items-center justify-center h-64 text-slate-500">
              <svg class="w-12 h-12 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p>Selecciona un template para ver sus etapas</p>
            </div>

            <div v-else>
              <!-- Template header -->
              <div v-if="!editingTemplate" class="flex items-start justify-between mb-6">
                <div>
                  <h2 class="text-xl font-bold text-white">{{ activeTemplate.name }}</h2>
                  <p v-if="activeTemplate.description" class="text-slate-400 text-sm mt-1">{{ activeTemplate.description }}</p>
                </div>
                <button v-if="canUpdate" @click="editingTemplate = true"
                  class="px-3 py-1.5 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors shrink-0">
                  Editar
                </button>
              </div>

              <div v-else class="bg-slate-900 rounded-xl border border-slate-700 p-4 mb-6 space-y-3">
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
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-sm font-semibold text-slate-400 uppercase tracking-wider">Etapas</h3>
                <button v-if="canUpdate" @click="openStageForm()"
                  class="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
                  + Añadir etapa
                </button>
              </div>

              <!-- Stage form -->
              <div v-if="showStageForm" class="bg-slate-900 rounded-xl border border-slate-700 p-4 mb-4 space-y-3">
                <h4 class="text-sm font-medium text-white">{{ editingStage ? 'Editar etapa' : 'Nueva etapa' }}</h4>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs text-slate-400 mb-1">Nombre *</label>
                    <input v-model="stageForm.name" type="text" placeholder="Ej: Implementación"
                      class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label class="block text-xs text-slate-400 mb-1">Rol</label>
                    <select v-model="stageForm.role"
                      class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="">Sin rol asignado</option>
                      <option v-for="r in roles" :key="r.id" :value="r.id">{{ r.name }}</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-xs text-slate-400 mb-1">Orden</label>
                    <input v-model.number="stageForm.order" type="number" min="0"
                      class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label class="block text-xs text-slate-400 mb-1">
                      Grupo paralelo
                      <span class="text-slate-600">(mismo valor = paralelas)</span>
                    </label>
                    <input v-model="stageForm.parallelGroup" type="text" placeholder="Ej: qa-group"
                      class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
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
                  <button @click="saveStage" :disabled="!stageForm.name"
                    class="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors">
                    {{ editingStage ? 'Actualizar' : 'Crear' }}
                  </button>
                </div>
              </div>

              <!-- Stage list -->
              <div v-if="activeTemplate.stages?.length" class="space-y-2">
                <div v-for="stage in [...activeTemplate.stages].sort((a: any, b: any) => a.order - b.order)" :key="stage.id"
                  class="bg-slate-900 rounded-xl border border-slate-800 p-4 hover:border-slate-700 transition-colors">
                  <div class="flex items-start gap-3">
                    <span class="text-xs font-mono text-slate-600 mt-0.5 w-5 shrink-0">#{{ stage.order }}</span>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-medium text-white text-sm">{{ stage.name }}</span>
                        <span v-if="stage.role" class="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">{{ roleNameById(stage.role) }}</span>
                        <span v-if="stage.parallelGroup" class="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">
                          paralelo: {{ stage.parallelGroup }}
                        </span>
                      </div>
                      <p v-if="stage.description" class="text-xs text-slate-500 mt-1">{{ stage.description }}</p>
                    </div>
                    <div v-if="canUpdate" class="flex gap-3 shrink-0">
                      <button @click="openStageForm(stage)"
                        class="text-xs text-slate-500 hover:text-white transition-colors">Editar</button>
                      <button v-if="canDelete" @click="deleteStage(stage)"
                        class="text-xs text-slate-500 hover:text-red-400 transition-colors">Eliminar</button>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else-if="!showStageForm" class="text-center py-10 text-slate-500 text-sm">
                Sin etapas — añade la primera etapa para definir el flujo
              </div>
            </div>
          </div>
        </div>
      </template>

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
                <button @click="showCreateTrac = false; activeTab = 'templates'" class="underline">Crea uno en la pestaña Templates</button>.
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
