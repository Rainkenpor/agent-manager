<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import * as api from '@/api/api'
import PageLayout from '@/components/PageLayout.vue'
import WhatsNewModal from '@/components/WhatsNewModal.vue'
import { useAuthStore } from '@/store/useAuth'
import { useToastStore } from '@/store/useToast'

const auth = useAuthStore()
const toast = useToastStore()

// ── State ─────────────────────────────────────────────────────────────────────

interface ReleaseNote {
  version: string
  title: string | null
  date: string | null
  content: string
}

const releaseNotes = ref<ReleaseNote[]>([])
const releaseNotesLoading = ref(false)

// Cada versión abre el modal de novedades, con su video si lo tiene.
const openedNote = ref<ReleaseNote | null>(null)

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

onMounted(() => {
  fetchReleaseNotes()
})
</script>

<template>
  <PageLayout>
    <!-- <template #actions>
      <button @click="fetchReleaseNotes"
        class="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-base-200 hover:bg-base-100 text-base-content transition-colors">
        <svg class="w-3.5 h-3.5" :class="releaseNotesLoading ? 'animate-spin' : ''" fill="none"
          viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Actualizar
      </button>
    </template> -->

    <!-- ── Bento grid ──────────────────────────────────────────────────────── -->
    <div class="grid grid-cols-1 md:grid-cols-4 auto-rows-[minmax(120px,auto)] gap-4">

      <!-- Hero / Welcome (2x1) — self-start para que no lo estire el card de cambios -->
      <div class="hero-card card-reveal md:col-span-2 self-start relative overflow-hidden rounded-2xl p-6
          border border-indigo-500/25" style="--d: 0ms">
        <div class="hero-aurora pointer-events-none" />
        <div class="hero-orb pointer-events-none" />

        <div class="relative">
          <p
            class="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] font-semibold text-indigo-400">
            <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 pulse-dot" />
            {{ greeting }}
          </p>
          <h2 class="mt-2 text-3xl font-bold tracking-tight truncate">
            <span class="name-gradient">{{ userName }}</span>
            <span class="wave inline-block ml-1">👋</span>
          </h2>
          <p class="text-sm text-base-content/55 mt-1.5 capitalize">{{ today }}</p>
        </div>

        <div v-if="latestVersion" class="relative mt-6 flex items-center gap-2 text-xs">
          <span class="px-2.5 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 font-mono
              shimmer">
            v{{ latestVersion }}
          </span>
          <span class="text-base-content/50 truncate">Última versión publicada</span>
        </div>
      </div>

      <!-- Release notes (2x2) — altura acotada: la lista desplaza dentro, no estira la fila -->
      <div class="glass-card card-reveal md:col-span-2 md:row-span-2 md:max-h-[30rem] min-h-0 rounded-2xl
          flex flex-col overflow-hidden" style="--d: 90ms">
        <header class="flex items-center justify-between gap-3 px-5 py-4 border-b border-base-content/8">
          <div class="flex items-center gap-2.5">
            <span class="icon-chip">🚀</span>
            <h3 class="text-sm font-semibold text-base-content">Últimos cambios</h3>
          </div>
          <span v-if="releaseNotes.length" class="text-[11px] text-base-content/35">
            {{ Math.min(6, releaseNotes.length) }} de {{ releaseNotes.length }} versiones
          </span>
        </header>

        <div v-if="releaseNotesLoading" class="flex-1 flex flex-col justify-center gap-2 px-5 py-6">
          <div v-for="n in 4" :key="n" class="h-9 rounded-lg bg-base-content/5 skeleton-pulse"
            :style="`--d: ${n * 90}ms`" />
        </div>
        <div v-else-if="!releaseNotes.length"
          class="flex-1 flex items-center justify-center px-4 py-10 text-xs text-base-content/50 italic text-center">
          Aún no hay archivos en la carpeta <code class="text-base-content/60">doc/</code>.
        </div>
        <ul v-else class="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
          <li v-for="(note, i) in releaseNotes.slice(0, 6)" :key="note.version" class="row-reveal"
            :style="`--d: ${140 + i * 55}ms`">
            <button @click="openedNote = note"
              class="note-row group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left">
              <span class="note-pill font-mono text-xs px-2 py-0.5 rounded-full shrink-0">v{{ note.version }}</span>
              <span class="flex-1 min-w-0 text-sm text-base-content truncate">
                {{ note.title ?? `Versión ${note.version}` }}
              </span>
              <span v-if="note.date" class="text-xs text-base-content/40 font-mono shrink-0 hidden sm:inline">{{
                note.date
                }}</span>
              <i class="mdi mdi-play-circle text-lg shrink-0 text-base-content/25 transition-all duration-300
                  group-hover:text-indigo-400 group-hover:scale-110" />
            </button>
          </li>
        </ul>
      </div>

      <!-- Conexión MCP (2x1) -->
      <div class="glass-card card-reveal md:col-span-2 rounded-2xl flex flex-col overflow-hidden" style="--d: 180ms">
        <header class="flex items-center gap-2.5 px-5 py-4 border-b border-base-content/8">
          <span class="icon-chip">🔌</span>
          <h3 class="text-sm font-semibold text-base-content">Conéctate por MCP</h3>
        </header>

        <div class="p-5 space-y-3.5">
          <p class="text-xs leading-relaxed text-base-content/55">
            Usa los agentes y herramientas de Agent Manager desde tu cliente MCP (Claude Code, Claude Desktop, Cursor…).
            El transporte es <span class="text-base-content/80 font-medium">Streamable HTTP</span> y la autenticación se
            hace en el navegador con tu misma cuenta; sólo verás lo que tu rol permite.
          </p>

          <div v-for="(snippet, i) in mcpSnippets" :key="snippet.label" class="row-reveal"
            :style="`--d: ${230 + i * 60}ms`">
            <p class="text-[11px] uppercase tracking-wider text-base-content/35 mb-1">{{ snippet.label }}</p>
            <div class="snippet group flex items-start gap-2 rounded-xl px-3 py-2">
              <pre class="flex-1 min-w-0 overflow-x-auto text-xs font-mono text-base-content leading-relaxed">{{
                snippet.value }}</pre>
              <button @click="copyToClipboard(snippet.value, snippet.label)"
                class="copy-btn shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
                :class="copiedSnippet === snippet.label ? 'is-copied' : ''" :title="`Copiar ${snippet.label}`">
                <span class="mdi" :class="copiedSnippet === snippet.label ? 'mdi-check' : 'mdi-content-copy'" />
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>

    <WhatsNewModal v-if="openedNote" :open="true" :version="openedNote.version" :note="openedNote"
      @close="openedNote = null" />
  </PageLayout>
