<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import PageLayout from '@/components/PageLayout.vue'
import AppModal from '@/components/AppModal.vue'
import { useToastStore } from '@/store/useToast'
import { useAuthStore } from '@/store/useAuth'
import * as api from '@/api/api'
import TextAreaComplete from '@/components/TextAreaComplete.vue'

const toast = useToastStore()
const auth = useAuthStore()

interface Governance {
  id: string
  name: string
  type: string
  description: string | null
  content: string
  sections: GovernanceSection[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface GovernanceSection {
  title: string
  content: string
}

interface GovernanceForm {
  name: string
  type: string
  description: string
  content: string
  sections: GovernanceSection[]
  isActive: boolean
}

const items = ref<Governance[]>([])
const loading = ref(false)
const showModal = ref(false)
const editing = ref<Governance | null>(null)
const saving = ref(false)
const deleteTarget = ref<Governance | null>(null)
const deleting = ref(false)
const selected = ref<Governance | null>(null)

const defaultForm = (): GovernanceForm => ({
  name: '',
  type: '',
  description: '',
  content: '',
  sections: [],
  isActive: true,
})

const form = ref<GovernanceForm>(defaultForm())

// ── Groups ──────────────────────────────────────────────────────────────────

const activeItems = computed(() => items.value.filter((g) => g.isActive))
const inactiveItems = computed(() => items.value.filter((g) => !g.isActive))

const activeByType = computed(() => {
  const map = new Map<string, Governance[]>()
  for (const g of activeItems.value) {
    const list = map.get(g.type) ?? []
    list.push(g)
    map.set(g.type, list)
  }
  return map
})

// ── Actions ──────────────────────────────────────────────────────────────────

function openCreate() {
  editing.value = null
  form.value = defaultForm()
  showModal.value = true
}

function openEdit(item: Governance) {
  editing.value = item
  form.value = {
    name: item.name,
    type: item.type,
    description: item.description ?? '',
    content: item.content,
    sections: (item.sections ?? []).map((section) => ({ ...section })),
    isActive: item.isActive,
  }
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editing.value = null
}

async function fetchItems() {
  loading.value = true
  try {
    const res = await api.getGovernance()
    items.value = (res.data ?? []).map((item: Governance) => ({
      ...item,
      sections: item.sections ?? [],
    }))
  } catch (e: any) {
    toast.error(e.message ?? 'Error al cargar gobernanza')
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    const sections = form.value.sections
      .map((section) => ({
        title: section.title.trim(),
        content: section.content.trim(),
      }))
      .filter((section) => section.title || section.content)

    if (editing.value) {
      await api.updateGovernance(editing.value.id, {
        name: form.value.name,
        type: form.value.type,
        description: form.value.description || null,
        content: form.value.content,
        sections,
        isActive: form.value.isActive,
      })
      toast.success('Gobernanza actualizada')
    } else {
      await api.createGovernance({
        name: form.value.name,
        type: form.value.type,
        description: form.value.description || undefined,
        content: form.value.content,
        sections,
      })
      toast.success('Gobernanza creada')
    }
    closeModal()
    await fetchItems()
  } catch (e: any) {
    toast.error(e.message ?? 'Error al guardar gobernanza')
  } finally {
    saving.value = false
  }
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await api.deleteGovernance(deleteTarget.value.id)
    toast.success('Gobernanza eliminada')
    if (selected.value?.id === deleteTarget.value.id) selected.value = null
    deleteTarget.value = null
    await fetchItems()
  } catch (e: any) {
    toast.error(e.message ?? 'Error al eliminar gobernanza')
  } finally {
    deleting.value = false
  }
}

onMounted(fetchItems)

function addSection() {
  form.value.sections.push({ title: '', content: '' })
}

function removeSection(index: number) {
  form.value.sections.splice(index, 1)
}
</script>

<template>
  <PageLayout title="Gobernanza"
    description="Instrucciones organizacionales agrupadas por tipo que los agentes pueden consultar">
    <template #actions>
      <button v-if="auth.hasPermission('governance', 'create')"
        class="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
        @click="openCreate">
        <span class="mdi mdi-plus text-base" />
        Nueva gobernanza
      </button>
    </template>

