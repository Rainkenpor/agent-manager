<template>
  <PageLayout title="Providers de LLM"
    description="Configura uno o más providers (Codex u OpenAI-compatible por API) y marca cuál usa el agente. Las credenciales se guardan cifradas en base de datos.">
    <template #actions>
      <button @click="loadProviders" :disabled="loading"
        class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-base-200 hover:bg-base-100 disabled:text-base-content/50">
        <i class="mdi mdi-reload mr-1" :class="{ 'animate-spin': loading }"></i>
        Recargar
      </button>
    </template>

    <div v-if="message"
      class="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 text-sm">
      <i class="mdi mdi-check-circle mr-2"></i>{{ message }}
    </div>

    <div v-if="error" class="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
      <i class="mdi mdi-alert-circle mr-2"></i>{{ error }}
    </div>

    <div v-if="authUrl" class="mb-4 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
      <p class="text-sm text-indigo-200 mb-2">Enlace de autenticación generado:</p>
      <a :href="authUrl" target="_blank" rel="noopener noreferrer"
        class="text-sm break-all text-indigo-300 hover:text-indigo-200 underline">{{ authUrl }}</a>
    </div>

    <!-- ── OpenAI Codex ─────────────────────────────────────────────── -->
    <section class="mb-8">
      <h3 class="text-sm font-semibold text-base-content/70 uppercase tracking-wide mb-3">OpenAI (Codex)</h3>
      <div class="rounded-lg border p-4" :class="codex?.isActive ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-base-300 bg-base-300/40'">
        <div class="flex items-start justify-between gap-3 mb-3">
          <div>
            <p class="text-base-content font-medium">{{ codex?.label ?? 'OpenAI Codex' }}</p>
            <p class="text-xs text-base-content/50">Autenticación OAuth contra ChatGPT (codex).</p>
          </div>
          <div class="flex items-center gap-2">
            <span v-if="codex?.isActive" class="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">Activo</span>
            <span :class="['px-2 py-0.5 rounded-full border text-xs font-medium', badgeClass(codex)]">{{ badgeText(codex) }}</span>
          </div>
        </div>

        <p v-if="codex?.isActive"
          class="mb-3 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-xs text-amber-600">
          <i class="mdi mdi-information-outline mr-1" />
          Codex no admite parámetros de generación (temperature, top_p, top_k…). Para configurarlos, usa un provider por
          API y márcalo como activo.
        </p>

        <div class="grid sm:grid-cols-3 gap-2 mb-3 text-xs">
          <div><span class="text-base-content/50">Última validación:</span> {{ formatDate(codex?.lastValidatedAt ?? null) }}</div>
          <div><span class="text-base-content/50">Expira:</span> {{ formatDate(codex?.expiresAt ?? null) }}</div>
          <div><span class="text-base-content/50">Refresh token:</span> {{ codex?.hasRefreshToken ? 'Disponible' : 'No disponible' }}</div>
        </div>

        <!-- Modelo y esfuerzo de razonamiento -->
        <div v-if="codex?.configured" class="mb-3 pt-3 border-t border-base-300">
          <div class="flex items-center justify-between mb-2">
            <p class="text-xs font-semibold text-base-content/70 uppercase tracking-wide">Modelo y razonamiento</p>
            <button @click="loadModels(true)" :disabled="modelsLoading"
              class="text-xs text-base-content/60 hover:text-base-content disabled:text-base-content/30">
              <i class="mdi mdi-reload mr-1" :class="{ 'animate-spin': modelsLoading }"></i>Recargar catálogo
            </button>
          </div>

          <p v-if="modelsError" class="mb-2 text-xs text-amber-500">
            <i class="mdi mdi-alert-outline mr-1"></i>{{ modelsError }}
          </p>

          <div class="grid sm:grid-cols-2 gap-3">
            <label class="block">
              <span class="block text-xs text-base-content/50 mb-1">Modelo</span>
              <select v-model="selectedModel" :disabled="modelsLoading || !models.length"
                class="w-full px-3 py-2 rounded-lg bg-base-100 border border-base-300 text-sm disabled:text-base-content/40">
                <option value="">{{ modelsLoading ? 'Cargando…' : 'Sin seleccionar' }}</option>
                <option v-for="m in models" :key="m.slug" :value="m.slug">{{ m.displayName }}</option>
              </select>
            </label>

            <label class="block">
              <span class="block text-xs text-base-content/50 mb-1">Esfuerzo de razonamiento</span>
              <select v-model="selectedEffort" :disabled="!availableEfforts.length"
                class="w-full px-3 py-2 rounded-lg bg-base-100 border border-base-300 text-sm disabled:text-base-content/40">
                <option v-for="e in availableEfforts" :key="e.effort" :value="e.effort">{{ e.effort }} — {{ e.description }}</option>
              </select>
            </label>
          </div>

          <p v-if="activeModel?.description" class="mt-2 text-xs text-base-content/50">{{ activeModel.description }}</p>
          <p v-if="activeModel?.contextWindow" class="mt-1 text-xs text-base-content/40">
            Ventana de contexto: {{ activeModel.contextWindow.toLocaleString() }} tokens
          </p>

          <button @click="saveModel" :disabled="busy || !selectedModel || !modelChanged"
            class="mt-3 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-indigo-600 hover:bg-indigo-500 disabled:bg-base-200 disabled:text-base-content/50">
            <i class="mdi mdi-content-save-outline mr-1"></i>Guardar modelo
          </button>
        </div>

        <div class="flex flex-wrap gap-2">
          <button @click="connectOpenAI" :disabled="busy"
            class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-indigo-600 hover:bg-indigo-500 disabled:bg-base-200 disabled:text-base-content/50">
            <i class="mdi mdi-open-in-new mr-1"></i>{{ codex?.configured ? 'Reconectar' : 'Conectar' }}
          </button>
          <button @click="refreshOpenAI" :disabled="busy || !codex?.configured"
            class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-base-200 hover:bg-base-100 disabled:text-base-content/50">
            <i class="mdi mdi-refresh mr-1" :class="{ 'animate-spin': busy }"></i>Validar / refrescar
          </button>
          <button v-if="codex?.configured && !codex.isActive" @click="activate(codex.provider)" :disabled="busy"
            class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-emerald-600 hover:bg-emerald-500 disabled:text-base-content/50">
            <i class="mdi mdi-check mr-1"></i>Marcar como activo
          </button>
          <button v-if="codex?.configured" @click="remove(codex.provider, codex.label)" :disabled="busy"
            class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 disabled:text-base-content/50">
            <i class="mdi mdi-delete-outline mr-1"></i>Eliminar
          </button>
        </div>
      </div>
    </section>

    <!-- ── Providers por API ────────────────────────────────────────── -->
    <section class="mb-8">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold text-base-content/70 uppercase tracking-wide">Providers por API</h3>
        <button @click="openCreate"
          class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-indigo-600 hover:bg-indigo-500">
          <i class="mdi mdi-plus mr-1"></i>Agregar provider
        </button>
      </div>

      <p v-if="!apiProviders.length" class="text-sm text-base-content/50 mb-3">No hay providers por API configurados.</p>

      <div v-for="p in apiProviders" :key="p.provider"
        class="rounded-lg border p-4 mb-3" :class="p.isActive ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-base-300 bg-base-300/40'">
        <div class="flex items-start justify-between gap-3 mb-3">
          <div>
            <p class="text-base-content font-medium">{{ p.label }}</p>
            <p class="text-xs text-base-content/50 break-all">{{ p.baseURL }} · modelo {{ p.model }}</p>
          </div>
          <span v-if="p.isActive" class="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">Activo</span>
        </div>
        <div class="flex flex-wrap gap-2">
          <button v-if="!p.isActive" @click="activate(p.provider)" :disabled="busy"
            class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-emerald-600 hover:bg-emerald-500 disabled:text-base-content/50">
            <i class="mdi mdi-check mr-1"></i>Marcar como activo
          </button>
          <button @click="openEdit(p)" :disabled="busy"
            class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-base-200 hover:bg-base-100 disabled:text-base-content/50">
            <i class="mdi mdi-pencil-outline mr-1"></i>Editar
          </button>
          <button @click="remove(p.provider, p.label)" :disabled="busy"
            class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 disabled:text-base-content/50">
            <i class="mdi mdi-delete-outline mr-1"></i>Eliminar
          </button>
        </div>
      </div>
    </section>

    <ProviderFormModal v-if="modalOpen" :provider="editing" @close="modalOpen = false" @saved="onSaved" />
  </PageLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { CodexModel, ProviderConfigSummary } from '@/api/api'
