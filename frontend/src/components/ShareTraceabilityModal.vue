<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import * as api from '@/api/api'
import AppModal from '@/components/AppModal.vue'

const props = defineProps<{
	traceabilityId: string
	excludedUserIds: string[]
}>()

const emit = defineEmits<{ close: []; saved: [userIds: string[]] }>()

interface UserOption {
	id: string
	username: string
	firstName?: string | null
	lastName?: string | null
	email?: string | null
}

const users = ref<UserOption[]>([])
const selected = ref<Set<string>>(new Set())
const loading = ref(false)
const saving = ref(false)
const error = ref('')

const available = computed(() => users.value.filter((u) => !props.excludedUserIds.includes(u.id)))

function displayName(u: UserOption) {
	return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username
}

function toggle(id: string) {
	if (selected.value.has(id)) selected.value.delete(id)
	else selected.value.add(id)
	selected.value = new Set(selected.value)
}

async function fetchUsers() {
	loading.value = true
	try {
		const res: any = await api.getUsers()
		users.value = Array.isArray(res) ? res : (res?.data ?? [])
	} catch (e: any) {
		error.value = e.message
	} finally {
		loading.value = false
	}
}

async function submit() {
	if (selected.value.size === 0) return
	saving.value = true
	error.value = ''
	const ids = Array.from(selected.value)
	try {
		for (const userId of ids) {
			await api.addTraceabilityParticipant(props.traceabilityId, userId)
		}
		emit('saved', ids)
		emit('close')
	} catch (e: any) {
		error.value = e.message
	} finally {
		saving.value = false
	}
}

onMounted(fetchUsers)
</script>

<template>
  <AppModal title="Compartir trazabilidad" size="md" @close="emit('close')">
    <div class="p-6 space-y-4">
      <p class="text-sm text-base-content/60">
        Los usuarios seleccionados verán esta trazabilidad y recibirán un espacio en su sección de chat para
        iniciar o abrir su propio chat vinculado.
      </p>

      <div v-if="error" class="px-3 py-2 rounded-lg bg-red-900/40 border border-red-700/50 text-red-400 text-sm">
        {{ error }}
      </div>

      <div v-if="loading" class="flex items-center gap-2 text-base-content/50 text-sm py-4">
        <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        Cargando usuarios...
      </div>

      <div v-else-if="available.length === 0" class="text-sm text-base-content/50 py-4">
        No hay usuarios disponibles para invitar.
      </div>

      <div v-else class="max-h-72 overflow-y-auto space-y-1.5 pr-1">
        <label v-for="u in available" :key="u.id"
          class="flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors"
          :class="selected.has(u.id)
            ? 'bg-indigo-600/10 border-indigo-500'
            : 'bg-base-200/40 border-base-300 hover:border-base-content/20'">
          <input type="checkbox" :checked="selected.has(u.id)" @change="toggle(u.id)"
            class="accent-indigo-500 cursor-pointer" />
          <div class="min-w-0 flex-1">
            <p class="text-sm text-base-content truncate">{{ displayName(u) }}</p>
            <p v-if="u.email" class="text-xs text-base-content/50 truncate">{{ u.email }}</p>
          </div>
        </label>
      </div>

      <div class="flex gap-3 pt-2">
        <button @click="emit('close')"
          class="flex-1 py-2.5 text-sm rounded-xl bg-base-200 hover:bg-base-100 text-base-content font-medium transition-colors">
          Cancelar
        </button>
        <button @click="submit" :disabled="saving || selected.size === 0"
          class="flex-1 py-2.5 text-sm rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium transition-colors">
          {{ saving ? 'Compartiendo...' : `Compartir (${selected.size})` }}
        </button>
      </div>
    </div>
  </AppModal>
</template>
