<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterView } from 'vue-router'
import * as api from '@/api/api'
import { useAuthStore } from '@/store/useAuth'
import AgentLogsPanel from './AgentLogsPanel.vue'
import SidebarNav from './SidebarNav.vue'
import WhatsNewModal from './WhatsNewModal.vue'

const auth = useAuthStore()

/** Versión anunciada al entrar. Al publicar una nueva, cambiar aquí y dejar su GIF en public/whats-new/. */
const WHATS_NEW_VERSION = '2.1.0'
const STORAGE_KEY = 'whatsNewSeen'

const showWhatsNew = ref(false)
const whatsNewNote = ref<any>(null)

onMounted(async () => {
	// Se anuncia una única vez por versión: quien ya la vio no vuelve a encontrarlo.
	if (localStorage.getItem(STORAGE_KEY) === WHATS_NEW_VERSION) return
	try {
		const res = await api.getReleaseNotes()
		whatsNewNote.value = (res.data ?? []).find((n: any) => n.version === WHATS_NEW_VERSION) ?? null
	} catch {
		whatsNewNote.value = null
	}
	showWhatsNew.value = true
})

function dismissWhatsNew() {
	localStorage.setItem(STORAGE_KEY, WHATS_NEW_VERSION)
	showWhatsNew.value = false
}
</script>

<template>
  <div class="flex flex-col h-screen p-4 gap-2 bg-base-300">
    <div class="flex flex-1 gap-4 overflow-hidden min-h-0">
      <SidebarNav />
      <main class="flex-1 overflow-auto flex flex-col gap-2  bg-base-200 rounded-xl shadow-2xl">
        <div class="flex-1 overflow-auto">
          <RouterView />
        </div>
        <AgentLogsPanel v-if="auth.hasPermission('log_streams', 'read')" />
      </main>
    </div>
    <WhatsNewModal :open="showWhatsNew" :version="WHATS_NEW_VERSION" :note="whatsNewNote" @close="dismissWhatsNew" />
  </div>
</template>
