<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import * as api from '@/api/api'
import type { ClarifyDocument, ClarifyProject, PresetQnaGroup } from '@/api/api'
import AppModal from '@/components/AppModal.vue'
import PageLayout from '@/components/PageLayout.vue'
import { useAuthStore } from '@/store/useAuth'
import { useToastStore } from '@/store/useToast'

const auth = useAuthStore()
const toast = useToastStore()

const canManageQna = computed(() => auth.hasResourceAccess('preset_qna'))
const activeTab = ref<'projects' | 'documents' | 'qna'>('projects')

// ── Proyectos ─────────────────────────────────────────────────────────────────

const projects = ref<ClarifyProject[]>([])
const projectsLoading = ref(false)
const projectSearch = ref('')

const filteredProjects = computed(() => {
  const q = projectSearch.value.trim().toLowerCase()
  if (!q) return projects.value
  return projects.value.filter(
    (p) => p.title.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q) || p.slug.toLowerCase().includes(q)
  )
})

const projectGroups = computed(() => {
  const groups = new Map<string, ClarifyProject[]>()
  for (const p of filteredProjects.value) {
    const name = p.group ? decodeURIComponent(p.group) : 'Sin grupo'
    const list = groups.get(name) ?? []
    list.push(p)
    groups.set(name, list)
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))
})

async function fetchProjects() {
  projectsLoading.value = true
  try {
    const res = await api.getClarifyProjects()
    projects.value = res.data ?? []
  } catch (e: any) {
    toast.error(e.message ?? 'No se pudieron cargar los proyectos')
  } finally {
    projectsLoading.value = false
  }
}

// ── Documentos ────────────────────────────────────────────────────────────────

const documents = ref<ClarifyDocument[]>([])
const documentsLoading = ref(false)
const documentSearch = ref('')

const filteredDocuments = computed(() => {
  const q = documentSearch.value.trim().toLowerCase()
  if (!q) return documents.value
  return documents.value.filter((d) => d.title.toLowerCase().includes(q) || (d.originalFilename ?? '').toLowerCase().includes(q))
})

const statusBadge: Record<ClarifyDocument['status'], { label: string; class: string }> = {
  pending: { label: 'Pendiente', class: 'bg-amber-500/15 text-amber-400' },
  converting: { label: 'Convirtiendo', class: 'bg-sky-500/15 text-sky-400' },
  embedding: { label: 'Indexando', class: 'bg-indigo-500/15 text-indigo-400' },
  ready: { label: 'Listo', class: 'bg-emerald-500/15 text-emerald-400' },
  error: { label: 'Error', class: 'bg-rose-500/15 text-rose-400' }
}

const sourceTypeIcon: Record<ClarifyDocument['sourceType'], string> = {
  pdf: 'mdi-file-pdf-box',
  html: 'mdi-language-html5',
  link: 'mdi-link-variant'
}

async function fetchDocuments() {
  documentsLoading.value = true
  try {
    const res = await api.getClarifyDocuments()
    documents.value = res.data ?? []
  } catch (e: any) {
    toast.error(e.message ?? 'No se pudieron cargar los documentos')
  } finally {
    documentsLoading.value = false
  }
}

// ── Categorías ────────────────────────────────────────────────────────────────

const categories = ref<any[]>([])

function categoryLabel(c: any): string {
  return c?.name ?? c?.title ?? c?.slug ?? String(c?.id ?? '')
}

function categoryNames(ids: string[]): string {
  if (!ids?.length) return '—'
  return ids
    .map((id) => {
      const cat = categories.value.find((c) => c.id === id)
      return cat ? categoryLabel(cat) : id
    })
    .join(', ')
}

async function fetchCategories() {
  try {
    const res = await api.getClarifyDocumentCategories()
    categories.value = res.data ?? []
  } catch {
    categories.value = []
  }
}

// ── Subir documento ───────────────────────────────────────────────────────────

const showUploadModal = ref(false)
const uploading = ref(false)
const uploadForm = ref<{ title: string; filename: string; mimeType: string; fileBase64: string; categoryIds: string[] }>({
  title: '',
  filename: '',
  mimeType: '',
  fileBase64: '',
  categoryIds: []
})