    <div class="flex flex-1 min-h-0 h-full">
      <!-- List -->
      <div class="w-80 shrink-0 border-r border-base-300/60 flex flex-col min-h-0 overflow-auto">
        <div v-if="loading" class="flex items-center justify-center py-12 text-base-content/50 text-sm">
          <span class="mdi mdi-loading mdi-spin mr-2" />Cargando...
        </div>

        <div v-else-if="items.length === 0" class="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div class="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4">
            <span class="mdi mdi-shield-check text-2xl text-violet-400" />
          </div>
          <p class="text-sm font-medium text-base-content mb-1">Sin gobernanza todavía</p>
          <p class="text-xs text-base-content/50">Crea tu primera regla de gobernanza</p>
        </div>

        <div v-else class="flex-1 overflow-y-auto py-3">
          <!-- Active — grouped by type -->
          <div v-if="activeItems.length > 0">
            <div v-for="[type, group] in activeByType" :key="type" class="mb-1">
              <p
                class="px-4 py-1 text-xs font-semibold text-violet-400/70 uppercase tracking-wider flex items-center gap-1">
                <span class="mdi mdi-tag-outline text-xs" />{{ type }}
              </p>
              <button v-for="item in group" :key="item.id"
                class="w-full text-left px-4 py-2.5 hover:bg-base-200/60 transition-colors border-b border-base-300/40 last:border-0"
                :class="selected?.id === item.id ? 'bg-base-200/80 border-l-2 border-l-violet-500' : ''"
                @click="selected = item">
                <div class="flex items-center justify-between gap-2">
                  <p class="text-sm font-medium text-base-content truncate">{{ item.name }}</p>
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                </div>
                <p v-if="item.description" class="text-xs text-base-content/50 truncate mt-0.5">{{ item.description }}</p>
              </button>
            </div>
          </div>

          <!-- Inactive -->
          <div v-if="inactiveItems.length > 0" class="mt-2">
            <p class="px-4 pb-1 text-xs font-semibold text-base-content/50 uppercase tracking-wider">Inactivos</p>
            <button v-for="item in inactiveItems" :key="item.id"
              class="w-full text-left px-4 py-2.5 hover:bg-base-200/60 transition-colors border-b border-base-300/40 last:border-0"
              :class="selected?.id === item.id ? 'bg-base-200/80 border-l-2 border-l-violet-500' : ''"
              @click="selected = item">
              <div class="flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-base-content/60 truncate">{{ item.name }}</p>
                  <p class="text-xs text-base-content/40 font-mono truncate">{{ item.type }}</p>
                </div>
                <span class="w-1.5 h-1.5 rounded-full bg-base-100 shrink-0" />
              </div>
            </button>
          </div>
        </div>
      </div>

      <!-- Detail -->
      <div class="flex-1 min-h-0 overflow-y-auto">
        <div v-if="!selected" class="flex flex-col items-center justify-center h-full text-center px-8">
          <div class="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4">
            <span class="mdi mdi-shield-check text-3xl text-violet-400" />
          </div>
          <p class="text-sm font-medium text-base-content/60 mb-1">Selecciona una gobernanza</p>
          <p class="text-xs text-base-content/40">Haz clic en un ítem de la lista para ver sus detalles</p>
        </div>

        <div v-else class="p-8 w-full">
          <div class="flex items-start justify-between mb-6 gap-4">
            <div>
              <div class="flex items-center gap-3 mb-1">
                <h2 class="text-xl font-bold text-base-content">{{ selected.name }}</h2>
                <span class="text-xs px-2 py-0.5 rounded-full font-medium"
                  :class="selected.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-base-100/60 text-base-content/50'">
                  {{ selected.isActive ? 'Activo' : 'Inactivo' }}
                </span>
              </div>
              <span class="text-xs text-violet-400 font-mono bg-violet-500/10 px-2 py-0.5 rounded">
                <span class="mdi mdi-tag-outline mr-1" />{{ selected.type }}
              </span>
              <p v-if="selected.description" class="text-sm text-base-content/60 mt-2">{{ selected.description }}</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button v-if="auth.hasPermission('governance', 'update')"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-base-200 hover:bg-base-100 text-base-content hover:text-base-content transition-colors"
                @click="openEdit(selected)">
                <span class="mdi mdi-pencil text-sm" />Editar
              </button>
              <button v-if="auth.hasPermission('governance', 'delete')"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
                @click="deleteTarget = selected">
                <span class="mdi mdi-delete text-sm" />Eliminar
              </button>
            </div>
          </div>