import * as api from '@/api/api'
import PageLayout from '@/components/PageLayout.vue'
import ProviderFormModal from '@/components/ProviderFormModal.vue'

const route = useRoute()
const router = useRouter()

const providers = ref<ProviderConfigSummary[]>([])
const loading = ref(false)
const busy = ref(false)
const error = ref('')
const message = ref('')
const authUrl = ref('')

const modalOpen = ref(false)
const editing = ref<ProviderConfigSummary | null>(null)

const codex = computed(() => providers.value.find((p) => p.type === 'codex'))
const apiProviders = computed(() => providers.value.filter((p) => p.type === 'api'))

const models = ref<CodexModel[]>([])
const modelsLoading = ref(false)
const modelsError = ref('')
const selectedModel = ref('')
const selectedEffort = ref('')

const activeModel = computed(() => models.value.find((m) => m.slug === selectedModel.value) ?? null)
const availableEfforts = computed(() => activeModel.value?.efforts ?? [])
const modelChanged = computed(
	() => selectedModel.value !== (codex.value?.model ?? '') || selectedEffort.value !== (codex.value?.reasoningEffort ?? '')
)

// Al cambiar de modelo el esfuerzo guardado puede no existir en el nuevo; se cae al que el modelo declara por defecto.
watch(activeModel, (model) => {
	if (!model) return
	if (model.efforts.some((e) => e.effort === selectedEffort.value)) return
	selectedEffort.value = model.defaultEffort ?? model.efforts[0]?.effort ?? ''
})

