<script setup lang="ts">
import { reactive, ref } from 'vue'
import type { ProviderConfigSummary } from '@/api/api'
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

async function submit() {
	saving.value = true
	error.value = ''
	try {
		await api.saveApiProvider({
			provider: form.provider.trim(),
			label: form.label.trim(),
			baseURL: form.baseURL.trim(),
			model: form.model.trim(),
			...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {})
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
