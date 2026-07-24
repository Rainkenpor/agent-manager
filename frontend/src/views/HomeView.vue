<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import * as api from '@/api/api'
import PageLayout from '@/components/PageLayout.vue'
import { useAuthStore } from '@/store/useAuth'
import { useToastStore } from '@/store/useToast'

const router = useRouter()
const auth = useAuthStore()
const toast = useToastStore()

// ── State ─────────────────────────────────────────────────────────────────────

const releaseNotes = ref<Array<{ version: string; title: string | null; date: string | null; content: string }>>([])
const releaseNotesLoading = ref(false)
const expandedNote = ref<string | null>(null)

const agentsCount = ref<number | null>(null)
const mcpsCount = ref<number | null>(null)
const skillsCount = ref<number | null>(null)
const suggestionsCount = ref<number | null>(null)
const proyectosCount = ref<number | null>(null)
const conversations = ref<any[]>([])
const statsLoading = ref(false)

// ── Computed ──────────────────────────────────────────────────────────────────

const greeting = computed(() => {
	const h = new Date().getHours()
	if (h < 6) return 'Buenas noches'
	if (h < 12) return 'Buenos días'
	if (h < 19) return 'Buenas tardes'
	return 'Buenas noches'
})

const userName = computed(() => {
	const u: any = auth.user
	return u?.fullName || u?.name || u?.username || 'usuario'
})

const today = computed(() => {
	return new Date().toLocaleDateString('es-ES', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	})
})

const latestVersion = computed(() => releaseNotes.value[0]?.version ?? null)

const recentConversations = computed(() => conversations.value.slice(0, 5))

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchReleaseNotes() {
	releaseNotesLoading.value = true
	try {
		const res = await api.getReleaseNotes()
		releaseNotes.value = res.data ?? []
	} catch (e: any) {
		toast.error(e.message)
	} finally {
		releaseNotesLoading.value = false
	}
}

async function fetchStats() {
	statsLoading.value = true
	const tasks: Array<Promise<unknown>> = []

	if (auth.hasResourceAccess('agents')) {
		tasks.push(
			api
				.getAgents()
				.then((r) => {
					agentsCount.value = r.data?.length ?? 0
				})
				.catch(() => {
					agentsCount.value = 0
				})
		)
	}
	if (auth.hasResourceAccess('mcp_servers') || auth.hasResourceAccess('mcps')) {
		tasks.push(
			api
				.getMcpServers()
				.then((r) => {
					mcpsCount.value = r.data?.length ?? 0
				})
				.catch(() => {
					mcpsCount.value = 0
				})
		)
	}
	if (auth.hasResourceAccess('skills')) {
		tasks.push(
			api
				.getSkills()
				.then((r) => {
					skillsCount.value = r.data?.length ?? 0
				})
				.catch(() => {
					skillsCount.value = 0
				})
		)
	}
	if (auth.hasResourceAccess('governance_suggestion')) {
		tasks.push(
			api
				.getGovernanceSuggestions()
				.then((r) => {
					suggestionsCount.value = r.data?.length ?? 0
				})
				.catch(() => {
					suggestionsCount.value = 0
				})
		)
	}
	if (auth.hasResourceAccess('proyectos')) {
		tasks.push(
			api
				.getProyectos()
				.then((r) => {
					proyectosCount.value = r.data?.length ?? 0
				})
				.catch(() => {
					proyectosCount.value = 0
				})
		)
	}
	tasks.push(
		api
			.getConversations()
			.then((r) => {
				conversations.value = r.data ?? []
			})
			.catch(() => {
				conversations.value = []
			})
	)

	await Promise.all(tasks)
	statsLoading.value = false
}

function toggleNote(version: string) {
	expandedNote.value = expandedNote.value === version ? null : version
}

function go(path: string) {
	router.push(path)
}

