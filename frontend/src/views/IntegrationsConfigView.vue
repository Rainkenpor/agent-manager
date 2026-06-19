<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import * as api from '@/api/api'
import AppModal from '@/components/AppModal.vue'
import { useAuthStore } from '@/store/useAuth'
import { useToastStore } from '@/store/useToast'

const auth = useAuthStore()
const toast = useToastStore()

interface Integration {
	id: string
	name: string
	origin: string
	agentSlug?: string | null
	agentName?: string | null
	scope: string[]
	description?: string | null
	active: boolean
	createdAt: string
	updatedAt: string
}

interface Agent {
	id: string
	name: string
	slug: string
}

// Datos que la integración puede solicitar/declarar para el agente.
const SCOPE_OPTIONS = [
	{ key: 'name', label: 'Nombre' },
	{ key: 'email', label: 'Correo' },
	{ key: 'phone', label: 'Teléfono' },
	{ key: 'auth', label: 'Estar logueado' }
]

const canCreate = computed(() => auth.hasPermission('integrations', 'create'))
const canUpdate = computed(() => auth.hasPermission('integrations', 'update'))
const canDelete = computed(() => auth.hasPermission('integrations', 'delete'))

const integrations = ref<Integration[]>([])
const agents = ref<Agent[]>([])
const loading = ref(false)

