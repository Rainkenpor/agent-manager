<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import * as api from '@/api/api'
import AppModal from '@/components/AppModal.vue'
import { useAuthStore } from '@/store/useAuth'
import { useToastStore } from '@/store/useToast'

const auth = useAuthStore()
const toast = useToastStore()

// ── Types ─────────────────────────────────────────────────────────────────────

type AuthType = 'none' | 'bearer' | 'api_key'

interface HttpEndpoint {
	id: string
	name: string
	description?: string | null
	url: string
	method: string
	authType: AuthType
	authToken?: string | null
	apiKeyHeader?: string | null
	apiKeyValue?: string | null
	headers?: Record<string, string> | null
	bodyTemplate?: string | null
	contentType?: string | null
	schedule?: string | null
	active: boolean
	lastRunAt?: string | null
	lastRunStatus?: number | null
	lastRunResult?: string | null
	createdAt: string
	updatedAt: string
}

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const METHODS_WITHOUT_BODY = ['GET', 'DELETE']

// ── Permissions ───────────────────────────────────────────────────────────────

const canCreate = computed(() => auth.hasPermission('http_endpoints', 'create'))
const canUpdate = computed(() => auth.hasPermission('http_endpoints', 'update'))
const canDelete = computed(() => auth.hasPermission('http_endpoints', 'delete'))

// ── State ─────────────────────────────────────────────────────────────────────

const endpoints = ref<HttpEndpoint[]>([])
const loading = ref(false)

// ── Form / Modal ──────────────────────────────────────────────────────────────

const showModal = ref(false)
const editing = ref<HttpEndpoint | null>(null)
const saving = ref(false)
const formErrors = ref<string[]>([])

interface HeaderRow {
	key: string
	value: string
}

const emptyForm = () => ({
	name: '',
	description: '',
	url: '',
	method: 'POST',
	authType: 'none' as AuthType,
	authToken: '',
	apiKeyHeader: '',
	apiKeyValue: '',
	bodyTemplate: '',
	contentType: 'application/json',
	schedule: '',
	active: true
})

const form = ref(emptyForm())
const headerRows = ref<HeaderRow[]>([])

const formHasBody = computed(() => !METHODS_WITHOUT_BODY.includes(form.value.method))

function headersToRows(headers?: Record<string, string> | null): HeaderRow[] {
	if (!headers) return []
	return Object.entries(headers).map(([key, value]) => ({ key, value }))
}

function rowsToHeaders(rows: HeaderRow[]): Record<string, string> | undefined {
	const entries = rows.filter((r) => r.key.trim())
	if (entries.length === 0) return undefined
	return Object.fromEntries(entries.map((r) => [r.key.trim(), r.value]))
}

function addHeaderRow() {
	headerRows.value.push({ key: '', value: '' })
}

function removeHeaderRow(idx: number) {
	headerRows.value.splice(idx, 1)
}

function openCreate() {
	editing.value = null
	form.value = emptyForm()
	headerRows.value = []
	formErrors.value = []
	showModal.value = true
}

function openEdit(item: HttpEndpoint) {
	editing.value = item
	form.value = {
		name: item.name,
		description: item.description ?? '',
		url: item.url,
		method: item.method,
		authType: item.authType,
		authToken: item.authToken ?? '',
		apiKeyHeader: item.apiKeyHeader ?? '',
		apiKeyValue: item.apiKeyValue ?? '',
		bodyTemplate: item.bodyTemplate ?? '',
		contentType: item.contentType ?? 'application/json',
		schedule: item.schedule ?? '',
		active: item.active
	}
	headerRows.value = headersToRows(item.headers)
	formErrors.value = []
	showModal.value = true
}

