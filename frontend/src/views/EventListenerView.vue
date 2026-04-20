<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import * as api from '@/api/api'
import AppModal from '@/components/AppModal.vue'
import { useAuthStore } from '@/store/useAuth'
import { useToastStore } from '@/store/useToast'

const auth = useAuthStore()
const toast = useToastStore()

// ── Types ─────────────────────────────────────────────────────────────────────

interface ELSource {
  function_name: string
  params: Record<string, unknown>
}
interface ELCondition {
  field: string
  operator: string
  value: unknown
}
interface ELAction {
  function_name: string
  params: Record<string, unknown>
}
interface EventListener {
  id: string
  name: string
  schedule: string
  source: ELSource
  condition: ELCondition
  action: ELAction[]
  enabled: boolean
  lastRunAt: string | null
  lastRunResult: string | null
  createdAt: string
  updatedAt: string
}

// ── Permissions ───────────────────────────────────────────────────────────────

const canCreate = computed(() => auth.hasPermission('event_listeners', 'create'))
const canUpdate = computed(() => auth.hasPermission('event_listeners', 'update'))
const canDelete = computed(() => auth.hasPermission('event_listeners', 'delete'))

// ── State ─────────────────────────────────────────────────────────────────────

const listeners = ref<EventListener[]>([])
const loading = ref(false)
const triggering = ref<string | null>(null)

// ── Form / Modal ──────────────────────────────────────────────────────────────

const showModal = ref(false)
const editing = ref<EventListener | null>(null)
const saving = ref(false)

const OPERATORS = ['==', '===', '!=', '!==', '>', '<', '>=', '<=', 'contains', 'startsWith', 'endsWith']

const emptyForm = () => ({
  name: '',
  schedule: '*/15 * * * *',
  source: { function_name: '', params: '{}' },
  condition: { field: 'element.status.name', operator: '==', value: '' },
  action: [{ function_name: '', params: '{}' }] as Array<{ function_name: string; params: string }>,
  enabled: true
})

const form = ref(emptyForm())
const formErrors = ref<string[]>([])

function openCreate() {
  editing.value = null
  form.value = emptyForm()
  formErrors.value = []
  showModal.value = true
}

function openEdit(item: EventListener) {
  editing.value = item
  form.value = {
    name: item.name,
    schedule: item.schedule,
    source: { function_name: item.source.function_name, params: JSON.stringify(item.source.params, null, 2) },
    condition: { field: item.condition.field, operator: item.condition.operator, value: String(item.condition.value) },
    action: item.action.map((a) => ({ function_name: a.function_name, params: JSON.stringify(a.params, null, 2) })),
    enabled: item.enabled
  }
  formErrors.value = []
  showModal.value = true
}

function addAction() {
  form.value.action.push({ function_name: '', params: '{}' })
}

function removeAction(idx: number) {
  form.value.action.splice(idx, 1)
}

function parseParams(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) return parsed
    throw new Error()
  } catch {
    throw new Error(`Parámetros JSON inválidos: "${raw}"`)
  }
}