function formatDate(value: string | null) {
	if (!value) return 'N/D'
	return new Date(value).toLocaleString()
}

function badgeClass(p?: ProviderConfigSummary) {
	if (!p?.configured) return 'bg-base-200 text-base-content border-base-300'
	if (p.needsRefresh) return 'bg-amber-500/10 text-amber-300 border-amber-500/30'
	return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
}

function badgeText(p?: ProviderConfigSummary) {
	if (!p?.configured) return 'No configurado'
	return p.needsRefresh ? 'Requiere refresh' : 'Conectado'
}

async function loadProviders() {
	loading.value = true
	error.value = ''
	try {
		const res = await api.listProviders()
		providers.value = res.data
		selectedModel.value = codex.value?.model ?? ''
		selectedEffort.value = codex.value?.reasoningEffort ?? ''
		if (codex.value?.configured) await loadModels()
	} catch (err: any) {
		error.value = err.message
	} finally {
		loading.value = false
	}
}

async function loadModels(force = false) {
	if (models.value.length && !force) return
	modelsLoading.value = true
	modelsError.value = ''
	try {
		const res = await api.listCodexModels()
		models.value = res.data
	} catch (err: any) {
		modelsError.value = `No fue posible cargar el catálogo de modelos: ${err.message}`
	} finally {
		modelsLoading.value = false
	}
}

async function saveModel() {
	const provider = codex.value?.provider
	if (!provider) return
	busy.value = true
	error.value = ''
	message.value = ''
	try {
		await api.updateProviderModel(provider, selectedModel.value, selectedEffort.value || null)
		message.value = `Modelo guardado: ${selectedModel.value}${selectedEffort.value ? ` (esfuerzo ${selectedEffort.value})` : ''}.`
		await loadProviders()
	} catch (err: any) {
		error.value = err.message
	} finally {
		busy.value = false
	}
}

async function connectOpenAI() {
	busy.value = true
	error.value = ''
	message.value = ''
	try {
		const returnTo = `${window.location.origin}/config`
		const res = await api.startOpenAIProviderAuth(returnTo)
		authUrl.value = res.data.authUrl
		message.value = 'Abre el enlace para completar la autenticación de OpenAI.'
	} catch (err: any) {
		error.value = err.message
		authUrl.value = ''
	} finally {
		busy.value = false
	}
}

async function refreshOpenAI() {
	busy.value = true
	error.value = ''
	message.value = ''
	try {
		await api.refreshOpenAIProviderToken()
		message.value = 'Token de OpenAI validado correctamente.'
		await loadProviders()
	} catch (err: any) {
		error.value = err.message
	} finally {
		busy.value = false
	}
}

async function activate(provider: string) {
	busy.value = true
	error.value = ''
	message.value = ''
	try {
		await api.activateProvider(provider)
		message.value = `Provider activo: ${provider}.`
		await loadProviders()
	} catch (err: any) {
		error.value = err.message
	} finally {
		busy.value = false
	}
}

async function remove(provider: string, label: string) {
	if (!window.confirm(`Se eliminará la configuración del provider "${label}".`)) return
	busy.value = true
	error.value = ''
	message.value = ''
	try {
		await api.deleteProvider(provider)
		if (provider === codex.value?.provider) authUrl.value = ''
		message.value = `Provider "${label}" eliminado.`
		await loadProviders()
	} catch (err: any) {
		error.value = err.message
	} finally {
		busy.value = false
	}
}

function openCreate() {
	editing.value = null
	modalOpen.value = true
}

function openEdit(provider: ProviderConfigSummary) {
	editing.value = provider
	modalOpen.value = true
}

async function onSaved() {
	message.value = 'Provider guardado.'
	await loadProviders()
}

onMounted(async () => {
	const authResult = typeof route.query.auth === 'string' ? route.query.auth : ''
	const authMessage = typeof route.query.message === 'string' ? route.query.message : ''
	const provider = typeof route.query.provider === 'string' ? route.query.provider : ''

	if (provider === 'openai') {
		if (authResult === 'success') message.value = 'OpenAI conectado correctamente.'
		if (authResult === 'error') error.value = authMessage || 'No fue posible completar la autenticación de OpenAI.'
		await router.replace({ query: {} })
	}

	await loadProviders()
})
</script>
