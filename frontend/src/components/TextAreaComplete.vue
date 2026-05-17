<template>
  <div :class="`w-auto h-auto relative ${$props.class || ''}`">
    <div ref="containerRef" class="w-full relative">
      <!-- AI toggle button -->
      <div v-show="!showInput && !showResult && !loading"
        class="absolute right-4 px-2 top-2 rounded-2xl bg-sky-600 border border-black cursor-pointer hover:bg-sky-700 opacity-50 z-10"
        @click="showIA">
        <span class="mdi mdi-creation"></span>
      </div>

      <!-- AI request input -->
      <div v-if="showInput && !showResult && !loading"
        class="p-3 absolute top-2 left-2 right-2 bg-neutral-900 rounded-sm z-10">
        <div class="join w-full">
          <label class="input input-sm join-item w-full">
            <span class="mdi mdi-creation text-sky-400"></span>
            <input ref="iaInputRef" type="text" class="grow" placeholder="Escribe aquí tu solicitud a la IA..."
              v-model="IARequest" @keydown.enter.prevent="submitRequest" @keydown.escape="showInput = false" />
          </label>
          <button class="btn btn-sm btn-primary join-item" @click.prevent="submitRequest" :disabled="!IARequest.trim()">
            <span class="mdi mdi-send"></span>
          </button>
          <button class="btn btn-sm join-item rounded-r-sm" @click.prevent.stop="showInput = false">
            <span class="mdi mdi-close-thick"></span>
          </button>
        </div>
      </div>
    </div>

    <!-- Textarea -->
    <textarea v-model="model" :placeholder="placeholder" :rows="$props.rows ?? 10"
      :class="`textarea w-full ${$props.class || ''}`" />

    <!-- Loading state -->
    <div v-if="loading" class="mt-2 bg-neutral-900 border border-neutral-700 rounded-lg p-4">
      <div class="flex items-center gap-3 text-sm text-neutral-400">
        <span class="loading loading-dots loading-sm text-sky-400"></span>
        <span>Procesando solicitud...</span>
        <button class="btn btn-xs btn-ghost ml-auto" @click="cancelRequest">
          <span class="mdi mdi-close"></span> Cancelar
        </button>
      </div>
    </div>

    <!-- Answer panel -->
    <div v-if="showResult && result?.type === 'answer'"
      class="mt-2 bg-neutral-900 border border-neutral-700 rounded-lg overflow-hidden">
      <div class="flex items-center justify-between px-4 py-2 bg-neutral-800 border-b border-neutral-700">
        <span class="text-sm font-medium text-sky-400 flex items-center gap-1">
          <span class="mdi mdi-creation"></span> Respuesta de IA
        </span>
        <button class="btn btn-xs btn-ghost" @click="closeResult">
          <span class="mdi mdi-close"></span>
        </button>
      </div>
      <div class="p-4 text-sm text-neutral-200 whitespace-pre-wrap max-h-64 overflow-y-auto">{{ result.content }}</div>
    </div>

    <!-- Diff / Change panel -->
    <div v-if="showResult && result?.type === 'change'"
      class="mt-2 bg-neutral-900 border border-neutral-700 rounded-lg overflow-hidden">
      <div class="flex items-center justify-between px-4 py-2 bg-neutral-800 border-b border-neutral-700">
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-sm font-medium text-sky-400 flex items-center gap-1 shrink-0">
            <span class="mdi mdi-source-diff"></span> Cambios sugeridos
          </span>
          <span v-if="result.explanation" class="text-xs text-neutral-400 truncate">— {{ result.explanation }}</span>
        </div>
        <div class="flex items-center gap-2 shrink-0 ml-2">
          <button class="btn btn-xs btn-success gap-1" @click="acceptChanges">
            <span class="mdi mdi-check"></span> Aceptar
          </button>
          <button class="btn btn-xs btn-error gap-1" @click="rejectChanges">
            <span class="mdi mdi-close"></span> Rechazar
          </button>
        </div>
      </div>

      <!-- Diff stats -->
      <div class="flex gap-4 px-4 py-1.5 bg-neutral-950 border-b border-neutral-800 text-xs text-neutral-500">
        <span class="text-green-400">+{{ addedCount }} líneas añadidas</span>
        <span class="text-red-400">-{{ removedCount }} líneas eliminadas</span>
      </div>

      <!-- Diff lines -->
      <div class="font-mono text-xs overflow-auto max-h-72">
        <div v-for="(line, i) in diffLines" :key="i" class="flex items-start px-3 py-0.5 leading-5" :class="{
          'bg-green-950/50 text-green-300': line.type === 'added',
          'bg-red-950/50 text-red-300': line.type === 'removed',
          'text-neutral-500': line.type === 'equal',
        }">
          <span class="select-none w-4 shrink-0 text-center opacity-60">
            {{ line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ' }}
          </span>
          <span class="ml-2 whitespace-pre-wrap break-all"
            :class="{ 'line-through opacity-60': line.type === 'removed' }">{{ line.content || ' ' }}</span>
        </div>
      </div>
    </div>

    <!-- Parse / stream error -->
    <div v-if="showResult && result?.type === 'error'"
      class="mt-2 bg-neutral-900 border border-red-800 rounded-lg overflow-hidden">
      <div class="flex items-center justify-between px-4 py-2 bg-neutral-800 border-b border-red-900">
        <span class="text-sm text-red-400 flex items-center gap-1">
          <span class="mdi mdi-alert-circle"></span> Error al procesar la respuesta
        </span>
        <button class="btn btn-xs btn-ghost" @click="closeResult">
          <span class="mdi mdi-close"></span>
        </button>
      </div>
      <pre
        class="p-4 text-xs text-neutral-400 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">{{ result.rawContent }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { blurOn, focusOn } from '@/utils/focus'
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import * as api from '@/api/api'
import { computeDiff, type DiffLine } from '@/utils/diff'

interface AiResult {
  type: 'answer' | 'change' | 'error'
  content?: string
  modified?: string
  explanation?: string
  rawContent?: string
}

const showInput = ref(false)
const loading = ref(false)
const showResult = ref(false)
const containerRef = ref<HTMLElement | null>(null)
const iaInputRef = ref<HTMLInputElement | null>(null)
const IARequest = ref('')
const result = ref<AiResult | null>(null)
const diffLines = ref<DiffLine[]>([])

let abortController: AbortController | null = null

const props = defineProps<{
  placeholder: string
  systemPrompt?: string
  rows?: number
  class?: string
}>()

const model = defineModel<string>()

const addedCount = computed(() => diffLines.value.filter((l) => l.type === 'added').length)
const removedCount = computed(() => diffLines.value.filter((l) => l.type === 'removed').length)

const showIA = () => {
  showInput.value = true
  IARequest.value = ''
  nextTick(() => iaInputRef.value?.focus())
}

const closeResult = () => {
  showResult.value = false
  result.value = null
  diffLines.value = []
  showInput.value = false
}

const cancelRequest = () => {
  abortController?.abort()
  loading.value = false
  showInput.value = false
}

function parseAiResponse(raw: string): AiResult {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  try {
    const parsed = JSON.parse(cleaned)
    if (parsed.type === 'answer' || parsed.type === 'change') return parsed as AiResult
    return { type: 'error', rawContent: raw }
  } catch {
    return { type: 'error', rawContent: raw }
  }
}

const submitRequest = async () => {
  const req = IARequest.value.trim()
  if (!req) return

  showInput.value = false
  loading.value = true
  showResult.value = false
  result.value = null
  diffLines.value = []

  abortController = new AbortController()

  try {
    const response = await api.streamAiAssist(model.value ?? '', req, props.systemPrompt, abortController.signal)
    if (!response.body) throw new Error('No response body')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullContent = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''

      for (const part of parts) {
        const line = part.trim()
        if (!line.startsWith('data: ')) continue
        const event = JSON.parse(line.slice(6))
        if (event.type === 'chunk') {
          fullContent += event.content as string
        } else if (event.type === 'done') {
          fullContent = (event.content as string) || fullContent
        } else if (event.type === 'error') {
          throw new Error(event.error as string)
        }
      }
    }

    const parsed = parseAiResponse(fullContent)
    result.value = parsed

    if (parsed.type === 'change' && parsed.modified !== undefined) {
      diffLines.value = computeDiff(model.value ?? '', parsed.modified)
    }

    showResult.value = true
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      result.value = { type: 'error', rawContent: (err as Error).message }
      showResult.value = true
    }
  } finally {
    loading.value = false
    abortController = null
  }
}

const acceptChanges = () => {
  if (result.value?.modified !== undefined) {
    model.value = result.value.modified
  }
  closeResult()
}

const rejectChanges = () => {
  closeResult()
}

onMounted(() => {
  focusOn(containerRef, showInput)
})
onUnmounted(() => {
  abortController?.abort()
  blurOn(containerRef, showInput)
})
</script>