          <div class="rounded-xl border border-base-300 bg-base-300/50 overflow-hidden">
            <div class="px-4 py-2.5 border-b border-base-300 flex items-center gap-2">
              <span class="mdi mdi-file-document-outline text-base-content/50 text-sm" />
              <span class="text-xs font-medium text-base-content/50">Contenido (instrucciones)</span>
            </div>
            <pre class="p-4 text-sm text-base-content font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">{{
              selected.content || '(sin contenido)' }}</pre>
          </div>

          <div class="mt-4 rounded-xl border border-base-300 bg-base-300/50 overflow-hidden">
            <div class="px-4 py-2.5 border-b border-base-300 flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="mdi mdi-format-list-bulleted-square text-base-content/50 text-sm" />
                <span class="text-xs font-medium text-base-content/50">Secciones</span>
              </div>
              <span class="text-[11px] text-base-content/40">{{ selected.sections?.length ?? 0 }}</span>
            </div>
            <div v-if="selected.sections?.length" class="divide-y divide-base-300">
              <div v-for="(section, index) in selected.sections" :key="`${selected.id}-section-${index}`" class="p-4">
                <p class="text-sm font-semibold text-violet-300 mb-2">{{ index + 1 }}. {{ section.title }}</p>
                <pre class="text-sm text-base-content font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">{{
                  section.content || '(sin contenido)' }}</pre>
              </div>
            </div>
            <div v-else class="p-4 text-sm text-base-content/50">(sin secciones)</div>
          </div>