async function save() {
	const errors: string[] = []
	if (!editing.value) {
		if (!form.value.name.trim()) errors.push('El nombre es requerido.')
		else if (!/^[a-z0-9_-]+$/.test(form.value.name.trim()))
			errors.push('El nombre solo admite minúsculas, números, guiones y guiones bajos.')
	}
	if (!form.value.url.trim()) errors.push('La URL es requerida.')
	if (form.value.authType === 'bearer' && !form.value.authToken.trim()) errors.push('El token Bearer es requerido.')
	if (form.value.authType === 'api_key' && (!form.value.apiKeyHeader.trim() || !form.value.apiKeyValue.trim()))
		errors.push('El header y el valor de la API Key son requeridos.')
	formErrors.value = errors
	if (errors.length > 0) return

	const payload = {
		description: form.value.description.trim() || undefined,
		url: form.value.url.trim(),
		method: form.value.method,
		authType: form.value.authType,
		authToken: form.value.authType === 'bearer' ? form.value.authToken : undefined,
		apiKeyHeader: form.value.authType === 'api_key' ? form.value.apiKeyHeader.trim() : undefined,
		apiKeyValue: form.value.authType === 'api_key' ? form.value.apiKeyValue : undefined,
		headers: rowsToHeaders(headerRows.value),
		bodyTemplate: formHasBody.value && form.value.bodyTemplate.trim() ? form.value.bodyTemplate : undefined,
		contentType: form.value.contentType.trim() || undefined,
		schedule: form.value.schedule.trim() || undefined,
		active: form.value.active
	}

	saving.value = true
	try {
		if (editing.value) {
			const res = await api.updateHttpEndpoint(editing.value.id, payload)
			if (!res.success) throw new Error((res as any).error)
			toast.success('Endpoint actualizado')
		} else {
			const res = await api.createHttpEndpoint({ name: form.value.name.trim(), ...payload })
			if (!res.success) throw new Error((res as any).error)
			toast.success('Endpoint creado')
		}
		showModal.value = false
		await fetchEndpoints()
	} catch (e: any) {
		toast.error(e.message || 'Error al guardar')
	} finally {
		saving.value = false
	}
}

// ── Delete / Toggle ───────────────────────────────────────────────────────────

const deleting = ref<string | null>(null)

async function remove(item: HttpEndpoint) {
	if (!confirm(`¿Eliminar el endpoint "${item.name}"?`)) return
	deleting.value = item.id
	try {
		await api.deleteHttpEndpoint(item.id)
		toast.success('Endpoint eliminado')
		await fetchEndpoints()
	} catch (e: any) {
		toast.error(e.message || 'Error al eliminar')
	} finally {
		deleting.value = null
	}
}

async function toggleActive(item: HttpEndpoint) {
	try {
		await api.updateHttpEndpoint(item.id, { active: !item.active })
		toast.success(item.active ? 'Endpoint desactivado' : 'Endpoint activado')
		await fetchEndpoints()
	} catch (e: any) {
		toast.error(e.message || 'Error')
	}
}

// ── Execute ─────────────────────────────────────────────────────────────────

const showExecModal = ref(false)
const execTarget = ref<HttpEndpoint | null>(null)
const execBody = ref('')
const executing = ref(false)
const execResult = ref<{ status: number; ok: boolean; body: string } | null>(null)

function openExec(item: HttpEndpoint) {
	execTarget.value = item
	execBody.value = item.bodyTemplate ?? ''
	execResult.value = null
	showExecModal.value = true
}

const execHasBody = computed(() => execTarget.value && !METHODS_WITHOUT_BODY.includes(execTarget.value.method))

