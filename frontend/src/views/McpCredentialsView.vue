<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import PageLayout from '@/components/PageLayout.vue'
import { useToastStore } from '@/store/useToast'
import * as api from '@/api/api'

const toast = useToastStore()

interface McpServer {
  id: string
  name: string
  displayName?: string
  active: boolean
}

interface Credential {
  id: string
  userId: string
  mcpServerId: string
  key: string
  value: string
  createdAt: string
  updatedAt: string
}

const servers = ref<McpServer[]>([])
const credentials = ref<Credential[]>([])
const loading = ref(false)

// Group credentials by mcpServerId
const credentialsByServer = computed(() => {
  const map: Record<string, Credential[]> = {}
  for (const cred of credentials.value) {
    if (!map[cred.mcpServerId]) map[cred.mcpServerId] = []
    map[cred.mcpServerId].push(cred)
  }
  return map
})

function serverLabel(id: string) {
  const s = servers.value.find((s) => s.id === id)
  return s ? (s.displayName || s.name) : id
}

// Form for adding/editing
const showForm = ref(false)
const formServerId = ref('')
const formKey = ref('')
const formValue = ref('')
const formEditing = ref<Credential | null>(null)
const saving = ref(false)

function openAdd() {
  formEditing.value = null
  formServerId.value = servers.value[0]?.id ?? ''
  formKey.value = ''
  formValue.value = ''
  showForm.value = true
}

function openEdit(cred: Credential) {
  formEditing.value = cred
  formServerId.value = cred.mcpServerId
  formKey.value = cred.key
  formValue.value = cred.value
  showForm.value = true
}

async function saveCredential() {
  if (!formServerId.value || !formKey.value) return
  saving.value = true
  try {
    await api.upsertMcpCredential(formServerId.value, formKey.value, formValue.value)
    toast.success('Credencial guardada')
    showForm.value = false
    await fetchCredentials()
  } catch (e: any) {
    toast.error(e.message)
  } finally {
    saving.value = false
  }
}

// Delete
const deleteTarget = ref<Credential | null>(null)
const deleting = ref(false)

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await api.deleteMcpCredential(deleteTarget.value.mcpServerId, deleteTarget.value.key)
    toast.success('Credencial eliminada')
    deleteTarget.value = null
    await fetchCredentials()
  } catch (e: any) {
    toast.error(e.message)
  } finally {
    deleting.value = false
  }
}

// Visibility toggle per credential
const visibleValues = ref<Set<string>>(new Set())
function toggleVisibility(id: string) {
  if (visibleValues.value.has(id)) {
    visibleValues.value.delete(id)
  } else {
    visibleValues.value.add(id)
  }
}

async function fetchServers() {
  try {
    const res = await api.getMcpServers()
    servers.value = (res.data ?? []).filter((s: McpServer) => s.active)
  } catch {}
}

async function fetchCredentials() {
  loading.value = true
  try {
    const res = await api.getMcpCredentials()
    credentials.value = res.data ?? []
  } catch (e: any) {
    toast.error(e.message)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await Promise.all([fetchServers(), fetchCredentials()])
})
</script>