function openUpload() {
  uploadForm.value = { title: '', filename: '', mimeType: '', fileBase64: '', categoryIds: [] }
  showUploadModal.value = true
}

function onFileSelected(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploadForm.value.filename = file.name
  uploadForm.value.mimeType = file.type
  if (!uploadForm.value.title) uploadForm.value.title = file.name.replace(/\.[^.]+$/, '')
  const reader = new FileReader()
  reader.onload = () => {
    uploadForm.value.fileBase64 = reader.result as string
  }
  reader.readAsDataURL(file)
}

function toggleCategory(id: string) {
  const ids = uploadForm.value.categoryIds
  const idx = ids.indexOf(id)
  if (idx === -1) ids.push(id)
  else ids.splice(idx, 1)
}

const canSubmit = computed(
  () =>
    uploadForm.value.title.trim().length > 0 &&
    uploadForm.value.fileBase64.length > 0 &&
    uploadForm.value.categoryIds.length > 0 &&
    !uploading.value
)

async function submitUpload() {
  if (!canSubmit.value) return
  uploading.value = true
  try {
    await api.createClarifyDocument({
      title: uploadForm.value.title.trim(),
      filename: uploadForm.value.filename,
      ...(uploadForm.value.mimeType ? { mimeType: uploadForm.value.mimeType } : {}),
      fileBase64: uploadForm.value.fileBase64,
      categoryIds: uploadForm.value.categoryIds
    })
    toast.success('Documento subido correctamente')
    showUploadModal.value = false
    await fetchDocuments()
    activeTab.value = 'documents'
  } catch (e: any) {
    toast.error(e.message ?? 'No se pudo subir el documento')
  } finally {
    uploading.value = false
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Respuestas preestablecidas (FAQ del chat público) ──────────────────────────

const qnaGroups = ref<PresetQnaGroup[]>([])
const qnaLoading = ref(false)
const qnaSearch = ref('')
const refreshingId = ref<string | null>(null)
const deleteTarget = ref<PresetQnaGroup | null>(null)
const deletingQna = ref(false)

const filteredQna = computed(() => {
  const q = qnaSearch.value.trim().toLowerCase()
  if (!q) return qnaGroups.value
  return qnaGroups.value.filter(
    (g) => g.canonicalQuestion.toLowerCase().includes(q) || g.answer.toLowerCase().includes(q) || g.questions.some((x) => x.toLowerCase().includes(q))
  )
})

async function fetchQna() {
  if (!canManageQna.value) return
  qnaLoading.value = true
  try {
    const res = await api.getPresetQna()
    qnaGroups.value = res.data ?? []
  } catch (e: any) {
    toast.error(e.message ?? 'No se pudieron cargar las respuestas')
  } finally {
    qnaLoading.value = false
  }
}

async function refreshQna(group: PresetQnaGroup) {
  refreshingId.value = group.id
  try {
    const res = await api.refreshPresetQna(group.id)
    if (!res.success) throw new Error(res.error ?? 'No se pudo actualizar')
    if (res.data) {
      const idx = qnaGroups.value.findIndex((g) => g.id === group.id)
      if (idx !== -1) qnaGroups.value[idx] = res.data
    }
    toast.success('Respuesta actualizada por el agente')
  } catch (e: any) {
    toast.error(e.message ?? 'No se pudo actualizar la respuesta')
  } finally {
    refreshingId.value = null
  }
}

async function confirmDeleteQna() {
  if (!deleteTarget.value) return
  deletingQna.value = true
  try {
    await api.deletePresetQna(deleteTarget.value.id)
    qnaGroups.value = qnaGroups.value.filter((g) => g.id !== deleteTarget.value!.id)
    toast.success('Grupo eliminado')
    deleteTarget.value = null
  } catch (e: any) {
    toast.error(e.message ?? 'No se pudo eliminar')
  } finally {
    deletingQna.value = false
  }
}

onMounted(() => {
  fetchProjects()
  fetchDocuments()
  fetchCategories()
  fetchQna()
})
</script>

<template>
  <PageLayout title="Clarify" description="Proyectos y documentos registrados en la base de conocimiento">
    <template #actions>
      <button v-if="auth.hasPermission('clarify', 'create')" @click="openUpload"
        class="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
        <i class="mdi mdi-upload"></i>
        Subir documento
      </button>
      <button @click="() => { fetchProjects(); fetchDocuments() }"
        class="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-base-200 hover:bg-base-100 text-base-content transition-colors">
        <i class="mdi mdi-refresh" :class="projectsLoading || documentsLoading ? 'animate-spin' : ''"></i>
        Actualizar
      </button>
    </template>

    <!-- Tabs -->
    <div class="flex items-center gap-1 mb-4 border-b border-base-300">
      <button v-for="tab in ([
        { key: 'projects', label: `Proyectos (${projects.length})`, icon: 'mdi-folder-multiple-outline' },
        { key: 'documents', label: `Documentos (${documents.length})`, icon: 'mdi-file-document-multiple-outline' }
      ] as const)" :key="tab.key" @click="activeTab = tab.key"
        class="flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px" :class="activeTab === tab.key
          ? 'border-indigo-500 text-base-content'
          : 'border-transparent text-base-content/50 hover:text-base-content'">
        <i class="mdi" :class="tab.icon"></i>
        {{ tab.label }}
      </button>
      <button v-if="canManageQna" @click="activeTab = 'qna'"
        class="flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px" :class="activeTab === 'qna'
          ? 'border-indigo-500 text-base-content'
          : 'border-transparent text-base-content/50 hover:text-base-content'">
        <i class="mdi mdi-comment-question-outline"></i>
        Respuestas ({{ qnaGroups.length }})
      </button>
    </div>

    <!-- ── Proyectos ──────────────────────────────────────────────────────── -->
    <template v-if="activeTab === 'projects'">
      <input v-model="projectSearch" type="text" placeholder="Buscar proyecto..."
        class="w-full sm:w-72 mb-4 px-3 py-2 text-sm rounded-lg bg-base-200 border border-base-300 text-base-content placeholder:text-base-content/40 focus:outline-none focus:border-indigo-500" />

      <div v-if="projectsLoading" class="flex justify-center py-16">
        <div class="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
      <p v-else-if="!filteredProjects.length" class="text-sm text-base-content/50 italic text-center py-16">
        No hay proyectos para mostrar.
      </p>
      <div v-else class="space-y-6">
        <section v-for="[groupName, groupProjects] in projectGroups" :key="groupName">
          <h3 class="text-xs font-semibold uppercase tracking-wider text-base-content/50 mb-2">
            {{ groupName }} <span class="font-normal">({{ groupProjects.length }})</span>
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            <div v-for="p in groupProjects" :key="p.id"
              class="rounded-xl bg-base-300 border border-base-300 p-4 flex gap-3">
              <div class="w-10 h-10 rounded-lg bg-indigo-500/15 text-indigo-400 flex items-center justify-center shrink-0">
                <i class="mdi text-xl" :class="p.icon ?? 'mdi-folder-outline'"></i>
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <h4 class="text-sm font-semibold text-base-content truncate">{{ p.title }}</h4>
                  <span v-if="!p.active" class="px-2 py-0.5 rounded-full text-[10px] bg-rose-500/15 text-rose-400 shrink-0">
                    Inactivo
                  </span>
                </div>
                <p class="text-xs text-base-content/50 font-mono truncate">{{ p.slug }}</p>
                <p class="text-xs text-base-content/60 mt-1 line-clamp-3">{{ p.description ?? 'Sin descripción' }}</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </template>

    <!-- ── Documentos ─────────────────────────────────────────────────────── -->
    <template v-else-if="activeTab === 'documents'">
      <input v-model="documentSearch" type="text" placeholder="Buscar documento..."
        class="w-full sm:w-72 mb-4 px-3 py-2 text-sm rounded-lg bg-base-200 border border-base-300 text-base-content placeholder:text-base-content/40 focus:outline-none focus:border-indigo-500" />

      <div v-if="documentsLoading" class="flex justify-center py-16">
        <div class="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
      <p v-else-if="!filteredDocuments.length" class="text-sm text-base-content/50 italic text-center py-16">
        No hay documentos para mostrar.
      </p>
      <div v-else class="overflow-x-auto rounded-xl border border-base-300">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-base-300 text-left text-xs uppercase tracking-wider text-base-content/50">
              <th class="px-4 py-3 font-semibold">Documento</th>
              <th class="px-4 py-3 font-semibold">Tipo</th>
              <th class="px-4 py-3 font-semibold">Estado</th>
              <th class="px-4 py-3 font-semibold">Categorías</th>
              <th class="px-4 py-3 font-semibold">Creado</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-base-300">
            <tr v-for="d in filteredDocuments" :key="d.id" class="hover:bg-base-300/40 transition-colors">
              <td class="px-4 py-3">
                <p class="text-base-content font-medium truncate max-w-xs" :title="d.title">{{ d.title }}</p>
                <p v-if="d.originalFilename" class="text-xs text-base-content/50 font-mono truncate max-w-xs">
                  {{ d.originalFilename }}
                </p>
              </td>
              <td class="px-4 py-3">
                <span class="flex items-center gap-1.5 text-base-content/70">
                  <i class="mdi" :class="sourceTypeIcon[d.sourceType]"></i>
                  <span class="uppercase text-xs">{{ d.sourceType }}</span>
                </span>
              </td>
              <td class="px-4 py-3">
                <span class="px-2 py-0.5 rounded-full text-xs font-medium" :class="statusBadge[d.status].class"
                  :title="d.error ?? undefined">
                  {{ statusBadge[d.status].label }}
                </span>
              </td>
              <td class="px-4 py-3 text-xs text-base-content/60 max-w-[220px] truncate" :title="categoryNames(d.categoryIds)">
                {{ categoryNames(d.categoryIds) }}
              </td>
              <td class="px-4 py-3 text-xs text-base-content/50 whitespace-nowrap">{{ formatDate(d.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- ── Respuestas preestablecidas ─────────────────────────────────────── -->
    <template v-else-if="activeTab === 'qna'">
      <input v-model="qnaSearch" type="text" placeholder="Buscar pregunta o respuesta..."
        class="w-full sm:w-72 mb-4 px-3 py-2 text-sm rounded-lg bg-base-200 border border-base-300 text-base-content placeholder:text-base-content/40 focus:outline-none focus:border-indigo-500" />

      <div v-if="qnaLoading" class="flex justify-center py-16">
        <div class="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
      <p v-else-if="!filteredQna.length" class="text-sm text-base-content/50 italic text-center py-16">
        Aún no hay respuestas preestablecidas. Se generan automáticamente cuando el chat público responde preguntas nuevas.
      </p>
      <div v-else class="overflow-x-auto rounded-xl border border-base-300">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-base-300 text-left text-xs uppercase tracking-wider text-base-content/50">
              <th class="px-4 py-3 font-semibold">Pregunta</th>
              <th class="px-4 py-3 font-semibold">Respuesta</th>
              <th class="px-4 py-3 font-semibold">Variantes</th>
              <th class="px-4 py-3 font-semibold">Actualizado</th>
              <th class="px-4 py-3 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-base-300">
            <tr v-for="g in filteredQna" :key="g.id" class="hover:bg-base-300/40 transition-colors align-top">
              <td class="px-4 py-3 max-w-xs">
                <p class="text-base-content font-medium" :title="g.canonicalQuestion">{{ g.canonicalQuestion }}</p>
              </td>
              <td class="px-4 py-3 text-xs text-base-content/70 max-w-md">
                <p class="line-clamp-3" :title="g.answer">{{ g.answer }}</p>
              </td>
              <td class="px-4 py-3 text-xs text-base-content/60 whitespace-nowrap"
                :title="g.questions.join('\n')">
                {{ g.questions.length }} variantes
              </td>
              <td class="px-4 py-3 text-xs text-base-content/50 whitespace-nowrap">{{ formatDate(g.updatedAt) }}</td>
              <td class="px-4 py-3 whitespace-nowrap text-right">
                <div class="inline-flex items-center gap-1">
                  <button v-if="auth.hasPermission('preset_qna', 'update')" @click="refreshQna(g)" :disabled="refreshingId === g.id"
                    class="p-1.5 rounded-lg hover:bg-base-200 text-base-content/70 hover:text-indigo-400 transition-colors disabled:opacity-50"
                    title="Actualizar con el agente">
                    <i class="mdi mdi-robot-outline" :class="refreshingId === g.id ? 'animate-spin' : ''"></i>
                  </button>
                  <button v-if="auth.hasPermission('preset_qna', 'delete')" @click="deleteTarget = g"
                    class="p-1.5 rounded-lg hover:bg-base-200 text-base-content/70 hover:text-rose-400 transition-colors"
                    title="Eliminar">
                    <i class="mdi mdi-trash-can-outline"></i>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </PageLayout>

  <!-- ── Modal subir documento ────────────────────────────────────────────── -->
  <AppModal v-if="showUploadModal" title="Subir documento" size="xl" @close="showUploadModal = false">
    <form class="space-y-4" @submit.prevent="submitUpload">
      <div>
        <label class="block text-xs font-medium text-base-content/60 mb-1">Archivo</label>
        <input type="file" @change="onFileSelected"
          class="w-full text-sm text-base-content file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-indigo-600 file:text-white file:text-xs hover:file:bg-indigo-500 file:cursor-pointer" />
        <p v-if="uploadForm.filename" class="text-xs text-base-content/50 mt-1 font-mono">
          {{ uploadForm.filename }}<span v-if="uploadForm.mimeType"> · {{ uploadForm.mimeType }}</span>
        </p>
      </div>

      <div>
        <label class="block text-xs font-medium text-base-content/60 mb-1">Título</label>
        <input v-model="uploadForm.title" type="text" placeholder="Título del documento"
          class="w-full px-3 py-2 text-sm rounded-lg bg-base-300 border border-base-300 text-base-content placeholder:text-base-content/40 focus:outline-none focus:border-indigo-500" />
      </div>

      <div>
        <label class="block text-xs font-medium text-base-content/60 mb-1">Categorías (al menos una)</label>
        <p v-if="!categories.length" class="text-xs text-base-content/50 italic">No hay categorías disponibles.</p>
        <div v-else class="flex flex-wrap gap-2">
          <button v-for="c in categories" :key="c.id" type="button" @click="toggleCategory(c.id)"
            class="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors" :class="uploadForm.categoryIds.includes(c.id)
              ? 'bg-indigo-600 border-indigo-600 text-white'
              : 'bg-base-300 border-base-300 text-base-content/70 hover:border-indigo-500'">
            {{ categoryLabel(c) }}
          </button>
        </div>
      </div>
    </form>

    <template #footer>
      <div class="flex justify-end gap-2">
        <button @click="showUploadModal = false"
          class="px-4 py-2 text-sm rounded-lg bg-base-300 hover:bg-base-100 text-base-content transition-colors">
          Cancelar
        </button>
        <button :disabled="!canSubmit" @click="submitUpload"
          class="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          <span v-if="uploading" class="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
          {{ uploading ? 'Subiendo...' : 'Subir' }}
        </button>
      </div>
    </template>
  </AppModal>

  <!-- ── Confirmar eliminación de grupo Q&A ───────────────────────────────── -->
  <AppModal v-if="deleteTarget" title="Eliminar respuesta preestablecida" @close="deleteTarget = null">
    <p class="text-sm text-base-content/80">
      ¿Eliminar este grupo de preguntas y su respuesta? El chat público dejará de responderlas de forma instantánea.
    </p>
    <p class="mt-2 text-sm font-medium text-base-content">{{ deleteTarget.canonicalQuestion }}</p>
    <template #footer>
      <div class="flex justify-end gap-2">
        <button @click="deleteTarget = null"
          class="px-4 py-2 text-sm rounded-lg bg-base-300 hover:bg-base-100 text-base-content transition-colors">
          Cancelar
        </button>
        <button :disabled="deletingQna" @click="confirmDeleteQna"
          class="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-colors disabled:opacity-50">
          <span v-if="deletingQna" class="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
          {{ deletingQna ? 'Eliminando...' : 'Eliminar' }}
        </button>
      </div>
    </template>
  </AppModal>
</template>