          <div class="mt-4 grid grid-cols-2 gap-3">
            <div class="rounded-lg border border-base-300 bg-base-300/30 px-4 py-3">
              <p class="text-xs text-base-content/50 mb-0.5">Creado</p>
              <p class="text-xs text-base-content">{{ new Date(selected.createdAt).toLocaleString() }}</p>
            </div>
            <div class="rounded-lg border border-base-300 bg-base-300/30 px-4 py-3">
              <p class="text-xs text-base-content/50 mb-0.5">Actualizado</p>
              <p class="text-xs text-base-content">{{ new Date(selected.updatedAt).toLocaleString() }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </PageLayout>

  <!-- Create / Edit Modal -->
  <AppModal v-if="showModal" size="2xl" :title="editing ? 'Editar gobernanza' : 'Nueva gobernanza'" @close="closeModal">
    <div class="px-6 py-5 space-y-5">
      <!-- Name -->
      <div>
        <label class="block text-xs font-medium text-base-content/60 mb-1.5">Nombre <span
            class="text-red-400">*</span></label>
        <input v-model="form.name" type="text" placeholder="Política de revisión de código"
          class="w-full bg-base-200 border border-base-300 rounded-lg px-3 py-2 text-sm text-base-content placeholder:text-base-content/40 focus:outline-none focus:border-violet-500 transition-colors" />
      </div>

      <!-- Type -->
      <div>
        <label class="block text-xs font-medium text-base-content/60 mb-1.5">
          Tipo <span class="text-red-400">*</span>
          <span class="ml-1 text-base-content/40 font-normal">— los agentes usan este valor para consultar la
            gobernanza</span>
        </label>
        <input v-model="form.type" type="text" placeholder="code-review"
          class="w-full bg-base-200 border border-base-300 rounded-lg px-3 py-2 text-sm text-violet-300 font-mono placeholder:text-base-content/40 focus:outline-none focus:border-violet-500 transition-colors" />
        <p class="text-xs text-base-content/40 mt-1">El agente llama a <code
            class="text-violet-400">get_governance(type)</code>
          para obtener todas las instrucciones de este tipo</p>
      </div>

      <!-- Description -->
      <div>
        <label class="block text-xs font-medium text-base-content/60 mb-1.5">Descripción</label>
        <input v-model="form.description" type="text" placeholder="Breve descripción de la gobernanza"
          class="w-full bg-base-200 border border-base-300 rounded-lg px-3 py-2 text-sm text-base-content placeholder:text-base-content/40 focus:outline-none focus:border-violet-500 transition-colors" />
      </div>

      <!-- Content -->
      <div>
        <label class="block text-xs font-medium text-base-content/60 mb-1.5">Instrucciones (markdown)</label>
        <TextAreaComplete v-model="form.content" placeholder="Instrucciones que el agente debe seguir..." />
      </div>

      <div class="space-y-3">
        <div class="flex items-center justify-between gap-3">
          <div>
            <label class="block text-xs font-medium text-base-content/60 mb-1">Secciones</label>
            <p class="text-xs text-base-content/40">Estructura opcional para que el agente consulte la gobernanza por bloques.
            </p>
          </div>
          <button type="button"
            class="px-3 py-1.5 rounded-lg bg-base-200 hover:bg-base-100 text-xs font-medium text-violet-300 transition-colors"
            @click="addSection">
            Agregar sección
          </button>
        </div>

        <div v-if="!form.sections.length"
          class="rounded-lg border border-dashed border-base-300 px-4 py-4 text-sm text-base-content/50">
          No hay secciones agregadas.
        </div>

        <div v-for="(section, index) in form.sections" :key="`section-${index}`"
          class="rounded-xl border border-base-300 bg-base-300/40 p-4 space-y-3">
          <div class="flex items-center justify-between gap-3">
            <p class="text-xs font-semibold text-violet-300 uppercase tracking-wider">Sección {{ index + 1 }}</p>
            <button type="button"
              class="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-xs font-medium text-red-300 transition-colors"
              @click="removeSection(index)">
              Eliminar
            </button>
          </div>

          <div>
            <label class="block text-xs font-medium text-base-content/60 mb-1.5">Título</label>
            <input v-model="section.title" type="text" placeholder="Checklist"
              class="w-full bg-base-200 border border-base-300 rounded-lg px-3 py-2 text-sm text-base-content placeholder:text-base-content/40 focus:outline-none focus:border-violet-500 transition-colors" />
          </div>

          <div>
            <label class="block text-xs font-medium text-base-content/60 mb-1.5">Contenido</label>
            <TextAreaComplete v-model="section.content" placeholder="Instrucciones que el agente debe seguir..." />
          </div>
        </div>
      </div>

      <!-- Active (only when editing) -->
      <div v-if="editing" class="flex items-center gap-3">
        <button type="button" class="relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none"
          :class="form.isActive ? 'bg-violet-600' : 'bg-base-100'" @click="form.isActive = !form.isActive">
          <span class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-base-100 shadow transition-transform duration-200"
            :class="form.isActive ? 'translate-x-5' : 'translate-x-0'" />
        </button>
        <span class="text-sm text-base-content">{{ form.isActive ? 'Activo' : 'Inactivo' }}</span>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-3">
        <button
          class="px-4 py-2 rounded-lg text-sm font-medium text-base-content/60 hover:text-base-content hover:bg-base-200 transition-colors"
          @click="closeModal">
          Cancelar
        </button>
        <button
          class="px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          :disabled="saving || !form.name || !form.type" @click="save">
          <span v-if="saving" class="mdi mdi-loading mdi-spin text-sm" />
          {{ editing ? 'Guardar cambios' : 'Crear gobernanza' }}
        </button>
      </div>
    </template>
  </AppModal>

  <!-- Delete Confirm -->
  <ConfirmDialog v-if="deleteTarget" title="Eliminar gobernanza"
    :message="`¿Seguro que deseas eliminar '${deleteTarget.name}'? Esta acción no se puede deshacer.`"
    :loading="deleting" @confirm="confirmDelete" @cancel="deleteTarget = null" />
</template>
