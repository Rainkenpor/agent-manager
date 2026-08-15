<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Proyecto, ProyectoData, ProyectoParticipante } from '@/api/api'
import * as api from '@/api/api'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import PageLayout from '@/components/PageLayout.vue'
import ProyectoChatPanel from '@/components/ProyectoChatPanel.vue'
import ProyectoJsonPanel from '@/components/ProyectoJsonPanel.vue'
import { useAuthStore } from '@/store/useAuth'
import { useToastStore } from '@/store/useToast'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const toast = useToastStore()

const proyectoId = route.params.id as string
const canManage = auth.hasResourceManageAccess('proyectos')

const proyecto = ref<Proyecto | null>(null)
const participantes = ref<ProyectoParticipante[]>([])
const users = ref<any[]>([])
const agents = ref<any[]>([])
const loading = ref(true)

const tab = ref<'general' | 'interesados' | 'chat'>('general')
const tabs = [
	{ key: 'general', label: 'General', icon: 'mdi-information-outline' },
	{ key: 'interesados', label: 'Interesados', icon: 'mdi-account-group' },
	{ key: 'chat', label: 'Chat', icon: 'mdi-chat' }
] as const

async function loadAll() {
	loading.value = true
	try {
		const p = await api.getProyecto(proyectoId)
		if (!p.success || !p.data) throw new Error(p.error || 'Proyecto no encontrado')
		proyecto.value = p.data
	} catch (e: any) {
		toast.error(e.message)
		router.push('/proyectos')
	} finally {
		loading.value = false
	}
}

async function loadAux() {
	try {
		const [ag, us, parts] = await Promise.all([api.getAgents(), api.getUsers(), api.getParticipantes(proyectoId)])
		agents.value = ag.data ?? []
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

/** Recarga el JSON tras un cambio hecho por el agente en el chat. */
async function reloadData() {
	const res = await api.getProyectoData(proyectoId)
	if (res.success && res.data && proyecto.value) proyecto.value = { ...proyecto.value, data: res.data }
}

function onDataSaved(data: ProyectoData) {
	if (proyecto.value) proyecto.value = { ...proyecto.value, data }
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

// ── Configuración ──
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

      <!-- General: configuración | JSON -->
      <div v-if="tab === 'general'" class="flex flex-1 min-h-0 gap-4">
        <div class="w-[26rem] shrink-0 overflow-y-auto pr-1">
          <fieldset class="border border-base-300 rounded-xl p-4 space-y-3">
            <legend class="text-xs font-semibold text-base-content/60 px-1 uppercase tracking-wider">Configuración</legend>
            <div>
              <label class="text-sm text-base-content/70">Nombre</label>
              <input v-model="generalForm.name" class="input input-bordered w-full" :disabled="!canManage" />
            </div>
            <div>
              <label class="text-sm text-base-content/70">Descripción</label>
              <textarea v-model="generalForm.description" class="textarea textarea-bordered w-full" rows="3" :disabled="!canManage" />
            </div>
            <div>
              <label class="text-sm text-base-content/70">Estado</label>
              <input v-model="generalForm.status" class="input input-bordered w-full" :disabled="!canManage" />
            </div>
            <div>
              <label class="text-sm text-base-content/70">Agente del chat</label>
              <select v-model="generalForm.chatAgentId" class="select select-bordered w-full" :disabled="!canManage">
                <option :value="null">(primer agente disponible)</option>
                <option v-for="a in agents" :key="a.id" :value="a.id">{{ a.name }}</option>
              </select>
            </div>
            <button v-if="canManage" class="btn btn-primary btn-sm" :disabled="savingGeneral" @click="saveGeneral">
              <i class="mdi mdi-content-save" /> {{ savingGeneral ? 'Guardando...' : 'Guardar cambios' }}
            </button>
          </fieldset>
        </div>

        <div class="flex-1 min-h-0">
          <ProyectoJsonPanel :proyecto-id="proyectoId" :data="proyecto.data" :can-manage="canManage" @saved="onDataSaved" />
        </div>
      </div>

      <!-- Interesados -->
      <div v-else-if="tab === 'interesados'" class="space-y-3 max-w-2xl overflow-y-auto">
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

      <!-- Chat -->
      <div v-else-if="tab === 'chat'" class="flex-1 min-h-0">
        <ProyectoChatPanel :proyecto-id="proyectoId" @changed="reloadData" />
      </div>
    </div>

    <ConfirmDialog
      v-if="removingInteresado"
      title="Quitar interesado"
      :message="`¿Quitar a '${participanteLabel(removingInteresado)}' del proyecto? Se eliminará su chat del proyecto.`"
      confirm-label="Quitar"
      @confirm="removeInteresadoConfirmed"
      @cancel="removingInteresado = null"
    />
  </PageLayout>
</template>
