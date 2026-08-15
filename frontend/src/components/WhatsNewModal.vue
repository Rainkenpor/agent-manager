<script setup lang="ts">
import { marked } from 'marked'
import { computed, ref, watch } from 'vue'

interface ReleaseNote {
  version: string
  title: string | null
  date: string | null
  content: string
}

const props = defineProps<{
  open: boolean
  version: string
  note?: ReleaseNote | null
}>()

const emit = defineEmits<{ close: [] }>()

/** No todas las versiones tienen video: si no existe el GIF, el modal muestra sólo las notas. */
const gifAvailable = ref(true)
const gifUrl = computed(() => `${import.meta.env.BASE_URL}whats-new/${props.version}.gif`)

watch(gifUrl, () => {
  gifAvailable.value = true
})

/** El título y la fecha ya encabezan el modal: se quitan del markdown para no repetirlos. */
function stripHeading(md: string): string {
  return md
    .replace(/^\s*#\s+.*\r?\n/, '')
    .replace(/^\s*\*\*Fecha\*\*:.*\r?\n/im, '')
    .trimStart()
}

// El contenido viene de los archivos doc/ del propio repositorio, no de entrada de usuario.
const renderedNote = computed(() =>
  props.note?.content ? (marked.parse(stripHeading(props.note.content), { async: false }) as string) : ''
)
</script>

<template>
  <Teleport to="body">
    <transition name="whats-new">
      <div v-if="open" class="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        @click.self="emit('close')">
        <div
          class="w-full max-w-3xl rounded-2xl bg-base-200 border border-base-300 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

          <header class="flex items-center gap-3 px-5 py-4 border-b border-base-300 shrink-0">
            <span class="w-9 h-9 rounded-xl bg-indigo-500/15 flex items-center justify-center shrink-0">
              <i class="mdi mdi-rocket-launch-outline text-lg text-indigo-400" />
            </span>
            <div class="min-w-0 flex-1">
              <h2 class="text-base font-semibold text-base-content truncate">
                {{ note?.title ?? `Novedades de la versión ${version}` }}
              </h2>
              <p class="text-xs text-base-content/50">
                Versión {{ version }}<template v-if="note?.date"> · {{ note.date }}</template>
              </p>
            </div>
            <button
              class="w-8 h-8 rounded-lg text-base-content/50 hover:text-base-content hover:bg-base-300 transition-colors shrink-0"
              title="Cerrar" @click="emit('close')">
              <i class="mdi mdi-close" />
            </button>
          </header>

          <!-- El video va justo después del título y la fecha, y luego las notas -->
          <div class="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
            <img v-if="gifAvailable" :src="gifUrl" :alt="`Novedades de la versión ${version}`"
              class="w-10/12 rounded-xl m-auto border border-base-300 bg-base-300" @error="gifAvailable = false" />

            <div v-if="renderedNote" class="release-note text-sm text-base-content/80" v-html="renderedNote" />
            <p v-else class="text-sm text-base-content/60">Sin notas publicadas para esta versión.</p>
          </div>

          <footer class="flex justify-end gap-3 px-5 py-4 border-t border-base-300 shrink-0">
            <button
              class="px-4 py-2 text-sm rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
              @click="emit('close')">
              Entendido
            </button>
          </footer>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.whats-new-enter-active,
.whats-new-leave-active {
  transition: opacity 0.2s ease;
}

.whats-new-enter-from,
.whats-new-leave-to {
  opacity: 0;
}

.release-note :deep(h1) {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--color-base-content, currentColor);
  margin-bottom: 0.75rem;
}

.release-note :deep(h2) {
  font-size: 0.9rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.6;
  margin: 1.25rem 0 0.5rem;
}

.release-note :deep(h3) {
  font-size: 0.85rem;
  font-weight: 600;
  margin: 1rem 0 0.35rem;
}

.release-note :deep(p) {
  margin: 0.5rem 0;
  line-height: 1.6;
}

.release-note :deep(ul),
.release-note :deep(ol) {
  margin: 0.5rem 0;
  padding-left: 1.1rem;
  list-style: disc;
}

.release-note :deep(ol) {
  list-style: decimal;
}

.release-note :deep(li) {
  margin: 0.3rem 0;
  line-height: 1.55;
}

.release-note :deep(strong) {
  font-weight: 600;
  opacity: 1;
}

.release-note :deep(a) {
  color: rgb(129 140 248);
  text-decoration: underline;
}

.release-note :deep(code) {
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 0.8em;
  padding: 0.1rem 0.3rem;
  border-radius: 0.3rem;
  background: color-mix(in srgb, currentColor 10%, transparent);
}

.release-note :deep(pre) {
  overflow-x: auto;
  padding: 0.75rem;
  border-radius: 0.6rem;
  background: color-mix(in srgb, currentColor 8%, transparent);
}

.release-note :deep(hr) {
  margin: 1rem 0;
  border-color: color-mix(in srgb, currentColor 15%, transparent);
}

.release-note :deep(table) {
  width: 100%;
  font-size: 0.8rem;
  border-collapse: collapse;
}

.release-note :deep(th),
.release-note :deep(td) {
  border: 1px solid color-mix(in srgb, currentColor 15%, transparent);
  padding: 0.35rem 0.5rem;
  text-align: left;
}
</style>
