<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { HistoriaUsuario, Proyecto, ProyectoParticipante, ProyectoServicio } from '@/api/api'
import * as api from '@/api/api'
import AppModal from '@/components/AppModal.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import PageLayout from '@/components/PageLayout.vue'
import ProyectoChatPanel from '@/components/ProyectoChatPanel.vue'
import { useAuthStore } from '@/store/useAuth'
import { useToastStore } from '@/store/useToast'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const toast = useToastStore()

const proyectoId = route.params.id as string
const canManage = auth.hasResourceManageAccess('proyectos')

const proyecto = ref<Proyecto | null>(null)
const servicios = ref<ProyectoServicio[]>([])
const historias = ref<HistoriaUsuario[]>([])
const participantes = ref<ProyectoParticipante[]>([])
const users = ref<any[]>([])
const agents = ref<any[]>([])
const governanceTypes = ref<string[]>([])
const loading = ref(true)

const tab = ref<'general' | 'servicios' | 'interesados' | 'historias' | 'chat'>('general')
const tabs = [
	{ key: 'general', label: 'General', icon: 'mdi-information-outline' },
	{ key: 'servicios', label: 'Servicios', icon: 'mdi-source-branch' },
	{ key: 'interesados', label: 'Interesados', icon: 'mdi-account-group' },
	{ key: 'historias', label: 'Historias de usuario', icon: 'mdi-clipboard-text-outline' },
	{ key: 'chat', label: 'Chat', icon: 'mdi-chat' }
] as const

const statusLabels: Record<string, string> = { pending: 'Pendiente', in_progress: 'En progreso', done: 'Hecha', blocked: 'Bloqueada' }
const fileStatusMeta: Record<string, { label: string; cls: string }> = {
	ok: { label: 'OK', cls: 'text-success' },
	outdated: { label: 'Desactualizado', cls: 'text-warning' },
	missing: { label: 'Falta', cls: 'text-error' },
	unknown: { label: 'Sin verificar', cls: 'text-base-content/40' }
}

async function loadAll() {
	loading.value = true
	try {
		const [p, s, h] = await Promise.all([api.getProyecto(proyectoId), api.getServicios(proyectoId), api.getHistorias(proyectoId)])
		if (!p.success || !p.data) throw new Error(p.error || 'Proyecto no encontrado')
		proyecto.value = p.data
		servicios.value = s.data ?? []
		historias.value = h.data ?? []
	} catch (e: any) {
		toast.error(e.message)
		router.push('/proyectos')
	} finally {
		loading.value = false
	}
}

async function loadAux() {
	try {
		const [ag, gov, us, parts] = await Promise.all([api.getAgents(), api.getGovernance(), api.getUsers(), api.getParticipantes(proyectoId)])
		agents.value = ag.data ?? []
		governanceTypes.value = [...new Set((gov.data ?? []).map((g: any) => g.type).filter(Boolean))].sort()
		users.value = Array.isArray(us) ? us : ((us as any)?.data ?? [])
		participantes.value = parts.data ?? []
	} catch {
		// auxiliares opcionales
	}
}

async function reloadParticipantes() {
	const parts = await api.getParticipantes(proyectoId)
	participantes.value = parts.data ?? []
}

function userLabel(u: any): string {
	const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim()
	return name || u.username || u.email || u.id
}

function participanteLabel(p: ProyectoParticipante): string {
	const name = [p.firstName, p.lastName].filter(Boolean).join(' ').trim()
	return name || p.username || p.email || p.userId
}

const availableUsers = computed(() => {
	const taken = new Set(participantes.value.map((p) => p.userId))
	return users.value.filter((u) => !taken.has(u.id))
})

// ── Interesados ──
const addUserId = ref('')
const addRole = ref('')
const savingInteresado = ref(false)
const removingInteresado = ref<ProyectoParticipante | null>(null)

async function addInteresado() {
	if (!addUserId.value) {
		toast.error('Selecciona un usuario')
		return
	}
	savingInteresado.value = true
	try {
		const res = await api.addParticipante(proyectoId, addUserId.value, addRole.value || null)
		if (!res.success) throw new Error(res.error)
		addUserId.value = ''
		addRole.value = ''
		await reloadParticipantes()
		toast.success('Interesado agregado')
	} catch (e: any) {
		toast.error(e.message)
	} finally {
		savingInteresado.value = false
	}
}

async function removeInteresadoConfirmed() {
	if (!removingInteresado.value) return
	try {
		const res = await api.removeParticipante(proyectoId, removingInteresado.value.userId)
		if (!res.success) throw new Error(res.error)
		await reloadParticipantes()
		toast.success('Interesado eliminado')
	} catch (e: any) {
		toast.error(e.message)
	} finally {
		removingInteresado.value = null
	}
}