<template>
    <PageLayout title="Credenciales MCP" description="Claves y tokens personales por servidor MCP. El agente puede acceder a estos valores durante las conversaciones." body-class="max-w-4xl mx-auto">
      <template #actions>
        <button
          @click="openAdd"
          class="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Nueva credencial
        </button>
      </template>

      <!-- Loading -->
        <div v-if="loading" class="text-slate-400 text-sm">Cargando...</div>

        <!-- Empty -->
        <div
          v-else-if="credentials.length === 0"
          class="border border-dashed border-slate-700 rounded-xl p-12 text-center"
        >
          <svg class="w-10 h-10 mx-auto text-slate-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          <p class="text-slate-500 text-sm">No hay credenciales almacenadas.</p>
          <button @click="openAdd" class="mt-3 text-violet-400 hover:text-violet-300 text-sm underline">
            Agregar la primera
          </button>
        </div>

        <!-- Grouped by MCP server -->
        <div v-else class="space-y-6">
          <div
            v-for="(creds, serverId) in credentialsByServer"
            :key="serverId"
            class="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden"
          >
            <div class="px-5 py-3 bg-slate-800/50 border-b border-slate-700 flex items-center gap-2">
              <svg class="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
              </svg>
              <span class="font-semibold text-slate-100 text-sm">{{ serverLabel(serverId) }}</span>
              <span class="text-slate-500 text-xs">({{ creds.length }} clave{{ creds.length !== 1 ? 's' : '' }})</span>
            </div>

            <table class="w-full text-sm">
              <thead>
                <tr class="text-slate-500 text-xs border-b border-slate-800">
                  <th class="px-5 py-2 text-left font-medium">Clave</th>
                  <th class="px-5 py-2 text-left font-medium">Valor</th>
                  <th class="px-5 py-2 text-left font-medium">Actualizado</th>
                  <th class="px-5 py-2 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="cred in creds"
                  :key="cred.id"
                  class="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30 transition-colors"
                >
                  <td class="px-5 py-3 font-mono text-violet-300">{{ cred.key }}</td>
                  <td class="px-5 py-3 font-mono text-slate-300 max-w-xs">
                    <span v-if="visibleValues.has(cred.id)" class="break-all">{{ cred.value }}</span>
                    <span v-else class="tracking-widest text-slate-500">••••••••</span>
                    <button
                      @click="toggleVisibility(cred.id)"
                      class="ml-2 text-slate-500 hover:text-slate-300 transition-colors"
                      :title="visibleValues.has(cred.id) ? 'Ocultar' : 'Mostrar'"
                    >
                      <svg class="w-3.5 h-3.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path v-if="!visibleValues.has(cred.id)" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    </button>
                  </td>
                  <td class="px-5 py-3 text-slate-500 text-xs">
                    {{ new Date(cred.updatedAt).toLocaleString() }}
                  </td>
                  <td class="px-5 py-3 text-right">
                    <div class="flex items-center justify-end gap-2">
                      <button
                        @click="openEdit(cred)"
                        class="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                        title="Editar"
                      >
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        @click="deleteTarget = cred"
                        class="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                        title="Eliminar"
                      >
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
    </PageLayout>

    <!-- Add/Edit Modal -->
    <Teleport to="body">
      <div
        v-if="showForm"
        class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        @click.self="showForm = false"
      >
        <div class="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md shadow-2xl">
          <div class="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
            <h2 class="text-lg font-semibold text-white">
              {{ formEditing ? 'Editar credencial' : 'Nueva credencial' }}
            </h2>
            <button @click="showForm = false" class="text-slate-400 hover:text-white transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <form @submit.prevent="saveCredential" class="px-6 py-5 space-y-4">
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1.5">Servidor MCP</label>
              <select
                v-model="formServerId"
                :disabled="!!formEditing"
                class="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50"
              >
                <option v-for="s in servers" :key="s.id" :value="s.id">
                  {{ s.displayName || s.name }}
                </option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1.5">Clave</label>
              <input
                v-model="formKey"
                :disabled="!!formEditing"
                type="text"
                placeholder="ej: email, token, api_key"
                class="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1.5">Valor</label>
              <input
                v-model="formValue"
                type="password"
                placeholder="Valor de la credencial"
                class="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>
            <div class="flex gap-3 pt-2">
              <button
                type="button"
                @click="showForm = false"
                class="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                :disabled="saving || !formServerId || !formKey"
                class="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {{ saving ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Delete Confirm -->
    <ConfirmDialog
      v-if="deleteTarget"
      title="Eliminar credencial"
      :message="`¿Eliminar la clave '${deleteTarget.key}' del servidor '${serverLabel(deleteTarget.mcpServerId)}'?`"
      confirm-label="Eliminar"
      :loading="deleting"
      @confirm="confirmDelete"
      @cancel="deleteTarget = null"
    />
</template>
