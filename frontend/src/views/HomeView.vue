<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import * as api from '@/api/api'
import PageLayout from '@/components/PageLayout.vue'
import { useAuthStore } from '@/store/useAuth'
import { useToastStore } from '@/store/useToast'

const auth = useAuthStore()
const toast = useToastStore()

// ── State ─────────────────────────────────────────────────────────────────────

const releaseNotes = ref<Array<{ version: string; title: string | null; date: string | null; content: string }>>([])
const releaseNotesLoading = ref(false)
const expandedNote = ref<string | null>(null)

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

// ── Conexión MCP ──────────────────────────────────────────────────────────────

const MCP_URL = 'https://agent-manager.distelsa.net/mcp'

const mcpSnippets = [
	{ label: 'URL del servidor', value: MCP_URL },
	{ label: 'Claude Code (CLI)', value: `claude mcp add --transport http agent-manager ${MCP_URL}` },
	{
		label: 'Configuración manual',
		value: JSON.stringify({ mcpServers: { 'agent-manager': { type: 'http', url: MCP_URL } } }, null, 2)
	}
]

const copiedSnippet = ref<string | null>(null)

async function copyToClipboard(value: string, label: string) {
	try {
		await navigator.clipboard.writeText(value)
		copiedSnippet.value = label
		setTimeout(() => {
			if (copiedSnippet.value === label) copiedSnippet.value = null
		}, 1500)
	} catch {
		toast.error('No se pudo copiar al portapapeles')
	}
}

function toggleNote(version: string) {
	expandedNote.value = expandedNote.value === version ? null : version
}

onMounted(() => {
	fetchReleaseNotes()
})
</script>

<template>
  <PageLayout title="Dashboard" description="Tu punto de partida en Agent Manager">
    <template #actions>
      <button @click="fetchReleaseNotes"
        class="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-base-200 hover:bg-base-100 text-base-content transition-colors">
        <svg class="w-3.5 h-3.5" :class="releaseNotesLoading ? 'animate-spin' : ''" fill="none"
          viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Actualizar
      </button>
    </template>

    <!-- ── Bento grid ──────────────────────────────────────────────────────── -->
    <div class="grid grid-cols-1 md:grid-cols-4 auto-rows-[minmax(120px,auto)] gap-4">

      <!-- Hero / Welcome (2x1) — self-start para que no lo estire el card de cambios al expandirse -->
      <div
        class="md:col-span-2 self-start rounded-2xl p-5 bg-gradient-to-br from-indigo-600/30 via-indigo-700/20 to-base-300 border border-indigo-500/30 flex flex-col justify-between overflow-hidden relative">
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

      <!-- Release notes (2x2) — altura acotada: el detalle desplaza dentro, no estira la fila -->
      <div
        class="md:col-span-2 md:row-span-2 md:max-h-[30rem] min-h-0 rounded-2xl bg-base-300 border border-base-300 flex flex-col overflow-hidden">
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
        <ul v-else class="flex-1 min-h-0 overflow-y-auto divide-y divide-base-300">
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
                class="text-xs text-base-content whitespace-pre-wrap font-mono leading-relaxed bg-base-200/60 rounded-lg p-3 border border-base-300 max-h-64 overflow-y-auto">{{ note.content }}</pre>
            </div>
          </li>
        </ul>
      </div>

      <!-- Conexión MCP (2x1) -->
      <div class="md:col-span-2 rounded-xl bg-base-300 border border-base-300 flex flex-col">
        <header class="flex items-center gap-2 px-4 py-4 border-b border-base-300">
          <span class="text-base">🔌</span>
          <h3 class="text-sm font-semibold text-base-content">Conéctate por MCP</h3>
        </header>

        <div class="p-4 space-y-3">
          <p class="text-xs text-base-content/60">
            Usa los agentes y herramientas de Agent Manager desde tu cliente MCP (Claude Code, Claude Desktop, Cursor…).
            El transporte es <span class="text-base-content/80">Streamable HTTP</span> y la autenticación se hace en el
            navegador con tu misma cuenta; sólo verás lo que tu rol permite.
          </p>

          <div v-for="snippet in mcpSnippets" :key="snippet.label">
            <p class="text-[11px] uppercase tracking-wider text-base-content/40 mb-1">{{ snippet.label }}</p>
            <div class="flex items-start gap-2 rounded-lg bg-base-200/60 border border-base-300 px-3 py-2">
              <pre
                class="flex-1 min-w-0 overflow-x-auto text-xs font-mono text-base-content leading-relaxed">{{ snippet.value }}</pre>
              <button @click="copyToClipboard(snippet.value, snippet.label)"
                class="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-base-content/50 hover:text-base-content hover:bg-base-100 transition-colors"
                :title="`Copiar ${snippet.label}`">
                <span class="mdi" :class="copiedSnippet === snippet.label ? 'mdi-check text-success' : 'mdi-content-copy'" />
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  </PageLayout>
</template>