async function reloadHistorias() {
	const h = await api.getHistorias(proyectoId)
	historias.value = h.data ?? []
}

// ── General ──
const generalForm = ref<Partial<Proyecto>>({})
const savingGeneral = ref(false)

function syncGeneralForm() {
	if (!proyecto.value) return
	generalForm.value = { ...proyecto.value }
}

async function saveGeneral() {
	savingGeneral.value = true
	try {
		const res = await api.updateProyecto(proyectoId, {
			name: generalForm.value.name,
			description: generalForm.value.description,
			clarifyProjectId: generalForm.value.clarifyProjectId,
			architecture: generalForm.value.architecture,
			programmingLanguage: generalForm.value.programmingLanguage,
			status: generalForm.value.status,
			chatAgentId: generalForm.value.chatAgentId
		})
		if (!res.success) throw new Error(res.error)
		proyecto.value = res.data!
		syncGeneralForm()
		toast.success('Proyecto actualizado')
	} catch (e: any) {
		toast.error(e.message)
	} finally {
		savingGeneral.value = false
	}
}

// ── Servicios ──
const servicioModal = ref(false)
const servicioForm = ref<Partial<ProyectoServicio>>({})
const savingServicio = ref(false)
const deletingServicio = ref<ProyectoServicio | null>(null)
const applyingServicio = ref<ProyectoServicio | null>(null)
const repoBusy = ref<string | null>(null)

function openCreateServicio() {
	servicioForm.value = { name: '', repoUrl: '', repoRef: '', governanceType: governanceTypes.value[0] ?? '' }
	servicioModal.value = true
}
function openEditServicio(s: ProyectoServicio) {
	servicioForm.value = { ...s }
	servicioModal.value = true
}
async function saveServicio() {
	if (!servicioForm.value.name?.trim() || !servicioForm.value.repoUrl?.trim()) {
		toast.error('Nombre y URL del repo son obligatorios')
		return
	}
	savingServicio.value = true
	try {
		const res = servicioForm.value.id
			? await api.updateServicio(servicioForm.value.id, servicioForm.value)
			: await api.createServicio(proyectoId, servicioForm.value)
		if (!res.success) throw new Error(res.error)
		servicioModal.value = false
		servicios.value = (await api.getServicios(proyectoId)).data ?? []
		toast.success('Servicio guardado')
	} catch (e: any) {
		toast.error(e.message)
	} finally {
		savingServicio.value = false
	}
}
async function deleteServicioConfirmed() {
	if (!deletingServicio.value) return
	try {
		const res = await api.deleteServicio(deletingServicio.value.id)
		if (!res.success) throw new Error(res.error)
		servicios.value = servicios.value.filter((s) => s.id !== deletingServicio.value!.id)
		toast.success('Servicio eliminado')
	} catch (e: any) {
		toast.error(e.message)
	} finally {
		deletingServicio.value = null
	}
}
async function verifyServicio(s: ProyectoServicio) {
	repoBusy.value = s.id
	try {
		const res = await api.verifyRepos(proyectoId, s.id)
		if (!res.success) throw new Error(res.error)
		servicios.value = (await api.getServicios(proyectoId)).data ?? []
		toast.success('Verificación completada')
	} catch (e: any) {
		toast.error(e.message)
	} finally {
		repoBusy.value = null
	}
}
async function applyServicioConfirmed() {
	if (!applyingServicio.value) return
	const s = applyingServicio.value
	repoBusy.value = s.id
	try {
		const res = await api.applyRepos(proyectoId, s.id)
		if (!res.success) throw new Error(res.error)
		servicios.value = (await api.getServicios(proyectoId)).data ?? []
		toast.success('AGENT.md y CLAUDE.md escritos en el repo')
	} catch (e: any) {
		toast.error(e.message)
	} finally {
		repoBusy.value = null
		applyingServicio.value = null
	}
}

// ── Historias de usuario ──
const historiaModal = ref(false)
const historiaForm = ref<Partial<HistoriaUsuario>>({})
const savingHistoria = ref(false)
const deletingHistoria = ref<HistoriaUsuario | null>(null)

