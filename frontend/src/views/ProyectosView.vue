<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { Proyecto } from '@/api/api'
import * as api from '@/api/api'
import AppModal from '@/components/AppModal.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import PageLayout from '@/components/PageLayout.vue'
import { useAuthStore } from '@/store/useAuth'
import { useToastStore } from '@/store/useToast'

const router = useRouter()
const auth = useAuthStore()
const toast = useToastStore()

const proyectos = ref<Proyecto[]>([])
const loading = ref(true)

const showModal = ref(false)
const saving = ref(false)
const form = ref<Partial<Proyecto>>({})

const deleting = ref<Proyecto | null>(null)
const deleteLoading = ref(false)

const canManage = auth.hasResourceManageAccess('proyectos')

async function load() {
	loading.value = true
	try {
		const res = await api.getProyectos()
		proyectos.value = res.data ?? []
	} catch (e: any) {
		toast.error(e.message)
	} finally {
		loading.value = false
	}
}

function openCreate() {
	form.value = { name: '', description: '', status: 'active' }
	showModal.value = true
}

async function save() {
	if (!form.value.name?.trim()) {
		toast.error('El nombre es obligatorio')
		return
	}
	saving.value = true
	try {
		const res = await api.createProyecto(form.value)
		if (!res.success) throw new Error(res.error)
		toast.success('Proyecto creado')
		showModal.value = false
		if (res.data) router.push(`/proyectos/${res.data.id}`)
	} catch (e: any) {
		toast.error(e.message)
	} finally {
		saving.value = false
	}
}

async function doDelete() {
	if (!deleting.value) return
	deleteLoading.value = true
	try {
		const res = await api.deleteProyecto(deleting.value.id)
		if (!res.success) throw new Error(res.error)
		toast.success('Proyecto eliminado')
		deleting.value = null
		await load()
	} catch (e: any) {
		toast.error(e.message)
	} finally {
		deleteLoading.value = false
	}
}

onMounted(load)
</script>

<template>
  <PageLayout title="Proyectos" description="Gestiona proyectos, su configuración y su información en JSON">
    <template #actions>
      <button v-if="canManage" class="btn btn-primary btn-sm" @click="openCreate">
        <i class="mdi mdi-plus" /> Nuevo proyecto
      </button>
    </template>

    <div v-if="loading" class="flex justify-center py-20">
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>

    <div v-else-if="proyectos.length === 0" class="text-center py-20 text-base-content/50">
      <i class="mdi mdi-folder-open-outline text-5xl block mb-3" />
      <p>No hay proyectos todavía.</p>
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      <button
        v-for="p in proyectos"
        :key="p.id"
        class="text-left bg-base-200 rounded-xl p-5 hover:bg-base-300/60 transition-colors border border-base-300/40"
        @click="router.push(`/proyectos/${p.id}`)"
      >
        <div class="flex items-start justify-between gap-2">
          <h3 class="font-semibold text-base-content">{{ p.name }}</h3>
          <span class="text-[10px] uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary">{{ p.status }}</span>
        </div>
        <p class="text-sm text-base-content/60 mt-1 line-clamp-2">{{ p.description || 'Sin descripción' }}</p>
        <div class="flex flex-wrap gap-2 mt-3 text-xs text-base-content/50">
          <span><i class="mdi mdi-clipboard-text-outline" /> {{ (p.data?.historiasUsuario?.length ?? 0) }} historia(s)</span>
        </div>
      </button>
    </div>

    <AppModal v-if="showModal" title="Nuevo proyecto" size="lg" @close="showModal = false">
      <div class="space-y-3">
        <div>
          <label class="text-sm text-base-content/70">Nombre *</label>
          <input v-model="form.name" class="input input-bordered w-full" placeholder="Nombre del proyecto" />
        </div>
        <div>
          <label class="text-sm text-base-content/70">Descripción</label>
          <textarea v-model="form.description" class="textarea textarea-bordered w-full" rows="2" />
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <button class="btn btn-ghost btn-sm" @click="showModal = false">Cancelar</button>
          <button class="btn btn-primary btn-sm" :disabled="saving" @click="save">
            {{ saving ? 'Guardando...' : 'Crear' }}
          </button>
        </div>
      </template>
    </AppModal>

    <ConfirmDialog
      v-if="deleting"
      title="Eliminar proyecto"
      :message="`¿Eliminar el proyecto '${deleting.name}'? Se eliminará también su información en JSON.`"
      :loading="deleteLoading"
      @confirm="doDelete"
      @cancel="deleting = null"
    />
  </PageLayout>
</template>