// Base absoluta de la app (sin el sufijo /api) para construir el snippet de embebido.
// El snippet se pega en sitios externos, por lo que debe ser una URL absoluta.
const appBase = computed(() => {
	const apiBase = __API_BASE__.replace(/\/api\/?$/, '')
	if (/^https?:\/\//.test(apiBase)) return apiBase
	return window.location.origin + apiBase
})

function isConfigured(item: Integration): boolean {
	return item.active && !!item.agentSlug
}

function embedSnippet(_item: Integration): string {
	// El loader envía automáticamente el origen del sitio que lo incrusta.
	// Concatenamos la etiqueta de cierre para no terminar el bloque <script> del SFC.
	const close = '</scr' + 'ipt>'
	return `<script src="${appBase.value}/integration-embed.js" async>${close}`
}

function scopeLabel(key: string): string {
	return SCOPE_OPTIONS.find((s) => s.key === key)?.label ?? key
}

// ── Form / Modal ───────────────────────────────────────────────────────────
const showModal = ref(false)
const editing = ref<Integration | null>(null)
const saving = ref(false)
const formErrors = ref<string[]>([])

const emptyForm = () => ({
	name: '',
	origin: '',
	agentSlug: '',
	scope: [] as string[],
	description: '',
	active: true
})

const form = ref(emptyForm())

function openCreate() {
	editing.value = null
	form.value = emptyForm()
	formErrors.value = []
	showModal.value = true
}

function openEdit(item: Integration) {
	editing.value = item
	form.value = {
		name: item.name,
		origin: item.origin,
		agentSlug: item.agentSlug ?? '',
		scope: [...(item.scope ?? [])],
		description: item.description ?? '',
		active: item.active
	}
	formErrors.value = []
	showModal.value = true
}

function toggleScope(key: string) {
	const idx = form.value.scope.indexOf(key)
	if (idx === -1) form.value.scope.push(key)
	else form.value.scope.splice(idx, 1)
}

async function save() {
	const errors: string[] = []
	if (!form.value.name.trim()) errors.push('El nombre es requerido.')
	if (!form.value.origin.trim()) errors.push('El origen es requerido.')
	if (form.value.active && !form.value.agentSlug) errors.push('Asigna un agente para activar la integración.')
	formErrors.value = errors
	if (errors.length > 0) return

	const agent = agents.value.find((a) => a.slug === form.value.agentSlug)
	const payload: any = {
		name: form.value.name.trim(),
		agentSlug: form.value.agentSlug || null,
		agentName: agent?.name ?? null,
		scope: form.value.scope,
		description: form.value.description.trim() || null,
		active: form.value.active
	}

	saving.value = true
	try {
		if (editing.value) {
			const res = await api.updateIntegration(editing.value.id, payload)
			if (!res.success) throw new Error((res as any).error)
			toast.success('Integración actualizada')
		} else {
			const res = await api.createIntegration({ ...payload, origin: form.value.origin.trim() })
			if (!res.success) throw new Error((res as any).error)
			toast.success('Integración creada')
		}
		showModal.value = false
		await fetchIntegrations()
	} catch (e: any) {
		toast.error(e.message || 'Error al guardar')
	} finally {
		saving.value = false
	}
}

const deleting = ref<string | null>(null)

async function remove(item: Integration) {
	if (!confirm(`¿Eliminar la integración "${item.name}" (${item.origin})?`)) return
	deleting.value = item.id
	try {
		await api.deleteIntegration(item.id)
		toast.success('Integración eliminada')
		await fetchIntegrations()
	} catch (e: any) {
		toast.error(e.message || 'Error al eliminar')
	} finally {
		deleting.value = null
	}
}

async function toggleActive(item: Integration) {
	if (!item.active && !item.agentSlug) {
		toast.error('Asigna un agente antes de activar')
		return
	}
	try {
		await api.updateIntegration(item.id, { active: !item.active })
		toast.success(item.active ? 'Integración desactivada' : 'Integración activada')
		await fetchIntegrations()
	} catch (e: any) {
		toast.error(e.message || 'Error')
	}
}

async function copyText(text: string, label: string) {
	try {
		await navigator.clipboard.writeText(text)
		toast.success(`${label} copiado`)
	} catch {
		toast.error('No se pudo copiar')
	}
}

async function fetchIntegrations() {
	loading.value = true
	try {
		const res = await api.getIntegrations()
		integrations.value = res.data ?? []
	} catch (e: any) {
		toast.error(e.message || 'Error al cargar integraciones')
	} finally {
		loading.value = false
	}
}

onMounted(async () => {
	await fetchIntegrations()
	try {
		const agentsRes = await api.getAgents()
		agents.value = agentsRes.data ?? []
	} catch {
		/* non-critical */
	}
})
</script>

<template>
  <div class="p-6 text-base-content min-h-full">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-base-content">Integraciones</h1>
        <p class="text-base-content/60 text-sm mt-1">
          Asistente de chat embebible en sitios externos. Cada sitio se identifica por su origen; los nuevos se registran
          automáticamente al primer uso y quedan pendientes de configuración.
        </p>
      </div>
      <button v-if="canCreate" @click="openCreate"
        class="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors">
        <span class="mdi mdi-plus"></span> Nueva Integración
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center gap-3 text-base-content/60 py-12 justify-center">
      <span class="mdi mdi-loading mdi-spin text-2xl"></span>
      <span>Cargando integraciones...</span>
    </div>

    <!-- Empty -->
    <div v-else-if="integrations.length === 0" class="flex flex-col items-center gap-4 py-16 text-base-content/50">
      <span class="mdi mdi-puzzle-outline text-5xl"></span>
      <p class="text-lg">No hay integraciones registradas.</p>
      <button v-if="canCreate" @click="openCreate" class="text-indigo-400 hover:text-indigo-300 text-sm">
        Crear la primera
      </button>
    </div>

    <!-- List -->
    <div v-else class="space-y-3">
      <div v-for="item in integrations" :key="item.id" class="bg-base-300 border border-base-300/60 rounded-xl p-5">
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-3 mb-1 flex-wrap">
              <span class="w-2 h-2 rounded-full shrink-0" :class="item.active ? 'bg-emerald-400' : 'bg-base-100'"></span>
              <h3 class="font-semibold text-base-content truncate">{{ item.name }}</h3>
              <span v-if="isConfigured(item)"
                class="text-xs bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20 px-2 py-0.5 rounded">
                Configurada
              </span>
              <span v-else class="text-xs bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/20 px-2 py-0.5 rounded">
                Pendiente
              </span>
            </div>

            <div class="flex items-center gap-2 text-xs mt-1">
              <span class="mdi mdi-web text-base-content/40"></span>
              <code class="bg-base-200 px-2 py-1 rounded text-base-content/80 truncate">{{ item.origin }}</code>
            </div>

            <!-- Agent + scope -->
            <div class="flex flex-wrap gap-2 mt-2 text-xs">
              <span v-if="item.agentName"
                class="bg-indigo-500/10 text-indigo-300 ring-1 ring-indigo-500/20 px-2 py-0.5 rounded">
                <span class="mdi mdi-robot-outline mr-1"></span>{{ item.agentName }}
              </span>
              <span v-else class="text-base-content/40">Sin agente asignado</span>
              <span v-for="s in item.scope" :key="s"
                class="bg-base-200 text-base-content/70 px-2 py-0.5 rounded">{{ scopeLabel(s) }}</span>
            </div>

            <!-- Embed snippet -->
            <div class="mt-3 flex items-center gap-2 text-xs">
              <code class="bg-base-200 px-2 py-1 rounded text-base-content/80 truncate flex-1">{{ embedSnippet(item) }}</code>
              <button @click="copyText(embedSnippet(item), 'Snippet')" title="Copiar snippet de embebido"
                class="text-base-content/50 hover:text-base-content transition-colors shrink-0">
                <span class="mdi mdi-content-copy"></span>
              </button>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-2 shrink-0">
            <button v-if="canUpdate" @click="toggleActive(item)" :title="item.active ? 'Desactivar' : 'Activar'"
              class="p-1.5 rounded-lg transition-colors"
              :class="item.active ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-base-content/50 hover:bg-base-100'">
              <span class="mdi text-lg" :class="item.active ? 'mdi-toggle-switch' : 'mdi-toggle-switch-off-outline'"></span>
            </button>
            <button v-if="canUpdate" @click="openEdit(item)" title="Configurar"
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

    <!-- Modal -->
    <AppModal v-if="showModal" size="2xl" :title="editing ? 'Configurar integración' : 'Nueva integración'"
      @close="showModal = false">
      <div class="px-6 py-5 space-y-5">
        <div v-if="formErrors.length > 0" class="bg-red-500/10 border border-red-500/30 rounded-lg p-3 space-y-1">
          <p v-for="e in formErrors" :key="e" class="text-red-300 text-sm">{{ e }}</p>
        </div>

        <div>
          <label class="block text-sm text-base-content mb-1">Nombre <span class="text-red-400">*</span></label>
          <input v-model="form.name" type="text" placeholder="Sitio corporativo"
            class="w-full bg-base-200 border border-base-content/20 rounded-lg px-3 py-2 text-base-content text-sm focus:outline-none focus:border-indigo-500" />
        </div>

        <div>
          <label class="block text-sm text-base-content mb-1">Origen <span class="text-red-400">*</span></label>
          <input v-model="form.origin" type="text" placeholder="https://miweb.com" :disabled="!!editing"
            class="w-full bg-base-200 border border-base-content/20 rounded-lg px-3 py-2 text-base-content font-mono text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50" />
          <p class="text-xs text-base-content/50 mt-1">Esquema + dominio del sitio anfitrión. No editable después de crear.</p>
        </div>

        <div>
          <label class="block text-sm text-base-content mb-1">Agente</label>
          <select v-model="form.agentSlug"
            class="w-full bg-base-200 border border-base-content/20 rounded-lg px-3 py-2 text-base-content text-sm focus:outline-none focus:border-indigo-500">
            <option value="">Sin asignar</option>
            <option v-for="agent in agents" :key="agent.id" :value="agent.slug">{{ agent.name }}</option>
          </select>
        </div>

        <div>
          <label class="block text-sm text-base-content mb-2">Scope (datos solicitados)</label>
          <div class="flex flex-wrap gap-2">
            <button v-for="opt in SCOPE_OPTIONS" :key="opt.key" type="button" @click="toggleScope(opt.key)"
              class="px-3 py-1.5 rounded-lg border text-sm transition-colors"
              :class="form.scope.includes(opt.key)
                ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                : 'border-base-content/20 text-base-content/60 hover:text-base-content'">
              {{ opt.label }}
            </button>
          </div>
        </div>

        <div>
          <label class="block text-sm text-base-content mb-1">Descripción</label>
          <input v-model="form.description" type="text" placeholder="Asistente para clientes del sitio público"
            class="w-full bg-base-200 border border-base-content/20 rounded-lg px-3 py-2 text-base-content text-sm focus:outline-none focus:border-indigo-500" />
        </div>

        <div class="flex items-center gap-3">
          <input id="int-active" v-model="form.active" type="checkbox" class="w-4 h-4 rounded accent-indigo-500" />
          <label for="int-active" class="text-sm text-base-content cursor-pointer">Activa</label>
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
            {{ editing ? 'Guardar cambios' : 'Crear integración' }}
          </button>
        </div>
      </template>
    </AppModal>
  </div>
</template>