function formatRelative(iso: string | undefined): string {
	if (!iso) return ''
	const d = new Date(iso)
	const diff = Date.now() - d.getTime()
	const min = Math.floor(diff / 60000)
	if (min < 1) return 'ahora'
	if (min < 60) return `hace ${min} min`
	const hr = Math.floor(min / 60)
	if (hr < 24) return `hace ${hr} h`
	const day = Math.floor(hr / 24)
	if (day < 30) return `hace ${day} d`
	return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

onMounted(() => {
	fetchReleaseNotes()
	fetchStats()
})
</script>

<template>
  <PageLayout title="Dashboard" description="Tu punto de partida en Agent Manager">
    <template #actions>
      <button @click="() => { fetchReleaseNotes(); fetchStats() }"
        class="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-base-200 hover:bg-base-100 text-base-content transition-colors">
        <svg class="w-3.5 h-3.5" :class="releaseNotesLoading || statsLoading ? 'animate-spin' : ''" fill="none"
          viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Actualizar
      </button>
    </template>

    <!-- ── Bento grid ──────────────────────────────────────────────────────── -->
    <div class="grid grid-cols-1 md:grid-cols-4 auto-rows-[minmax(120px,auto)] gap-4">

      <!-- Hero / Welcome (2x1) -->
      <div
        class="md:col-span-2 rounded-2xl p-5 bg-gradient-to-br from-indigo-600/30 via-indigo-700/20 to-base-300 border border-indigo-500/30 flex flex-col justify-between overflow-hidden relative">
        <div class="absolute -right-8 -bottom-8 w-40 h-40 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
        <div class="relative">
          <p class="text-xs text-indigo-300 uppercase tracking-wider font-semibold">{{ greeting }}</p>
          <h2 class="text-2xl font-bold text-base-content mt-1 truncate">{{ userName }} 👋</h2>
          <p class="text-sm text-base-content/60 mt-1 capitalize">{{ today }}</p>
        </div>
        <div v-if="latestVersion" class="relative mt-4 flex items-center gap-2 text-xs">
          <span class="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono">v{{ latestVersion }}</span>
          <span class="text-base-content/60 truncate">Última versión publicada</span>
        </div>
      </div>

      <!-- Release notes (2x2) -->
      <div class="md:col-span-2 md:row-span-2 rounded-2xl bg-base-300 border border-base-300 flex flex-col">
        <header class="flex items-center justify-between gap-3 px-5 py-4 border-b border-base-300">
          <div class="flex items-center gap-2">
            <span class="text-base">🚀</span>
            <h3 class="text-sm font-semibold text-base-content">Últimos cambios</h3>
          </div>
        </header>
        <div v-if="releaseNotesLoading" class="flex-1 flex justify-center items-center py-10">
          <div class="animate-spin w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full" />
        </div>
        <div v-else-if="!releaseNotes.length"
          class="flex-1 flex items-center justify-center px-4 py-10 text-xs text-base-content/50 italic text-center">
          Aún no hay archivos en la carpeta <code class="text-base-content/60">doc/</code>.
        </div>
        <ul v-else class="flex-1 overflow-y-auto divide-y divide-base-300">
          <li v-for="note in releaseNotes.slice(0, 6)" :key="note.version">
            <button @click="toggleNote(note.version)"
              class="w-full flex items-center gap-3 px-5 py-3 hover:bg-base-200/40 transition-colors text-left">
              <span class="font-mono text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 shrink-0">
                v{{ note.version }}
              </span>
              <span class="flex-1 min-w-0 text-sm text-base-content truncate">
                {{ note.title ?? `Versión ${note.version}` }}
              </span>
              <span v-if="note.date" class="text-xs text-base-content/50 font-mono shrink-0 hidden sm:inline">{{
                note.date
              }}</span>
              <svg class="w-4 h-4 text-base-content/50 shrink-0 transition-transform"
                :class="expandedNote === note.version ? 'rotate-180' : ''" fill="none" viewBox="0 0 24 24"
                stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div v-if="expandedNote === note.version" class="px-5 pb-4">
              <pre
                class="text-xs text-base-content whitespace-pre-wrap font-mono leading-relaxed bg-base-300 rounded-lg p-3 border border-base-300">
            {{ note.content }}</pre>
            </div>
          </li>
        </ul>
      </div>

      <!-- Conversaciones recientes (1x2) -->
      <div class="md:col-span-2 rounded-xl bg-base-300 border border-base-300 flex flex-col">
        <header class="flex items-center justify-between gap-2 px-4 py-4 border-b border-base-300">
          <div class="flex items-center gap-2">
            <span class="text-base">💬</span>
            <h3 class="text-sm font-semibold text-base-content">Chats recientes</h3>
          </div>
          <button @click="go('/chat')" class="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">Ver todos
            →</button>
        </header>
        <div v-if="!recentConversations.length"
          class="flex-1 flex flex-col items-center justify-center px-4 py-10 text-center text-xs text-base-content/50">
          <span class="text-3xl mb-2 opacity-50">💭</span>
          <p>Aún no tienes chats</p>
          <button @click="go('/chat')"
            class="mt-3 px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
            Iniciar chat
          </button>
        </div>
        <ul v-else class="flex-1 overflow-y-auto divide-y divide-base-300">
          <li v-for="c in recentConversations" :key="c.id">
            <button @click="go(`/chat?conversation=${c.id}`)"
              class="w-full px-4 py-3 hover:bg-base-200/40 transition-colors text-left">
              <p class="text-sm text-base-content truncate">{{ c.title || 'Sin título' }}</p>
              <p class="text-xs text-base-content/50 mt-0.5">{{ formatRelative(c.updatedAt || c.createdAt) }}</p>
            </button>
          </li>
        </ul>
      </div>

      <!-- Proyectos (1x1) -->
      <button
        v-if="auth.hasResourceAccess('proyectos')"
        class="rounded-xl p-5 bg-base-300 border border-base-300 flex flex-col justify-between text-left hover:bg-base-200/60 transition-colors"
        @click="go('/proyectos')"
      >
        <div class="flex items-center gap-2">
          <span class="text-base">📁</span>
          <h3 class="text-sm font-semibold text-base-content">Proyectos</h3>
        </div>
        <p class="text-3xl font-bold text-base-content mt-2">{{ proyectosCount ?? '—' }}</p>
        <p class="text-xs text-base-content/50">Gestionar proyectos →</p>
      </button>

    </div>
  </PageLayout>
</template>