</template>

<style scoped>
/* ── Entrada escalonada ─────────────────────────────────────────────────── */
@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(14px);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

.card-reveal,
.row-reveal {
  animation: rise 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: var(--d, 0ms);
}

/* ── Superficies ────────────────────────────────────────────────────────── */
.glass-card {
  background: color-mix(in srgb, var(--color-base-100, #fff) 70%, transparent);
  border: 1px solid color-mix(in srgb, currentColor 10%, transparent);
  backdrop-filter: blur(10px);
  box-shadow: 0 1px 2px rgb(0 0 0 / 6%), 0 12px 28px -18px rgb(0 0 0 / 45%);
  transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.35s ease, border-color 0.35s ease;
}

.glass-card:hover {
  transform: translateY(-3px);
  border-color: color-mix(in srgb, #6366f1 35%, transparent);
  box-shadow: 0 1px 2px rgb(0 0 0 / 6%), 0 22px 45px -22px rgb(99 102 241 / 45%);
}

.hero-card {
  background:
    radial-gradient(120% 140% at 0% 0%, rgb(99 102 241 / 28%) 0%, transparent 55%),
    radial-gradient(100% 120% at 100% 100%, rgb(168 85 247 / 22%) 0%, transparent 50%),
    color-mix(in srgb, var(--color-base-100, #fff) 75%, transparent);
  backdrop-filter: blur(10px);
  box-shadow: 0 1px 2px rgb(0 0 0 / 6%), 0 16px 36px -22px rgb(99 102 241 / 55%);
  transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.35s ease;
}

.hero-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 1px 2px rgb(0 0 0 / 6%), 0 26px 50px -24px rgb(99 102 241 / 65%);
}

/* Halo que respira detrás del saludo */
@keyframes drift {

  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }

  50% {
    transform: translate3d(-14px, 10px, 0) scale(1.12);
  }
}

.hero-orb {
  position: absolute;
  right: -3rem;
  bottom: -3rem;
  width: 13rem;
  height: 13rem;
  border-radius: 9999px;
  background: rgb(99 102 241 / 30%);
  filter: blur(46px);
  animation: drift 11s ease-in-out infinite;
}

@keyframes sweep {
  from {
    transform: translateX(-30%);
  }

  to {
    transform: translateX(30%);
  }
}

.hero-aurora {
  position: absolute;
  inset: -40% -20%;
  background: conic-gradient(from 210deg, transparent 0deg, rgb(168 85 247 / 14%) 90deg, transparent 200deg);
  transform: translateX(-50%);
  /* animation: sweep 14s ease-in-out infinite alternate; */
}

.name-gradient {
  background: linear-gradient(100deg, #6366f1, #a855f7 55%, #6366f1);
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: sweep-text 6s linear infinite;
}

@keyframes sweep-text {
  to {
    background-position: 200% center;
  }
}

@keyframes wave-hand {

  0%,
  60%,
  100% {
    transform: rotate(0deg);
  }

  70% {
    transform: rotate(16deg);
  }

  80% {
    transform: rotate(-8deg);
  }

  90% {
    transform: rotate(12deg);
  }
}

.wave {
  transform-origin: 70% 70%;
  animation: wave-hand 3.4s ease-in-out infinite;
}

@keyframes pulse-ring {

  0%,
  100% {
    opacity: 1;
    box-shadow: 0 0 0 0 rgb(99 102 241 / 55%);
  }

  50% {
    opacity: 0.7;
    box-shadow: 0 0 0 5px rgb(99 102 241 / 0%);
  }
}

.pulse-dot {
  animation: pulse-ring 2.4s ease-out infinite;
}

/* Brillo que recorre la píldora de versión */
.shimmer {
  position: relative;
  overflow: hidden;
}

.shimmer::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(105deg, transparent 35%, rgb(255 255 255 / 45%) 50%, transparent 65%);
  transform: translateX(-120%);
  animation: shimmer-run 4.5s ease-in-out infinite;
}

@keyframes shimmer-run {

  0%,
  60% {
    transform: translateX(-120%);
  }

  100% {
    transform: translateX(120%);
  }
}

/* ── Detalles ───────────────────────────────────────────────────────────── */
.icon-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 0.6rem;
  font-size: 0.85rem;
  background: color-mix(in srgb, #6366f1 12%, transparent);
  transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}

.glass-card:hover .icon-chip {
  transform: rotate(-8deg) scale(1.08);
}

.note-row {
  transition: background-color 0.25s ease, transform 0.25s cubic-bezier(0.22, 1, 0.36, 1);
}

.note-row:hover {
  background: color-mix(in srgb, #6366f1 8%, transparent);
  transform: translateX(3px);
}

.note-pill {
  background: color-mix(in srgb, #6366f1 12%, transparent);
  color: #6366f1;
  transition: background-color 0.25s ease, color 0.25s ease;
}

.note-row:hover .note-pill {
  background: #6366f1;
  color: #fff;
}

.snippet {
  background: color-mix(in srgb, currentColor 5%, transparent);
  border: 1px solid color-mix(in srgb, currentColor 10%, transparent);
  transition: border-color 0.25s ease, background-color 0.25s ease;
}

.snippet:hover {
  border-color: color-mix(in srgb, #6366f1 35%, transparent);
  background: color-mix(in srgb, #6366f1 6%, transparent);
}

.copy-btn {
  color: color-mix(in srgb, currentColor 50%, transparent);
  transition: transform 0.2s ease, color 0.2s ease, background-color 0.2s ease;
}

.copy-btn:hover {
  color: inherit;
  background: color-mix(in srgb, currentColor 10%, transparent);
  transform: scale(1.1);
}

.copy-btn.is-copied {
  color: #16a34a;
  animation: pop 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes pop {
  50% {
    transform: scale(1.35);
  }
}

@keyframes skeleton {

  0%,
  100% {
    opacity: 0.45;
  }

  50% {
    opacity: 0.9;
  }
}

.skeleton-pulse {
  animation: skeleton 1.4s ease-in-out infinite;
  animation-delay: var(--d, 0ms);
}

@media (prefers-reduced-motion: reduce) {

  .card-reveal,
  .row-reveal,
  .hero-orb,
  .hero-aurora,
  .name-gradient,
  .wave,
  .pulse-dot,
  .shimmer::after,
  .skeleton-pulse {
    animation: none;
  }

  .glass-card,
  .hero-card,
  .note-row,
  .copy-btn {
    transition: none;
  }
}
</style>