function parseConditionValue(raw: string): unknown {
  // Try to parse as JSON first (handles numbers, booleans, null), fallback to string
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

async function save() {
  formErrors.value = []
  const errors: string[] = []

  if (!form.value.name.trim()) errors.push('El nombre es requerido.')
  if (!form.value.schedule.trim()) errors.push('La expresión cron es requerida.')
  if (!form.value.source.function_name.trim()) errors.push('El nombre del tool fuente es requerido.')
  if (!form.value.condition.field.trim()) errors.push('El campo de condición es requerido.')
  if (form.value.action.length === 0) errors.push('Se requiere al menos una acción.')
  form.value.action.forEach((a, i) => {
    if (!a.function_name.trim()) errors.push(`Acción ${i + 1}: nombre del tool requerido.`)
  })

  let sourceParams: Record<string, unknown> = {}
  let actionParsed: Array<{ function_name: string; params: Record<string, unknown> }> = []

  try {
    sourceParams = parseParams(form.value.source.params)
  } catch (e: any) {
    errors.push(`Fuente → ${e.message}`)
  }

  try {
    actionParsed = form.value.action.map((a, i) => ({
      function_name: a.function_name,
      params: (() => {
        try {
          return parseParams(a.params)
        } catch (e: any) {
          throw new Error(`Acción ${i + 1} → ${e.message}`)
        }
      })()
    }))
  } catch (e: any) {
    errors.push(e.message)
  }

  if (errors.length > 0) {
    formErrors.value = errors
    return
  }

  const payload = {
    name: form.value.name.trim(),
    schedule: form.value.schedule.trim(),
    source: { function_name: form.value.source.function_name.trim(), params: sourceParams },
    condition: {
      field: form.value.condition.field.trim(),
      operator: form.value.condition.operator,
      value: parseConditionValue(String(form.value.condition.value))
    },
    action: actionParsed,
    enabled: form.value.enabled
  }

  saving.value = true
  try {
    if (editing.value) {
      const res = await api.updateEventListener(editing.value.id, payload)
      if (!res.success) throw new Error((res as any).error)
      toast.success('Listener actualizado')
    } else {
      const res = await api.createEventListener(payload)
      if (!res.success) throw new Error((res as any).error)
      toast.success('Listener creado')
    }
    showModal.value = false
    await fetchListeners()
  } catch (e: any) {
    toast.error(e.message || 'Error al guardar')
  } finally {
    saving.value = false
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

const deleting = ref<string | null>(null)

async function remove(item: EventListener) {
  if (!confirm(`¿Eliminar el listener "${item.name}"?`)) return
  deleting.value = item.id
  try {
    await api.deleteEventListener(item.id)
    toast.success('Listener eliminado')
    await fetchListeners()
  } catch (e: any) {
    toast.error(e.message || 'Error al eliminar')
  } finally {
    deleting.value = null
  }
}

// ── Trigger ───────────────────────────────────────────────────────────────────

async function trigger(item: EventListener) {
  triggering.value = item.id
  try {
    const res = await api.triggerEventListener(item.id)
    if (res.success) {
      const { conditionMet } = res.data as any
      if (conditionMet) {
        toast.success('Condición cumplida — acciones ejecutadas. El listener fue eliminado.')
      } else {
        toast.show('Listener disparado — condición no cumplida aún.', 'info')
      }
      await fetchListeners()
    }
  } catch (e: any) {
    toast.error(e.message || 'Error al disparar')
  } finally {
    triggering.value = null
  }
}

// ── Toggle enabled ────────────────────────────────────────────────────────────

async function toggleEnabled(item: EventListener) {
  try {
    await api.updateEventListener(item.id, { enabled: !item.enabled })
    toast.success(item.enabled ? 'Listener desactivado' : 'Listener activado')
    await fetchListeners()
  } catch (e: any) {
    toast.error(e.message || 'Error')
  }
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchListeners() {
  loading.value = true
  try {
    const res = await api.getEventListeners()
    listeners.value = res.data ?? []
  } catch (e: any) {
    toast.error(e.message || 'Error al cargar listeners')
  } finally {
    loading.value = false
  }
}

onMounted(fetchListeners)

// ── Helpers ───────────────────────────────────────────────────────────────────

function resultClass(result: string | null): string {
  if (!result) return 'text-slate-500'
  if (result === 'condition_met') return 'text-emerald-400'
  if (result === 'condition_not_met') return 'text-slate-400'
  if (result.startsWith('error:')) return 'text-red-400'
  return 'text-slate-400'
}

function resultLabel(result: string | null): string {
  if (!result) return '—'
  if (result === 'condition_met') return 'Condición cumplida'
  if (result === 'condition_not_met') return 'Condición no cumplida'
  if (result.startsWith('error:')) return result
  return result
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}
</script>

<template>
  <div class="p-6  text-white min-h-full">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-white">Event Listeners</h1>
        <p class="text-slate-400 text-sm mt-1">
          Ejecutan un tool periódicamente (cron). Si la condición se cumple, disparan acciones y se auto-eliminan.
        </p>
      </div>
      <button v-if="canCreate" @click="openCreate"
        class="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors">
        <span class="mdi mdi-plus"></span> Nuevo Listener
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center gap-3 text-slate-400 py-12 justify-center">
      <span class="mdi mdi-loading mdi-spin text-2xl"></span>
      <span>Cargando listeners...</span>
    </div>

    <!-- Empty state -->
    <div v-else-if="listeners.length === 0" class="flex flex-col items-center gap-4 py-16 text-slate-500">
      <span class="mdi mdi-broadcast text-5xl"></span>
      <p class="text-lg">No hay event listeners registrados.</p>
      <button v-if="canCreate" @click="openCreate" class="text-indigo-400 hover:text-indigo-300 text-sm">
        Crear el primero
      </button>
    </div>

    <!-- List -->
    <div v-else class="space-y-3">
      <div v-for="item in listeners" :key="item.id" class="bg-slate-900 border border-slate-700/60 rounded-xl p-5">
        <div class="flex items-start justify-between gap-4">
          <!-- Info left -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-3 mb-1">
              <span class="w-2 h-2 rounded-full shrink-0"
                :class="item.enabled ? 'bg-emerald-400' : 'bg-slate-600'"></span>
              <h3 class="font-semibold text-white truncate">{{ item.name }}</h3>
              <span class="text-xs font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                {{ item.schedule }}
              </span>
            </div>

            <!-- Source / Condition / Action chips -->
            <div class="flex flex-wrap gap-2 mt-2 text-xs">
              <span class="bg-blue-500/10 text-blue-300 ring-1 ring-blue-500/20 px-2 py-0.5 rounded">
                <span class="mdi mdi-database-search-outline mr-1"></span>{{ item.source.function_name }}
              </span>
              <span class="bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/20 px-2 py-0.5 rounded">
                <span class="mdi mdi-filter-outline mr-1"></span>
                {{ item.condition.field }} {{ item.condition.operator }} {{ JSON.stringify(item.condition.value) }}
              </span>
              <span v-for="(a, i) in item.action" :key="i"
                class="bg-purple-500/10 text-purple-300 ring-1 ring-purple-500/20 px-2 py-0.5 rounded">
                <span class="mdi mdi-play-outline mr-1"></span>{{ a.function_name }}
              </span>
            </div>

            <!-- Last run info -->
            <div class="mt-2 flex items-center gap-4 text-xs text-slate-500">
              <span>Última ejecución: {{ formatDate(item.lastRunAt) }}</span>
              <span :class="resultClass(item.lastRunResult)">{{ resultLabel(item.lastRunResult) }}</span>
            </div>
          </div>

          <!-- Actions right -->
          <div class="flex items-center gap-2 shrink-0">
            <!-- Toggle enabled -->
            <button v-if="canUpdate" @click="toggleEnabled(item)" :title="item.enabled ? 'Desactivar' : 'Activar'"
              class="p-1.5 rounded-lg transition-colors" :class="item.enabled
                ? 'text-emerald-400 hover:bg-emerald-500/10'
                : 'text-slate-500 hover:bg-slate-700'">
              <span class="mdi text-lg"
                :class="item.enabled ? 'mdi-toggle-switch' : 'mdi-toggle-switch-off-outline'"></span>
            </button>

            <!-- Trigger manually -->
            <button v-if="canUpdate" @click="trigger(item)" :disabled="triggering === item.id"
              title="Disparar manualmente"
              class="p-1.5 rounded-lg text-sky-400 hover:bg-sky-500/10 transition-colors disabled:opacity-40">
              <span class="mdi text-lg"
                :class="triggering === item.id ? 'mdi-loading mdi-spin' : 'mdi-play-circle-outline'"></span>
            </button>

            <!-- Edit -->
            <button v-if="canUpdate" @click="openEdit(item)" title="Editar"
              class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
              <span class="mdi mdi-pencil-outline text-lg"></span>
            </button>

            <!-- Delete -->
            <button v-if="canDelete" @click="remove(item)" :disabled="deleting === item.id" title="Eliminar"
              class="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40">
              <span class="mdi text-lg"
                :class="deleting === item.id ? 'mdi-loading mdi-spin' : 'mdi-trash-can-outline'"></span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Modal ──────────────────────────────────────────────────────────── -->
    <AppModal
      v-if="showModal"
      size="2xl"
      :title="editing ? 'Editar Listener' : 'Nuevo Event Listener'"
      @close="showModal = false">
      <div class="px-6 py-5 space-y-5">
        <!-- Errors -->
        <div v-if="formErrors.length > 0" class="bg-red-500/10 border border-red-500/30 rounded-lg p-3 space-y-1">
          <p v-for="e in formErrors" :key="e" class="text-red-300 text-sm">{{ e }}</p>
        </div>

        <!-- Name -->
        <div>
          <label class="block text-sm text-slate-300 mb-1">Nombre <span class="text-red-400">*</span></label>
          <input v-model="form.name" type="text" placeholder="Verificador de pedidos completados"
            class="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
        </div>

        <!-- Schedule -->
        <div>
          <label class="block text-sm text-slate-300 mb-1">
            Schedule (cron) <span class="text-red-400">*</span>
          </label>
          <input v-model="form.schedule" type="text" placeholder="*/15 * * * *"
            class="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-indigo-500" />
          <p class="text-xs text-slate-500 mt-1">Expresión cron de 5 campos: minuto hora dom mes dow</p>
        </div>

        <!-- Enabled -->
        <div class="flex items-center gap-3">
          <input id="enabled" v-model="form.enabled" type="checkbox" class="w-4 h-4 rounded accent-indigo-500" />
          <label for="enabled" class="text-sm text-slate-300 cursor-pointer">Habilitado</label>
        </div>

        <!-- Source -->
        <fieldset class="border border-slate-700 rounded-xl p-4 space-y-3">
          <legend class="text-xs font-semibold text-slate-400 px-1 uppercase tracking-wider">Fuente (source)</legend>
          <div>
            <label class="block text-sm text-slate-300 mb-1">Nombre del tool <span class="text-red-400">*</span></label>
            <input v-model="form.source.function_name" type="text" placeholder="mcp__erp__get_orders"
              class="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label class="block text-sm text-slate-300 mb-1">Parámetros (JSON)</label>
            <textarea v-model="form.source.params" rows="3" placeholder='{ "limit": 50 }'
              class="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-indigo-500 resize-none"></textarea>
          </div>
        </fieldset>

        <!-- Condition -->
        <fieldset class="border border-slate-700 rounded-xl p-4 space-y-3">
          <legend class="text-xs font-semibold text-slate-400 px-1 uppercase tracking-wider">Condición</legend>
          <div>
            <label class="block text-sm text-slate-300 mb-1">Campo <span class="text-red-400">*</span></label>
            <input v-model="form.condition.field" type="text" placeholder="element.status.name"
              class="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-indigo-500" />
            <p class="text-xs text-slate-500 mt-1">
              Ruta de campo. Usa <code class="bg-slate-800 px-1 rounded">element</code> como raíz.
              Soporta arrays: <code class="bg-slate-800 px-1 rounded">element.items[0].status</code>
            </p>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm text-slate-300 mb-1">Operador</label>
              <select v-model="form.condition.operator"
                class="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                <option v-for="op in OPERATORS" :key="op" :value="op">{{ op }}</option>
              </select>
            </div>
            <div>
              <label class="block text-sm text-slate-300 mb-1">Valor esperado</label>
              <input v-model="form.condition.value" type="text" placeholder='"Completado" o 42 o true'
                class="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
            </div>
          </div>
        </fieldset>

        <!-- Actions -->
        <fieldset class="border border-slate-700 rounded-xl p-4 space-y-4">
          <div class="flex items-center justify-between">
            <legend class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Acciones</legend>
            <button type="button" @click="addAction"
              class="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              <span class="mdi mdi-plus"></span> Agregar acción
            </button>
          </div>

          <div v-for="(action, idx) in form.action" :key="idx"
            class="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs text-slate-500">Acción {{ idx + 1 }}</span>
              <button v-if="form.action.length > 1" type="button" @click="removeAction(idx)"
                class="text-red-400 hover:text-red-300 text-xs">
                <span class="mdi mdi-trash-can-outline"></span>
              </button>
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">Nombre del tool <span class="text-red-400">*</span></label>
              <input v-model="action.function_name" type="text" placeholder="mcp__slack__send_message"
                class="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">Parámetros (JSON)</label>
              <textarea v-model="action.params" rows="3" placeholder='{ "template": "shipping_alert" }'
                class="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-indigo-500 resize-none"></textarea>
            </div>
          </div>
        </fieldset>
      </div>

      <template #footer>
        <div class="flex justify-end gap-3">
          <button @click="showModal = false"
            class="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-sm transition-colors">
            Cancelar
          </button>
          <button @click="save" :disabled="saving"
            class="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50">
            <span v-if="saving" class="mdi mdi-loading mdi-spin mr-1"></span>
            {{ editing ? 'Guardar cambios' : 'Crear listener' }}
          </button>
        </div>
      </template>
    </AppModal>
  </div>
</template>
