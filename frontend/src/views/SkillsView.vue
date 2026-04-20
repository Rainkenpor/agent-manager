<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import PageLayout from '@/components/PageLayout.vue'
import AppModal from '@/components/AppModal.vue'
import { useToastStore } from '@/store/useToast'
import { useAuthStore } from '@/store/useAuth'
import * as api from '@/api/api'

const toast = useToastStore()
const auth = useAuthStore()

interface Skill {
  id: string
  name: string
  slug: string
  description: string | null
  content: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface SkillForm {
  name: string
  slug: string
  description: string
  content: string
  isActive: boolean
}

const skills = ref<Skill[]>([])
const loading = ref(false)
const showModal = ref(false)
const editingSkill = ref<Skill | null>(null)
const saving = ref(false)
const deleteTarget = ref<Skill | null>(null)
const deleting = ref(false)
const selectedSkill = ref<Skill | null>(null)
const slugManuallyEdited = ref(false)

const defaultForm = (): SkillForm => ({
  name: '',
  slug: '',
  description: '',
  content: '',
  isActive: true,
})

const form = ref<SkillForm>(defaultForm())

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

watch(
  () => form.value.name,
  (name) => {
    if (!editingSkill.value && !slugManuallyEdited.value) {
      form.value.slug = generateSlug(name)
    }
  }
)

function openCreate() {
  editingSkill.value = null
  form.value = defaultForm()
  slugManuallyEdited.value = false
  showModal.value = true
}

function openEdit(skill: Skill) {
  editingSkill.value = skill
  form.value = {
    name: skill.name,
    slug: skill.slug,
    description: skill.description ?? '',
    content: skill.content,
    isActive: skill.isActive,
  }
  slugManuallyEdited.value = true
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingSkill.value = null
}

async function fetchSkills() {
  loading.value = true
  try {
    const res = await api.getSkills()
    skills.value = res.data ?? []
  } catch (e: any) {
    toast.error(e.message ?? 'Error al cargar skills')
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    if (editingSkill.value) {
      await api.updateSkill(editingSkill.value.id, {
        name: form.value.name,
        slug: form.value.slug,
        description: form.value.description || null,
        content: form.value.content,
        isActive: form.value.isActive,
      })
      toast.success('Skill actualizado')
    } else {
      await api.createSkill({
        name: form.value.name,
        slug: form.value.slug,
        description: form.value.description || undefined,
        content: form.value.content,
      })
      toast.success('Skill creado')
    }
    closeModal()
    await fetchSkills()
  } catch (e: any) {
    toast.error(e.message ?? 'Error al guardar skill')
  } finally {
    saving.value = false
  }
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await api.deleteSkill(deleteTarget.value.id)
    toast.success('Skill eliminado')
    if (selectedSkill.value?.id === deleteTarget.value.id) {
      selectedSkill.value = null
    }
    deleteTarget.value = null
    await fetchSkills()
  } catch (e: any) {
    toast.error(e.message ?? 'Error al eliminar skill')
  } finally {
    deleting.value = false
  }
}

const activeSkills = computed(() => skills.value.filter((s) => s.isActive))
const inactiveSkills = computed(() => skills.value.filter((s) => !s.isActive))

onMounted(fetchSkills)
</script>