function openCreateHistoria() {
	historiaForm.value = { title: '', description: '', code: '', status: 'pending' }
	historiaModal.value = true
}
function openEditHistoria(h: HistoriaUsuario) {
	historiaForm.value = { ...h }
	historiaModal.value = true
}
async function saveHistoria() {
	if (!historiaForm.value.title?.trim()) {
		toast.error('El título es obligatorio')
		return
	}
	savingHistoria.value = true
	try {
		const res = historiaForm.value.id
			? await api.updateHistoria(historiaForm.value.id, historiaForm.value)
			: await api.createHistoria(proyectoId, historiaForm.value)
		if (!res.success) throw new Error(res.error)
		historiaModal.value = false
		await reloadHistorias()
		toast.success('Historia guardada')
	} catch (e: any) {
		toast.error(e.message)
	} finally {
		savingHistoria.value = false
	}
}
async function deleteHistoriaConfirmed() {
	if (!deletingHistoria.value) return
	try {
		const res = await api.deleteHistoria(deletingHistoria.value.id)
		if (!res.success) throw new Error(res.error)
		historias.value = historias.value.filter((h) => h.id !== deletingHistoria.value!.id)
		toast.success('Historia eliminada')
	} catch (e: any) {
		toast.error(e.message)
	} finally {
		deletingHistoria.value = null
	}
}
async function changeStatus(h: HistoriaUsuario, status: HistoriaUsuario['status']) {
	try {
		const res = await api.updateHistoria(h.id, { status })
		if (!res.success) throw new Error(res.error)
		h.status = status
	} catch (e: any) {
		toast.error(e.message)
	}
}

const title = computed(() => proyecto.value?.name ?? 'Proyecto')

onMounted(async () => {
	await loadAll()
	syncGeneralForm()
	await loadAux()
})
</script>

