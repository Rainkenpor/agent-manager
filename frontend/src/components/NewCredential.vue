<template>
  <form @submit.prevent="saveCredentials" class="space-y-4">
    <div>
      <label class="block text-xs font-medium text-slate-400 mb-1.5">Servidor MCP</label>
      <select v-model="selectedServerId" :disabled="!!editing"
        class="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50">
        <option v-for="s in servers" :key="s.id" :value="s.id">
          {{ s.displayName || s.name }}
        </option>
      </select>
    </div>

    <!-- Alert: server already has credentials -->
    <div v-if="hasExistingCredentials && !editing"
      class="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-300">
      <svg class="mt-0.5 w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
      <span>
        Este servidor ya tiene {{ existingKeys.length === 1 ? 'una credencial' : `${existingKeys.length} credenciales` }}
        guardada{{ existingKeys.length !== 1 ? 's' : '' }}
        <span class="font-mono text-amber-200">({{ existingKeys.join(', ') }})</span>.
        Guardar sobreescribirá los valores existentes.
      </span>
    </div>

    <!-- Dynamic fields from credentialFields -->
    <template v-if="selectedServerFields.length > 0">
      <div v-for="field in selectedServerFields" :key="field.key">
        <label class="block text-xs font-medium text-slate-400 mb-1.5">
          {{ field.key }}
          <span v-if="field.description" class="text-slate-500 font-normal ml-1">— {{ field.description }}</span>
        </label>
        <input v-model="fieldValues[field.key]" type="password" :placeholder="`Valor para ${field.key}`"
          class="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-violet-500" />
      </div>
    </template>

    <!-- Fallback: manual key/value when server has no credentialFields defined -->
    <template v-else>
      <div>
        <label class="block text-xs font-medium text-slate-400 mb-1.5">Clave</label>
        <input v-model="manualKey" :disabled="!!editing" type="text" placeholder="ej: email, token, api_key"
          class="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50" />
      </div>
      <div>
        <label class="block text-xs font-medium text-slate-400 mb-1.5">Valor</label>
        <input v-model="manualValue" type="password" placeholder="Valor de la credencial"
          class="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-violet-500" />
      </div>
    </template>

    <div class="flex gap-3 pt-2">
      <button type="button" @click="emit('cancel')"
        class="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors">
        Cancelar
      </button>
      <button type="submit" :disabled="saving || !canSave"
        class="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
        {{ saving ? 'Guardando...' : 'Guardar' }}
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import * as api from '@/api/api'
import { useToastStore } from '@/store/useToast'
import type { McpServer, CredentialField } from '@/types/types'

interface Credential {
  id: string
  mcpServerId: string
  key: string
  value: string
}

const props = defineProps<{
  servers: McpServer[]
  editing?: Credential | null
  initialServerId?: string
}>()

const emit = defineEmits<{
  saved: []
  cancel: []
}>()

const toast = useToastStore()
const saving = ref(false)
const existingKeys = ref<string[]>([])

const selectedServerId = ref(props.editing?.mcpServerId ?? props.initialServerId ?? props.servers[0]?.id ?? '')
const manualKey = ref(props.editing?.key ?? '')
const manualValue = ref('')
const fieldValues = ref<Record<string, string>>({})

const selectedServer = computed(() => props.servers.find((s) => s.id === selectedServerId.value))
const selectedServerFields = computed<CredentialField[]>(() => selectedServer.value?.credentialFields ?? [])

const hasExistingCredentials = computed(() => existingKeys.value.length > 0)

async function fetchExistingCredentials(serverId: string) {
  if (!serverId) return
  try {
    const res = await api.getMcpCredentials(serverId)
    existingKeys.value = (res.data ?? []).map((c: any) => c.key)
  } catch {
    existingKeys.value = []
  }
}

watch(selectedServerId, (id) => {
  fieldValues.value = {}
  manualKey.value = ''
  manualValue.value = ''
  fetchExistingCredentials(id)
})

onMounted(() => fetchExistingCredentials(selectedServerId.value))

watch(
  () => props.editing,
  (cred) => {
    if (cred) {
      selectedServerId.value = cred.mcpServerId
      manualKey.value = cred.key
    }
  },
  { immediate: true }
)

const canSave = computed(() => {
  if (!selectedServerId.value) return false
  if (selectedServerFields.value.length > 0) {
    return selectedServerFields.value.some((f) => fieldValues.value[f.key]?.trim())
  }
  return !!manualKey.value.trim()
})

async function saveCredentials() {
  if (!selectedServerId.value || !canSave.value) return
  saving.value = true
  try {
    if (selectedServerFields.value.length > 0) {
      for (const field of selectedServerFields.value) {
        if (fieldValues.value[field.key]?.trim()) {
          await api.upsertMcpCredential(selectedServerId.value, field.key, fieldValues.value[field.key])
        }
      }
    } else {
      await api.upsertMcpCredential(selectedServerId.value, manualKey.value.trim(), manualValue.value)
    }
    toast.success('Credencial guardada')
    emit('saved')
  } catch (e: any) {
    toast.error(e.message)
  } finally {
    saving.value = false
  }
}
</script>