<template>
    <PageLayout title="Skills" description="Bloques de instrucciones reutilizables en markdown">
      <template #actions>
        <button
          v-if="auth.hasPermission('skills', 'create')"
          class="flex items-center gap-2 px-4 py-2 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-sm font-medium transition-colors"
          @click="openCreate">
          <span class="mdi mdi-plus text-base" />
          Nuevo skill
        </button>
      </template>

      <div class="flex flex-1 min-h-0">
        <!-- Skill list -->
        <div class="w-80 shrink-0 border-r border-slate-800/60 flex flex-col min-h-0">
          <div v-if="loading" class="flex items-center justify-center py-12 text-slate-500 text-sm">
            <span class="mdi mdi-loading mdi-spin mr-2" />Cargando...
          </div>

          <div v-else-if="skills.length === 0" class="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div class="w-14 h-14 rounded-2xl bg-fuchsia-500/10 flex items-center justify-center mb-4">
              <span class="mdi mdi-lightning-bolt text-2xl text-fuchsia-400" />
            </div>
            <p class="text-sm font-medium text-slate-300 mb-1">Sin skills todavía</p>
            <p class="text-xs text-slate-500">Crea tu primer skill para empezar</p>
          </div>

          <div v-else class="flex-1 overflow-y-auto py-3">
            <!-- Active skills -->
            <div v-if="activeSkills.length > 0">
              <p class="px-4 pb-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">Activos</p>
              <button
                v-for="skill in activeSkills"
                :key="skill.id"
                class="w-full text-left px-4 py-3 hover:bg-slate-800/60 transition-colors border-b border-slate-800/40 last:border-0"
                :class="selectedSkill?.id === skill.id ? 'bg-slate-800/80 border-l-2 border-l-fuchsia-500' : ''"
                @click="selectedSkill = skill">
                <div class="flex items-center justify-between gap-2">
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-white truncate">{{ skill.name }}</p>
                    <p class="text-xs text-slate-500 font-mono truncate">{{ skill.slug }}</p>
                  </div>
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                </div>
              </button>
            </div>

            <!-- Inactive skills -->
            <div v-if="inactiveSkills.length > 0" class="mt-2">
              <p class="px-4 pb-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">Inactivos</p>
              <button
                v-for="skill in inactiveSkills"
                :key="skill.id"
                class="w-full text-left px-4 py-3 hover:bg-slate-800/60 transition-colors border-b border-slate-800/40 last:border-0"
                :class="selectedSkill?.id === skill.id ? 'bg-slate-800/80 border-l-2 border-l-fuchsia-500' : ''"
                @click="selectedSkill = skill">
                <div class="flex items-center justify-between gap-2">
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-slate-400 truncate">{{ skill.name }}</p>
                    <p class="text-xs text-slate-600 font-mono truncate">{{ skill.slug }}</p>
                  </div>
                  <span class="w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0" />
                </div>
              </button>
            </div>
          </div>
        </div>

        <!-- Detail panel -->
        <div class="flex-1 min-h-0 overflow-y-auto">
          <div v-if="!selectedSkill" class="flex flex-col items-center justify-center h-full text-center px-8">
            <div class="w-16 h-16 rounded-2xl bg-fuchsia-500/10 flex items-center justify-center mb-4">
              <span class="mdi mdi-lightning-bolt text-3xl text-fuchsia-400" />
            </div>
            <p class="text-sm font-medium text-slate-400 mb-1">Selecciona un skill</p>
            <p class="text-xs text-slate-600">Haz clic en un skill de la lista para ver sus detalles</p>
          </div>

          <div v-else class="p-8 max-w-3xl">
            <!-- Skill header -->
            <div class="flex items-start justify-between mb-6 gap-4">
              <div>
                <div class="flex items-center gap-3 mb-1">
                  <h2 class="text-xl font-bold text-white">{{ selectedSkill.name }}</h2>
                  <span
                    class="text-xs px-2 py-0.5 rounded-full font-medium"
                    :class="selectedSkill.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700/60 text-slate-500'">
                    {{ selectedSkill.isActive ? 'Activo' : 'Inactivo' }}
                  </span>
                </div>
                <code class="text-xs text-fuchsia-400 font-mono bg-fuchsia-500/10 px-2 py-0.5 rounded">{{ selectedSkill.slug }}</code>
                <p v-if="selectedSkill.description" class="text-sm text-slate-400 mt-2">{{ selectedSkill.description }}</p>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <button
                  v-if="auth.hasPermission('skills', 'update')"
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                  @click="openEdit(selectedSkill)">
                  <span class="mdi mdi-pencil text-sm" />
                  Editar
                </button>
                <button
                  v-if="auth.hasPermission('skills', 'delete')"
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
                  @click="deleteTarget = selectedSkill">
                  <span class="mdi mdi-delete text-sm" />
                  Eliminar
                </button>
              </div>
            </div>

            <!-- Content -->
            <div class="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
              <div class="px-4 py-2.5 border-b border-slate-800 flex items-center gap-2">
                <span class="mdi mdi-file-document-outline text-slate-500 text-sm" />
                <span class="text-xs font-medium text-slate-500">Contenido</span>
              </div>
              <pre class="p-4 text-sm text-slate-300 font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">{{ selectedSkill.content || '(sin contenido)' }}</pre>
            </div>

            <!-- Metadata -->
            <div class="mt-4 grid grid-cols-2 gap-3">
              <div class="rounded-lg border border-slate-800 bg-slate-900/30 px-4 py-3">
                <p class="text-xs text-slate-500 mb-0.5">Creado</p>
                <p class="text-xs text-slate-300">{{ new Date(selectedSkill.createdAt).toLocaleString() }}</p>
              </div>
              <div class="rounded-lg border border-slate-800 bg-slate-900/30 px-4 py-3">
                <p class="text-xs text-slate-500 mb-0.5">Actualizado</p>
                <p class="text-xs text-slate-300">{{ new Date(selectedSkill.updatedAt).toLocaleString() }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>

    <!-- Create / Edit Modal -->
    <AppModal
      v-if="showModal"
      size="2xl"
      :title="editingSkill ? 'Editar skill' : 'Nuevo skill'"
      @close="closeModal">
      <div class="px-6 py-5 space-y-5">
        <!-- Name -->
        <div>
          <label class="block text-xs font-medium text-slate-400 mb-1.5">Nombre <span class="text-red-400">*</span></label>
          <input
            v-model="form.name"
            type="text"
            placeholder="Mi skill de análisis"
            class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-500 transition-colors" />
        </div>

        <!-- Slug -->
        <div>
          <label class="block text-xs font-medium text-slate-400 mb-1.5">Slug <span class="text-red-400">*</span></label>
          <input
            v-model="form.slug"
            type="text"
            placeholder="mi-skill-de-analisis"
            class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-fuchsia-300 font-mono placeholder-slate-500 focus:outline-none focus:border-fuchsia-500 transition-colors"
            @input="slugManuallyEdited = true" />
          <p class="text-xs text-slate-600 mt-1">Solo minúsculas, números y guiones</p>
        </div>

        <!-- Description -->
        <div>
          <label class="block text-xs font-medium text-slate-400 mb-1.5">Descripción</label>
          <input
            v-model="form.description"
            type="text"
            placeholder="Breve descripción del skill"
            class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-500 transition-colors" />
        </div>

        <!-- Content -->
        <div>
          <label class="block text-xs font-medium text-slate-400 mb-1.5">Contenido (markdown)</label>
          <textarea
            v-model="form.content"
            rows="10"
            placeholder="# Skill&#10;&#10;Instrucciones del skill en formato markdown..."
            class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-fuchsia-500 transition-colors resize-y" />
        </div>

        <!-- Active (only when editing) -->
        <div v-if="editingSkill" class="flex items-center gap-3">
          <button
            type="button"
            class="relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none"
            :class="form.isActive ? 'bg-fuchsia-600' : 'bg-slate-700'"
            @click="form.isActive = !form.isActive">
            <span
              class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
              :class="form.isActive ? 'translate-x-5' : 'translate-x-0'" />
          </button>
          <span class="text-sm text-slate-300">{{ form.isActive ? 'Activo' : 'Inactivo' }}</span>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-3">
          <button
            class="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            @click="closeModal">
            Cancelar
          </button>
          <button
            class="px-4 py-2 rounded-lg text-sm font-medium bg-fuchsia-600 hover:bg-fuchsia-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            :disabled="saving || !form.name || !form.slug"
            @click="save">
            <span v-if="saving" class="mdi mdi-loading mdi-spin text-sm" />
            {{ editingSkill ? 'Guardar cambios' : 'Crear skill' }}
          </button>
        </div>
      </template>
    </AppModal>

    <!-- Delete Confirm -->
    <ConfirmDialog
      v-if="deleteTarget"
      :title="`Eliminar skill`"
      :message="`¿Seguro que deseas eliminar '${deleteTarget.name}'? Esta acción no se puede deshacer.`"
      :loading="deleting"
      @confirm="confirmDelete"
      @cancel="deleteTarget = null" />
</template>
