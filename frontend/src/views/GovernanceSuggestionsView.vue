<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import PageLayout from '@/components/PageLayout.vue'
import { useToastStore } from '@/store/useToast'
import { useAuthStore } from '@/store/useAuth'
import * as api from '@/api/api'

const toast = useToastStore()
const auth = useAuthStore()

interface Suggestion {
  id: string
  type: string
  title: string
  content: string
  reason: string | null
  agentSlug: string | null
  userId: string | null
  userEmail: string | null
  createdAt: string
}

const items = ref<Suggestion[]>([])
const loading = ref(false)
const selected = ref<Suggestion | null>(null)
const deleteTarget = ref<Suggestion | null>(null)
const deleting = ref(false)

const byType = computed(() => {
  const map = new Map<string, Suggestion[]>()
  for (const s of items.value) {
    const list = map.get(s.type) ?? []
    list.push(s)
    map.set(s.type, list)
  }
  return map
})

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

async function fetchItems() {
  loading.value = true
  try {
    const res = await api.getGovernanceSuggestions()
    items.value = res.data ?? []
    if (selected.value) {
      selected.value = items.value.find((s) => s.id === selected.value!.id) ?? null
    }
  } catch (e: any) {
    toast.error(e.message ?? 'Error al cargar sugerencias')
  } finally {
    loading.value = false
  }
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await api.deleteGovernanceSuggestion(deleteTarget.value.id)
    toast.success('Sugerencia eliminada')
    if (selected.value?.id === deleteTarget.value.id) selected.value = null
    deleteTarget.value = null
    await fetchItems()
  } catch (e: any) {
    toast.error(e.message ?? 'Error al eliminar sugerencia')
  } finally {
    deleting.value = false
  }
}

onMounted(fetchItems)
</script>

<template>
  <PageLayout title="Sugerencias de gobernanza"
    description="Propuestas registradas por los agentes que aún no forman parte de la gobernanza vigente.">
    <div class="flex flex-1 min-h-0 h-full">
      <!-- List -->
      <div class="w-80 shrink-0 border-r border-slate-800/60 flex flex-col min-h-0 overflow-auto">
        <div v-if="loading" class="flex items-center justify-center py-12 text-slate-500 text-sm">
          <span class="mdi mdi-loading mdi-spin mr-2" />Cargando...
        </div>

        <div v-else-if="items.length === 0" class="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div class="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
            <span class="mdi mdi-lightbulb-on-outline text-2xl text-amber-400" />
          </div>
          <p class="text-sm font-medium text-slate-300 mb-1">Sin sugerencias todavía</p>
          <p class="text-xs text-slate-500">Los agentes pueden registrar propuestas con la tool <code>suggest_governance</code></p>
        </div>

        <div v-else class="flex-1 overflow-y-auto py-3">
          <div v-for="[type, group] in byType" :key="type" class="mb-1">
            <p class="px-4 py-1 text-xs font-semibold text-amber-400/70 uppercase tracking-wider flex items-center gap-1">
              <span class="mdi mdi-tag-outline text-xs" />{{ type }}
              <span class="ml-1 text-slate-500 normal-case font-normal">({{ group.length }})</span>
            </p>
            <button v-for="item in group" :key="item.id"
              class="w-full text-left px-4 py-2.5 hover:bg-slate-800/60 transition-colors border-b border-slate-800/40 last:border-0"
              :class="selected?.id === item.id ? 'bg-slate-800/80 border-l-2 border-l-amber-500' : ''"
              @click="selected = item">
              <p class="text-sm font-medium text-white truncate">{{ item.title }}</p>
              <p class="text-xs text-slate-500 truncate mt-0.5">
                {{ item.userEmail ?? 'usuario desconocido' }} · {{ formatDate(item.createdAt) }}
              </p>
            </button>
          </div>
        </div>
      </div>

      <!-- Detail -->
      <div class="flex-1 min-h-0 overflow-y-auto">
        <div v-if="!selected" class="flex flex-col items-center justify-center h-full text-center px-8">
          <div class="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
            <span class="mdi mdi-lightbulb-on-outline text-3xl text-amber-400" />
          </div>
          <p class="text-sm font-medium text-slate-400 mb-1">Selecciona una sugerencia</p>
          <p class="text-xs text-slate-600">Haz clic en un ítem de la lista para ver su detalle</p>
        </div>

        <div v-else class="p-8 w-full">
          <div class="flex items-start justify-between mb-6 gap-4">
            <div>
              <h2 class="text-xl font-bold text-white mb-2">{{ selected.title }}</h2>
              <span class="text-xs text-amber-400 font-mono bg-amber-500/10 px-2 py-0.5 rounded">
                <span class="mdi mdi-tag-outline mr-1" />{{ selected.type }}
              </span>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button v-if="auth.hasPermission('governance_suggestion', 'delete')"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
                @click="deleteTarget = selected">
                <span class="mdi mdi-delete text-sm" />Eliminar
              </button>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3 mb-6">
            <div class="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2">
              <p class="text-xs text-slate-500 mb-0.5">Usuario</p>
              <p class="text-sm text-slate-200 truncate">{{ selected.userEmail ?? '—' }}</p>
            </div>
            <div class="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2">
              <p class="text-xs text-slate-500 mb-0.5">Agente</p>
              <p class="text-sm text-slate-200 truncate">{{ selected.agentSlug ?? '—' }}</p>
            </div>
            <div class="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2">
              <p class="text-xs text-slate-500 mb-0.5">Creada</p>
              <p class="text-sm text-slate-200">{{ formatDate(selected.createdAt) }}</p>
            </div>
            <div class="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2">
              <p class="text-xs text-slate-500 mb-0.5">ID</p>
              <p class="text-xs text-slate-400 font-mono truncate">{{ selected.id }}</p>
            </div>
          </div>

          <div class="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
            <div class="px-4 py-2.5 border-b border-slate-800 flex items-center gap-2">
              <span class="mdi mdi-file-document-outline text-slate-500 text-sm" />
              <span class="text-xs font-medium text-slate-500">Contenido propuesto</span>
            </div>
            <pre class="p-4 text-sm text-slate-300 font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">{{
              selected.content || '(sin contenido)' }}</pre>
          </div>

          <div v-if="selected.reason" class="mt-4 rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
            <div class="px-4 py-2.5 border-b border-slate-800 flex items-center gap-2">
              <span class="mdi mdi-comment-question-outline text-slate-500 text-sm" />
              <span class="text-xs font-medium text-slate-500">Motivo</span>
            </div>
            <pre class="p-4 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed overflow-x-auto">{{ selected.reason }}</pre>
          </div>
        </div>
      </div>
    </div>

    <ConfirmDialog v-if="deleteTarget" title="Eliminar sugerencia"
      :message="`¿Eliminar la sugerencia &quot;${deleteTarget.title}&quot;? Esta acción no se puede deshacer.`"
      confirm-label="Eliminar" :loading="deleting" @confirm="confirmDelete" @cancel="deleteTarget = null" />
  </PageLayout>
</template>
