<script setup lang="ts">
import { reactive, ref } from 'vue'
import type { ProviderConfigSummary, ProviderSampling, SamplingMode, SamplingParams } from '@/api/api'
import * as api from '@/api/api'
import AppModal from '@/components/AppModal.vue'

const props = defineProps<{ provider?: ProviderConfigSummary | null }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const isEdit = Boolean(props.provider)
const saving = ref(false)
const error = ref('')

const form = reactive({
	provider: props.provider?.provider ?? '',
	label: props.provider?.label ?? '',
	baseURL: props.provider?.baseURL ?? '',
	apiKey: '',
	model: props.provider?.model ?? ''
})

// ── Parámetros de generación ────────────────────────────────────────────────
// Se administran aquí, no en cada agente. Cada modo es una lista editable de
// pares clave/valor para admitir parámetros que no conocemos de antemano.
const DEFAULT_SAMPLING: ProviderSampling = {
	defaultMode: 'instruct',
	thinking: { temperature: 1.0, top_p: 0.95, top_k: 20, min_p: 0.0, presence_penalty: 0.0, repetition_penalty: 1.0 },
	instruct: { temperature: 0.7, top_p: 0.8, top_k: 20, min_p: 0.0, presence_penalty: 1.5, repetition_penalty: 1.0 }
}

const MODES: Array<{ key: SamplingMode; label: string; hint: string }> = [
	{ key: 'thinking', label: 'Thinking', hint: 'Razonamiento paso a paso' },
	{ key: 'instruct', label: 'Instruct', hint: 'Respuesta directa (no-thinking)' }
]

type ParamRow = { key: string; value: string }

const source = props.provider?.sampling ?? DEFAULT_SAMPLING
const defaultMode = ref<SamplingMode>(source.defaultMode ?? 'instruct')
const activeTab = ref<SamplingMode>(defaultMode.value)

const params = reactive<Record<SamplingMode, ParamRow[]>>({
	thinking: toRows(source.thinking),
	instruct: toRows(source.instruct)
})

function toRows(obj: SamplingParams | undefined): ParamRow[] {
	return Object.entries(obj ?? {}).map(([key, value]) => ({ key, value: String(value) }))
}

/** Los valores numéricos se envían como número; el resto tal cual (algunos modelos usan strings). */
function toParams(rows: ParamRow[]): SamplingParams {
	const out: SamplingParams = {}
	for (const row of rows) {
		const key = row.key.trim()
		if (!key) continue
		const raw = row.value.trim()
		if (raw === 'true' || raw === 'false') out[key] = raw === 'true'
		else if (raw !== '' && !Number.isNaN(Number(raw))) out[key] = Number(raw)
		else out[key] = raw
	}
	return out
}

function addParam(mode: SamplingMode) {
	params[mode].push({ key: '', value: '' })
}

function removeParam(mode: SamplingMode, index: number) {
	params[mode].splice(index, 1)
}

async function submit() {
	saving.value = true
	error.value = ''
	try {
		await api.saveApiProvider({
			provider: form.provider.trim(),
			label: form.label.trim(),
			baseURL: form.baseURL.trim(),
			model: form.model.trim(),
			...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}),
			sampling: {
				defaultMode: defaultMode.value,
				thinking: toParams(params.thinking),
				instruct: toParams(params.instruct)
			}
		})
		emit('saved')
		emit('close')
	} catch (e: any) {
		error.value = e.message
	} finally {
		saving.value = false
	}
}
</script>