<template>
  <PageLayout :title="title" :description="proyecto?.description || ''">
    <template #actions>
      <button class="btn btn-ghost btn-sm" @click="router.push('/proyectos')">
        <i class="mdi mdi-arrow-left" /> Volver
      </button>
    </template>

    <div v-if="loading" class="flex justify-center py-20">
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>

    <div v-else-if="proyecto" class="flex flex-col h-full min-h-0">
      <!-- Tabs -->
      <div class="flex gap-1 border-b border-base-300 mb-4 shrink-0">
        <button
          v-for="t in tabs"
          :key="t.key"
          class="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors"
          :class="tab === t.key ? 'border-primary text-primary' : 'border-transparent text-base-content/50 hover:text-base-content'"
          @click="tab = t.key"
        >
          <i class="mdi" :class="t.icon" /> {{ t.label }}
        </button>
      </div>

      <!-- General -->
      <div v-if="tab === 'general'" class="max-w-2xl space-y-3">
        <div>
          <label class="text-sm text-base-content/70">Nombre</label>
          <input v-model="generalForm.name" class="input input-bordered w-full" :disabled="!canManage" />
        </div>
        <div>
          <label class="text-sm text-base-content/70">Descripción</label>
          <textarea v-model="generalForm.description" class="textarea textarea-bordered w-full" rows="2" :disabled="!canManage" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-sm text-base-content/70">ID Clarify</label>
            <input v-model="generalForm.clarifyProjectId" class="input input-bordered w-full" :disabled="!canManage" />
          </div>
          <div>
            <label class="text-sm text-base-content/70">Estado</label>
            <input v-model="generalForm.status" class="input input-bordered w-full" :disabled="!canManage" />
          </div>
        </div>
        <div>
          <label class="text-sm text-base-content/70">Arquitectura</label>
          <textarea v-model="generalForm.architecture" class="textarea textarea-bordered w-full" rows="2" :disabled="!canManage" />
        </div>
        <div>
          <label class="text-sm text-base-content/70">Lenguaje de programación</label>
          <input v-model="generalForm.programmingLanguage" class="input input-bordered w-full" :disabled="!canManage" />
        </div>
        <div>
          <label class="text-sm text-base-content/70">Agente del chat</label>
          <select v-model="generalForm.chatAgentId" class="select select-bordered w-full" :disabled="!canManage">
            <option :value="null">(primer agente disponible)</option>
            <option v-for="a in agents" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </div>
        <button v-if="canManage" class="btn btn-primary btn-sm" :disabled="savingGeneral" @click="saveGeneral">
          {{ savingGeneral ? 'Guardando...' : 'Guardar cambios' }}
        </button>
      </div>

      <!-- Servicios -->
      <div v-else-if="tab === 'servicios'" class="space-y-3">
        <div class="flex justify-end">
          <button v-if="canManage" class="btn btn-primary btn-sm" @click="openCreateServicio">
            <i class="mdi mdi-plus" /> Agregar servicio
          </button>
        </div>
        <p v-if="servicios.length === 0" class="text-center text-base-content/50 py-10">Sin servicios/repos registrados.</p>
        <div
          v-for="s in servicios"
          :key="s.id"
          class="bg-base-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between"
        >
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h4 class="font-semibold">{{ s.name }}</h4>
              <span v-if="s.governanceType" class="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{{ s.governanceType }}</span>
            </div>
            <p class="text-xs text-base-content/50 truncate">{{ s.repoUrl }}</p>
            <div class="flex gap-4 mt-1 text-xs">
              <span>AGENT.md: <b :class="fileStatusMeta[s.agentMdStatus].cls">{{ fileStatusMeta[s.agentMdStatus].label }}</b></span>
              <span>CLAUDE.md: <b :class="fileStatusMeta[s.claudeMdStatus].cls">{{ fileStatusMeta[s.claudeMdStatus].label }}</b></span>
            </div>
          </div>
          <div class="flex gap-1.5 shrink-0">
            <button class="btn btn-ghost btn-xs" :disabled="repoBusy === s.id" @click="verifyServicio(s)">
              <i class="mdi mdi-magnify" /> Verificar
            </button>
            <button v-if="canManage" class="btn btn-ghost btn-xs" :disabled="repoBusy === s.id" @click="applyingServicio = s">
              <i class="mdi mdi-content-save-edit" /> Aplicar
            </button>
            <button v-if="canManage" class="btn btn-ghost btn-xs" @click="openEditServicio(s)"><i class="mdi mdi-pencil" /></button>
            <button v-if="canManage" class="btn btn-ghost btn-xs text-error" @click="deletingServicio = s"><i class="mdi mdi-delete" /></button>
          </div>
        </div>
      </div>

      <!-- Interesados -->
      <div v-else-if="tab === 'interesados'" class="space-y-3 max-w-2xl">
        <p class="text-sm text-base-content/50">Los interesados son usuarios existentes del sistema. Cada uno tiene su propio chat del proyecto.</p>
        <div v-if="canManage" class="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end bg-base-200 rounded-xl p-3">
          <div class="flex-1">
            <label class="text-sm text-base-content/70">Usuario</label>
            <select v-model="addUserId" class="select select-bordered w-full">
              <option value="">Selecciona un usuario...</option>
              <option v-for="u in availableUsers" :key="u.id" :value="u.id">{{ userLabel(u) }}</option>
            </select>
          </div>
          <div class="w-full sm:w-48">
            <label class="text-sm text-base-content/70">Rol (opcional)</label>
            <input v-model="addRole" class="input input-bordered w-full" placeholder="Ej. Product Owner" />
          </div>
          <button class="btn btn-primary btn-sm" :disabled="savingInteresado || !addUserId" @click="addInteresado">
            <i class="mdi mdi-account-plus" /> Agregar
          </button>
        </div>

        <p v-if="participantes.length === 0" class="text-center text-base-content/50 py-10">Sin interesados registrados.</p>
        <div
          v-for="p in participantes"
          :key="p.id"
          class="bg-base-200 rounded-xl p-4 flex items-center gap-3 justify-between"
        >
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
              {{ (participanteLabel(p)[0] || '?').toUpperCase() }}
            </div>
            <div class="min-w-0">
              <p class="font-medium truncate">{{ participanteLabel(p) }}</p>
              <p class="text-xs text-base-content/50 truncate">{{ p.email }}<span v-if="p.role"> · {{ p.role }}</span></p>
            </div>
          </div>
          <button v-if="canManage" class="btn btn-ghost btn-xs text-error" @click="removingInteresado = p">
            <i class="mdi mdi-account-remove" />
          </button>
        </div>
      </div>

      <!-- Historias de usuario -->
      <div v-else-if="tab === 'historias'" class="space-y-3">
        <div class="flex justify-end">
          <button v-if="canManage" class="btn btn-primary btn-sm" @click="openCreateHistoria">
            <i class="mdi mdi-plus" /> Nueva historia
          </button>
        </div>
        <p v-if="historias.length === 0" class="text-center text-base-content/50 py-10">Sin historias de usuario. Créalas aquí o desde el chat.</p>
        <div v-for="h in historias" :key="h.id" class="bg-base-200 rounded-xl p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span v-if="h.code" class="text-xs font-mono text-base-content/50">{{ h.code }}</span>
                <h4 class="font-semibold">{{ h.title }}</h4>
              </div>
              <p v-if="h.description" class="text-sm text-base-content/60 mt-1 whitespace-pre-wrap">{{ h.description }}</p>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <select
                :value="h.status"
                class="select select-bordered select-xs"
                :disabled="!canManage"
                @change="changeStatus(h, ($event.target as HTMLSelectElement).value as HistoriaUsuario['status'])"
              >
                <option v-for="(label, value) in statusLabels" :key="value" :value="value">{{ label }}</option>
              </select>
              <button v-if="canManage" class="btn btn-ghost btn-xs" @click="openEditHistoria(h)"><i class="mdi mdi-pencil" /></button>
              <button v-if="canManage" class="btn btn-ghost btn-xs text-error" @click="deletingHistoria = h"><i class="mdi mdi-delete" /></button>
            </div>
          </div>
        </div>
      </div>

      <!-- Chat -->
      <div v-else-if="tab === 'chat'" class="flex-1 min-h-0">
        <ProyectoChatPanel :proyecto-id="proyectoId" @changed="reloadHistorias" />
      </div>
    </div>

    <!-- Modales servicio -->
    <AppModal v-if="servicioModal" :title="servicioForm.id ? 'Editar servicio' : 'Agregar servicio'" @close="servicioModal = false">
      <div class="space-y-3">
        <div>
          <label class="text-sm text-base-content/70">Nombre *</label>
          <input v-model="servicioForm.name" class="input input-bordered w-full" />
        </div>
        <div>
          <label class="text-sm text-base-content/70">URL del repositorio *</label>
          <input v-model="servicioForm.repoUrl" class="input input-bordered w-full" placeholder="https://..." />
        </div>
        <div>
          <label class="text-sm text-base-content/70">Rama / ref (opcional)</label>
          <input v-model="servicioForm.repoRef" class="input input-bordered w-full" placeholder="main" />
        </div>
        <div>
          <label class="text-sm text-base-content/70">Tipo de gobernanza</label>
          <input v-model="servicioForm.governanceType" list="gov-types" class="input input-bordered w-full" placeholder="agentManager" />
          <datalist id="gov-types">
            <option v-for="t in governanceTypes" :key="t" :value="t" />
          </datalist>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <button class="btn btn-ghost btn-sm" @click="servicioModal = false">Cancelar</button>
          <button class="btn btn-primary btn-sm" :disabled="savingServicio" @click="saveServicio">Guardar</button>
        </div>
      </template>
    </AppModal>

    <!-- Modal historia -->
    <AppModal v-if="historiaModal" :title="historiaForm.id ? 'Editar historia' : 'Nueva historia'" @close="historiaModal = false">
      <div class="space-y-3">
        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="text-sm text-base-content/70">Código</label>
            <input v-model="historiaForm.code" class="input input-bordered w-full" placeholder="HU-001" />
          </div>
          <div class="col-span-2">
            <label class="text-sm text-base-content/70">Título *</label>
            <input v-model="historiaForm.title" class="input input-bordered w-full" />
          </div>
        </div>
        <div>
          <label class="text-sm text-base-content/70">Descripción</label>
          <textarea v-model="historiaForm.description" class="textarea textarea-bordered w-full" rows="4" />
        </div>
        <div>
          <label class="text-sm text-base-content/70">Estado</label>
          <select v-model="historiaForm.status" class="select select-bordered w-full">
            <option v-for="(label, value) in statusLabels" :key="value" :value="value">{{ label }}</option>
          </select>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <button class="btn btn-ghost btn-sm" @click="historiaModal = false">Cancelar</button>
          <button class="btn btn-primary btn-sm" :disabled="savingHistoria" @click="saveHistoria">Guardar</button>
        </div>
      </template>
    </AppModal>

    <!-- Confirmaciones -->
    <ConfirmDialog
      v-if="deletingServicio"
      title="Eliminar servicio"
      :message="`¿Eliminar el servicio '${deletingServicio.name}'?`"
      @confirm="deleteServicioConfirmed"
      @cancel="deletingServicio = null"
    />
    <ConfirmDialog
      v-if="deletingHistoria"
      title="Eliminar historia"
      :message="`¿Eliminar la historia '${deletingHistoria.title}'?`"
      @confirm="deleteHistoriaConfirmed"
      @cancel="deletingHistoria = null"
    />
    <ConfirmDialog
      v-if="removingInteresado"
      title="Quitar interesado"
      :message="`¿Quitar a '${participanteLabel(removingInteresado)}' del proyecto? Se eliminará su chat del proyecto.`"
      confirm-label="Quitar"
      @confirm="removeInteresadoConfirmed"
      @cancel="removingInteresado = null"
    />
    <ConfirmDialog
      v-if="applyingServicio"
      title="Escribir archivos en el repo"
      :message="`Se escribirán AGENT.md y CLAUDE.md en '${applyingServicio.repoUrl}'. ¿Continuar?`"
      confirm-label="Escribir"
      :loading="repoBusy === applyingServicio.id"
      @confirm="applyServicioConfirmed"
      @cancel="applyingServicio = null"
    />
  </PageLayout>
</template>