async function runExec() {
	if (!execTarget.value) return
	executing.value = true
	execResult.value = null
	try {
		const override = execHasBody.value ? execBody.value : undefined
		const res = await api.executeHttpEndpoint(execTarget.value.id, override)
		execResult.value = res.data
		if (res.data.ok) toast.success(`Respuesta ${res.data.status}`)
		else toast.error(`Respuesta ${res.data.status || 'sin conexión'}`)
		await fetchEndpoints()
	} catch (e: any) {
		toast.error(e.message || 'Error al ejecutar')
	} finally {
		executing.value = false
	}
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function authLabel(item: HttpEndpoint): string {
	if (item.authType === 'bearer') return 'Bearer'
	if (item.authType === 'api_key') return `API Key (${item.apiKeyHeader})`
	return 'Sin auth'
}

function statusClass(status?: number | null): string {
	if (status == null) return 'text-red-300'
	if (status >= 200 && status < 300) return 'text-emerald-300'
	if (status >= 400) return 'text-red-300'
	return 'text-amber-300'
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchEndpoints() {
	loading.value = true
	try {
		const res = await api.getHttpEndpoints()
		endpoints.value = res.data ?? []
	} catch (e: any) {
		toast.error(e.message || 'Error al cargar endpoints')
	} finally {
		loading.value = false
	}
}

onMounted(fetchEndpoints)
</script>

<template>
  <div class="p-6 text-base-content min-h-full">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-base-content">Endpoints HTTP</h1>
        <p class="text-base-content/60 text-sm mt-1">
          Endpoints externos que el sistema invoca enviándoles datos. Ejecútalos manualmente o prográmalos con cron.
        </p>
      </div>
      <button v-if="canCreate" @click="openCreate"
        class="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors">
        <span class="mdi mdi-plus"></span> Nuevo Endpoint
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center gap-3 text-base-content/60 py-12 justify-center">
      <span class="mdi mdi-loading mdi-spin text-2xl"></span>
      <span>Cargando endpoints...</span>
    </div>

    <!-- Empty state -->
    <div v-else-if="endpoints.length === 0" class="flex flex-col items-center gap-4 py-16 text-base-content/50">
      <span class="mdi mdi-cloud-upload-outline text-5xl"></span>
      <p class="text-lg">No hay endpoints registrados.</p>
      <button v-if="canCreate" @click="openCreate" class="text-indigo-400 hover:text-indigo-300 text-sm">
        Crear el primero
      </button>
    </div>

    <!-- List -->
    <div v-else class="space-y-3">
      <div v-for="item in endpoints" :key="item.id" class="bg-base-300 border border-base-300/60 rounded-xl p-5">
        <div class="flex items-start justify-between gap-4">
          <!-- Info left -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-3 mb-1">
              <span class="w-2 h-2 rounded-full shrink-0" :class="item.active ? 'bg-emerald-400' : 'bg-base-100'"></span>
              <h3 class="font-semibold text-base-content truncate">{{ item.name }}</h3>
              <span class="text-xs font-mono bg-base-200 text-base-content px-2 py-0.5 rounded">{{ item.method }}</span>
              <span v-if="item.schedule" :title="`Cron: ${item.schedule}`"
                class="mdi mdi-clock-outline text-indigo-300 text-sm"></span>
            </div>
            <p v-if="item.description" class="text-sm text-base-content/60 mb-1 truncate">{{ item.description }}</p>

            <!-- chips -->
            <div class="flex flex-wrap gap-2 mt-2 text-xs">
              <span class="bg-base-200 text-base-content/70 px-2 py-0.5 rounded">{{ authLabel(item) }}</span>
              <span v-if="item.schedule" class="bg-indigo-500/10 text-indigo-300 ring-1 ring-indigo-500/20 px-2 py-0.5 rounded font-mono">
                {{ item.schedule }}
              </span>
            </div>

            <!-- URL -->
            <div class="mt-3 text-xs">
              <code class="bg-base-200 px-2 py-1 rounded text-base-content/80 break-all">{{ item.url }}</code>
            </div>

            <!-- Last run -->
            <div v-if="item.lastRunAt" class="mt-2 text-xs text-base-content/50 flex items-center gap-2">
              <span>Última corrida:</span>
              <span class="font-mono" :class="statusClass(item.lastRunStatus)">{{ item.lastRunStatus ?? 'error' }}</span>
              <span>·</span>
              <span>{{ new Date(item.lastRunAt).toLocaleString() }}</span>
            </div>
          </div>

          <!-- Actions right -->
          <div class="flex items-center gap-2 shrink-0">
            <button v-if="canUpdate" @click="openExec(item)" title="Ejecutar"
              class="p-1.5 rounded-lg text-indigo-300 hover:bg-indigo-500/10 transition-colors">
              <span class="mdi mdi-play text-lg"></span>
            </button>
            <button v-if="canUpdate" @click="toggleActive(item)" :title="item.active ? 'Desactivar' : 'Activar'"
              class="p-1.5 rounded-lg transition-colors"
              :class="item.active ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-base-content/50 hover:bg-base-100'">
              <span class="mdi text-lg" :class="item.active ? 'mdi-toggle-switch' : 'mdi-toggle-switch-off-outline'"></span>
            </button>
            <button v-if="canUpdate" @click="openEdit(item)" title="Editar"
              class="p-1.5 rounded-lg text-base-content/60 hover:text-base-content hover:bg-base-100 transition-colors">
              <span class="mdi mdi-pencil-outline text-lg"></span>
            </button>
            <button v-if="canDelete" @click="remove(item)" :disabled="deleting === item.id" title="Eliminar"
              class="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40">
              <span class="mdi text-lg"
                :class="deleting === item.id ? 'mdi-loading mdi-spin' : 'mdi-trash-can-outline'"></span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Create/Edit Modal ──────────────────────────────────────────────── -->
    <AppModal v-if="showModal" size="2xl" :title="editing ? 'Editar Endpoint' : 'Nuevo Endpoint'" @close="showModal = false">
      <div class="px-6 py-5 space-y-5">
        <!-- Errors -->
        <div v-if="formErrors.length > 0" class="bg-red-500/10 border border-red-500/30 rounded-lg p-3 space-y-1">
          <p v-for="e in formErrors" :key="e" class="text-red-300 text-sm">{{ e }}</p>
        </div>

        <!-- Name + method -->
        <div class="grid grid-cols-3 gap-3">
          <div class="col-span-2">
            <label class="block text-sm text-base-content mb-1">Nombre <span class="text-red-400">*</span></label>
            <input v-model="form.name" type="text" placeholder="notificar-erp" :disabled="!!editing"
              class="w-full bg-base-200 border border-base-content/20 rounded-lg px-3 py-2 text-base-content font-mono text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50" />
            <p class="text-xs text-base-content/50 mt-1">Identificador. Solo minúsculas, números, - y _</p>
          </div>
          <div>
            <label class="block text-sm text-base-content mb-1">Método HTTP</label>
            <select v-model="form.method"
              class="w-full bg-base-200 border border-base-content/20 rounded-lg px-3 py-2 text-base-content text-sm focus:outline-none focus:border-indigo-500">
              <option v-for="m in METHODS" :key="m" :value="m">{{ m }}</option>
            </select>
          </div>
        </div>

        <!-- URL -->
        <div>
          <label class="block text-sm text-base-content mb-1">URL <span class="text-red-400">*</span></label>
          <input v-model="form.url" type="text" placeholder="https://api.ejemplo.com/eventos"
            class="w-full bg-base-200 border border-base-content/20 rounded-lg px-3 py-2 text-base-content font-mono text-sm focus:outline-none focus:border-indigo-500" />
        </div>

        <!-- Description -->
        <div>
          <label class="block text-sm text-base-content mb-1">Descripción</label>
          <input v-model="form.description" type="text" placeholder="Notifica al ERP cuando ocurre un evento"
            class="w-full bg-base-200 border border-base-content/20 rounded-lg px-3 py-2 text-base-content text-sm focus:outline-none focus:border-indigo-500" />
        </div>

        <!-- Auth -->
        <fieldset class="border border-base-300 rounded-xl p-4 space-y-3">
          <legend class="text-xs font-semibold text-base-content/60 px-1 uppercase tracking-wider">Autenticación</legend>
          <select v-model="form.authType"
            class="w-full bg-base-200 border border-base-content/20 rounded-lg px-3 py-2 text-base-content text-sm focus:outline-none focus:border-indigo-500">
            <option value="none">Sin autenticación</option>
            <option value="bearer">Bearer token</option>
            <option value="api_key">API Key (header)</option>
          </select>
          <div v-if="form.authType === 'bearer'">
            <label class="block text-sm text-base-content mb-1">Token</label>
            <input v-model="form.authToken" type="text" placeholder="eyJhbGciOi..."
              class="w-full bg-base-200 border border-base-content/20 rounded-lg px-3 py-2 text-base-content font-mono text-sm focus:outline-none focus:border-indigo-500" />
            <p class="text-xs text-base-content/50 mt-1">Se enviará como <code class="bg-base-200 px-1 rounded">Authorization: Bearer …</code></p>
          </div>
          <div v-else-if="form.authType === 'api_key'" class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm text-base-content mb-1">Nombre del header</label>
              <input v-model="form.apiKeyHeader" type="text" placeholder="X-API-Key"
                class="w-full bg-base-200 border border-base-content/20 rounded-lg px-3 py-2 text-base-content font-mono text-sm focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label class="block text-sm text-base-content mb-1">Valor</label>
              <input v-model="form.apiKeyValue" type="text" placeholder="abc123"
                class="w-full bg-base-200 border border-base-content/20 rounded-lg px-3 py-2 text-base-content font-mono text-sm focus:outline-none focus:border-indigo-500" />
            </div>
          </div>
        </fieldset>

        <!-- Custom headers -->
        <fieldset class="border border-base-300 rounded-xl p-4 space-y-2">
          <legend class="text-xs font-semibold text-base-content/60 px-1 uppercase tracking-wider">Headers personalizados</legend>
          <div v-for="(row, idx) in headerRows" :key="idx" class="flex items-center gap-2">
            <input v-model="row.key" type="text" placeholder="Header"
              class="flex-1 bg-base-200 border border-base-content/20 rounded-lg px-3 py-2 text-base-content font-mono text-sm focus:outline-none focus:border-indigo-500" />
            <input v-model="row.value" type="text" placeholder="Valor"
              class="flex-1 bg-base-200 border border-base-content/20 rounded-lg px-3 py-2 text-base-content font-mono text-sm focus:outline-none focus:border-indigo-500" />
            <button type="button" @click="removeHeaderRow(idx)"
              class="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors">
              <span class="mdi mdi-close"></span>
            </button>
          </div>
          <button type="button" @click="addHeaderRow"
            class="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
            <span class="mdi mdi-plus"></span> Agregar header
          </button>
        </fieldset>

        <!-- Body template -->
        <div v-if="formHasBody">
          <label class="block text-sm text-base-content mb-1">Body (plantilla)</label>
          <textarea v-model="form.bodyTemplate" rows="4" placeholder='{ "evento": "nuevo" }'
            class="w-full bg-base-200 border border-base-content/20 rounded-lg px-3 py-2 text-base-content font-mono text-sm focus:outline-none focus:border-indigo-500"></textarea>
          <p class="text-xs text-base-content/50 mt-1">Se envía en cada ejecución; puedes sobrescribirlo al ejecutar manualmente.</p>
        </div>

        <!-- Content type + schedule -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm text-base-content mb-1">Content-Type</label>
            <input v-model="form.contentType" type="text" placeholder="application/json"
              class="w-full bg-base-200 border border-base-content/20 rounded-lg px-3 py-2 text-base-content font-mono text-sm focus:outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label class="block text-sm text-base-content mb-1">Cron (opcional)</label>
            <input v-model="form.schedule" type="text" placeholder="*/15 * * * *"
              class="w-full bg-base-200 border border-base-content/20 rounded-lg px-3 py-2 text-base-content font-mono text-sm focus:outline-none focus:border-indigo-500" />
            <p class="text-xs text-base-content/50 mt-1">5 campos. Vacío = solo manual.</p>
          </div>
        </div>

        <!-- Active -->
        <div class="flex items-center gap-3">
          <input id="ep-active" v-model="form.active" type="checkbox" class="w-4 h-4 rounded accent-indigo-500" />
          <label for="ep-active" class="text-sm text-base-content cursor-pointer">Activo</label>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-3">
          <button @click="showModal = false"
            class="px-4 py-2 rounded-lg text-base-content/60 hover:text-base-content hover:bg-base-200 text-sm transition-colors">
            Cancelar
          </button>
          <button @click="save" :disabled="saving"
            class="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50">
            <span v-if="saving" class="mdi mdi-loading mdi-spin mr-1"></span>
            {{ editing ? 'Guardar cambios' : 'Crear endpoint' }}
          </button>
        </div>
      </template>
    </AppModal>

    <!-- ── Execute Modal ──────────────────────────────────────────────────── -->
    <AppModal v-if="showExecModal" size="2xl" :title="`Ejecutar: ${execTarget?.name}`" @close="showExecModal = false">
      <div class="px-6 py-5 space-y-4">
        <div class="text-xs text-base-content/60">
          <span class="font-mono bg-base-200 px-2 py-0.5 rounded">{{ execTarget?.method }}</span>
          <code class="ml-2 break-all">{{ execTarget?.url }}</code>
        </div>

        <div v-if="execHasBody">
          <label class="block text-sm text-base-content mb-1">Body a enviar</label>
          <textarea v-model="execBody" rows="5"
            class="w-full bg-base-200 border border-base-content/20 rounded-lg px-3 py-2 text-base-content font-mono text-sm focus:outline-none focus:border-indigo-500"></textarea>
        </div>

        <div v-if="execResult" class="space-y-2">
          <div class="flex items-center gap-2 text-sm">
            <span class="text-base-content/60">Respuesta:</span>
            <span class="font-mono font-semibold" :class="statusClass(execResult.status || null)">
              {{ execResult.status || 'sin conexión' }}
            </span>
          </div>
          <pre class="bg-base-200 rounded-lg p-3 text-xs text-base-content/80 overflow-auto max-h-72 whitespace-pre-wrap break-all">{{ execResult.body }}</pre>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-3">
          <button @click="showExecModal = false"
            class="px-4 py-2 rounded-lg text-base-content/60 hover:text-base-content hover:bg-base-200 text-sm transition-colors">
            Cerrar
          </button>
          <button @click="runExec" :disabled="executing"
            class="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50">
            <span v-if="executing" class="mdi mdi-loading mdi-spin mr-1"></span>
            <span v-else class="mdi mdi-play mr-1"></span>
            Ejecutar
          </button>
        </div>
      </template>
    </AppModal>
  </div>
</template>