<template>
  <AppModal :title="isEdit ? 'Editar provider' : 'Agregar provider por API'" size="lg" persistent @close="emit('close')">
    <form class="space-y-4" @submit.prevent="submit">
      <div v-if="error" class="px-3 py-2 rounded-lg bg-red-900/40 border border-red-700/50 text-red-400 text-sm">
        {{ error }}
      </div>

      <div class="grid sm:grid-cols-2 gap-3">
        <label class="text-xs text-base-content/60">
          Identificador
          <input v-model.trim="form.provider" required :disabled="isEdit" placeholder="ej. azure-gpt4o"
            class="mt-1 w-full px-3 py-2 rounded-lg bg-base-100 border border-base-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed" />
        </label>
        <label class="text-xs text-base-content/60">
          Nombre visible
          <input v-model.trim="form.label" required placeholder="ej. Azure GPT-4o"
            class="mt-1 w-full px-3 py-2 rounded-lg bg-base-100 border border-base-300 text-sm" />
        </label>
      </div>

      <label class="text-xs text-base-content/60 block">
        Base URL (OpenAI-compatible)
        <input v-model.trim="form.baseURL" required type="url" placeholder="https://api.openai.com/v1"
          class="mt-1 w-full px-3 py-2 rounded-lg bg-base-100 border border-base-300 text-sm" />
      </label>

      <div class="grid sm:grid-cols-2 gap-3">
        <label class="text-xs text-base-content/60">
          API Key <span class="text-base-content/40">(opcional)</span>
          <input v-model.trim="form.apiKey" type="password"
            :placeholder="isEdit ? '(sin cambios)' : 'Dejar vacío si no requiere'"
            class="mt-1 w-full px-3 py-2 rounded-lg bg-base-100 border border-base-300 text-sm" />
        </label>
        <label class="text-xs text-base-content/60">
          Modelo
          <input v-model.trim="form.model" required placeholder="gpt-4o"
            class="mt-1 w-full px-3 py-2 rounded-lg bg-base-100 border border-base-300 text-sm" />
        </label>
      </div>

      <!-- Parámetros de generación: se definen aquí para todos los agentes -->
      <div class="pt-4 border-t border-base-300 space-y-3">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm font-medium text-base-content">Parámetros de generación</p>
            <p class="text-xs text-base-content/50 mt-0.5">
              Aplican a todos los agentes que usen este provider. Se envían tal cual al modelo.
            </p>
            <p v-if="isEdit && !props.provider?.isActive"
              class="mt-2 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-xs text-amber-600">
              <i class="mdi mdi-alert-outline mr-1" />
              Este provider no está activo: se guardan, pero no se usarán hasta que lo marques como activo.
            </p>
          </div>
          <label class="text-xs text-base-content/60 shrink-0">
            Modo por defecto
            <select v-model="defaultMode"
              class="mt-1 w-full px-2 py-1.5 rounded-lg bg-base-100 border border-base-300 text-sm">
              <option v-for="m in MODES" :key="m.key" :value="m.key">{{ m.label }}</option>
            </select>
          </label>
        </div>

        <div class="flex gap-1 p-1 rounded-xl bg-base-100 border border-base-300">
          <button v-for="m in MODES" :key="m.key" type="button" @click="activeTab = m.key"
            class="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            :class="activeTab === m.key ? 'bg-indigo-600 text-white' : 'text-base-content/60 hover:text-base-content'">
            {{ m.label }}
            <span class="block text-[10px] font-normal opacity-70">{{ m.hint }}</span>
          </button>
        </div>

        <!-- Un solo panel: se dibuja el modo activo. La clave incluye el modo para que los
             inputs se recreen al cambiar de pestaña y no arrastren el valor anterior. -->
        <div class="space-y-2">
          <div v-for="(row, i) in params[activeTab]" :key="`${activeTab}-${i}`" class="flex items-center gap-2">
            <input v-model.trim="row.key" placeholder="parámetro (ej. top_k)"
              class="flex-1 px-3 py-1.5 rounded-lg bg-base-100 border border-base-300 text-xs font-mono" />
            <input v-model.trim="row.value" placeholder="valor"
              class="w-32 px-3 py-1.5 rounded-lg bg-base-100 border border-base-300 text-xs font-mono" />
            <button type="button" @click="removeParam(activeTab, i)"
              class="shrink-0 w-7 h-7 rounded-lg text-base-content/40 hover:text-red-400 hover:bg-base-100 transition-colors"
              title="Quitar parámetro">
              <i class="mdi mdi-close" />
            </button>
          </div>
          <button type="button" @click="addParam(activeTab)"
            class="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
            + Agregar parámetro
          </button>
        </div>
      </div>
    </form>

    <template #footer>
      <div class="flex gap-3">
        <button type="button" @click="emit('close')"
          class="flex-1 py-2.5 text-sm rounded-xl bg-base-200 hover:bg-base-100 text-base-content font-medium transition-colors">
          Cancelar
        </button>
        <button type="button" @click="submit" :disabled="saving"
          class="flex-1 py-2.5 text-sm rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium transition-colors">
          {{ saving ? 'Guardando...' : 'Guardar provider' }}
        </button>
      </div>
    </template>
  </AppModal>
</template>
