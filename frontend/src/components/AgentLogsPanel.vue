<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import * as api from '@/api/api'

interface LogLine {
  id: number
  raw: string
  timestamp: string
  level: string
  message: string
}

let lineCounter = 0
const MAX_LINES = 500

function parseLine(raw: string): LogLine {
  const match = raw.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[(\w+)\]: (.*)$/)
  if (match) {
    return { id: ++lineCounter, raw, timestamp: match[1], level: match[2].toUpperCase(), message: match[3] }
  }
  return { id: ++lineCounter, raw, timestamp: '', level: 'INFO', message: raw }
}

function highlightMessage(msg: string): string {
  return msg
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\[([^\]]+)\]/g, '<span class="text-indigo-400">[$1]</span>')
    .replace(/(→)/g, '<span class="text-emerald-400">$1</span>')
    .replace(/(←)/g, '<span class="text-sky-400">$1</span>')
    .replace(/(START|END|DONE)/g, '<span class="text-violet-400">$1</span>')
    .replace(/(══+)/g, '<span class="text-slate-700">$1</span>')
}

const isOpen = ref(false)
const isPaused = ref(false)
const filter = ref('')
const logs = ref<LogLine[]>([])
const terminalRef = ref<HTMLElement | null>(null)
const isConnected = ref(false)
const abortController = ref<AbortController | null>(null)

const filteredLogs = computed(() => {
  if (!filter.value.trim()) return logs.value
  const q = filter.value.toLowerCase()
  return logs.value.filter((l) => l.raw.toLowerCase().includes(q))
})

function levelClass(level: string) {
  switch (level) {
    case 'ERROR': return 'text-red-400'
    case 'WARN': return 'text-yellow-400'
    case 'DEBUG': return 'text-slate-600'
    default: return 'text-emerald-400'
  }
}

function rowClass(level: string) {
  if (level === 'ERROR') return 'bg-red-950/20'
  return ''
}

async function autoScroll() {
  if (isPaused.value || !isOpen.value) return
  await nextTick()
  if (terminalRef.value) {
    terminalRef.value.scrollTop = terminalRef.value.scrollHeight
  }
}

async function connect() {
  abortController.value?.abort()
  abortController.value = new AbortController()
  isConnected.value = false

  try {
    const response = await api.streamAgentLogs(abortController.value.signal)
    if (!response.ok || !response.body) return

    isConnected.value = true
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

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

        if (event.type === 'history') {
          logs.value = (event.lines as string[]).map(parseLine)
          await autoScroll()
        } else if (event.type === 'line') {
          logs.value.push(parseLine(event.content))
          if (logs.value.length > MAX_LINES) {
            logs.value.splice(0, logs.value.length - MAX_LINES)
          }
          await autoScroll()
        }
      }
    }
  } catch (e: any) {
    if (e.name !== 'AbortError') {
      isConnected.value = false
    }
  }
}

function toggle() {
  isOpen.value = !isOpen.value
  if (isOpen.value) autoScroll()
}

function togglePause() {
  isPaused.value = !isPaused.value
  if (!isPaused.value) autoScroll()
}

function clearLogs() {
  logs.value = []
}

onMounted(connect)
onUnmounted(() => abortController.value?.abort())
</script>

<template>
  <div
    class="shrink-0 flex flex-col rounded-lg bg-slate-900 border border-slate-800 transition-all duration-200 overflow-hidden"
    :style="isOpen ? 'height: 260px' : 'height: 36px'"
  >
    <!-- Header (siempre visible) -->
    <div
      class="flex items-center justify-between px-3 h-9 shrink-0 cursor-pointer select-none"
      :class="isOpen ? 'border-b border-slate-800' : ''"
      @click="toggle"
    >
      <div class="flex items-center gap-2">
        <i class="mdi mdi-text-box-search-outline text-slate-400 text-sm"></i>
        <span class="text-xs font-medium text-slate-300">Agent Logs</span>
        <span
          class="w-1.5 h-1.5 rounded-full"
          :class="isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'"
        ></span>
        <span v-if="logs.length > 0 && !isOpen" class="text-[10px] text-slate-600">
          {{ logs.length }} líneas
        </span>
      </div>

      <div class="flex items-center gap-1" @click.stop>
        <template v-if="isOpen">
          <div class="relative mr-1">
            <i class="mdi mdi-magnify absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs pointer-events-none"></i>
            <input
              v-model="filter"
              placeholder="Filtrar..."
              class="bg-slate-800 border border-slate-700 rounded pl-6 pr-2 py-0.5 text-[11px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500 w-32"
              @click.stop
            />
          </div>

          <button
            @click="togglePause"
            class="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            :title="isPaused ? 'Reanudar auto-scroll' : 'Pausar auto-scroll'"
          >
            <i class="mdi text-sm" :class="isPaused ? 'mdi-play' : 'mdi-pause'"></i>
          </button>

          <button
            @click="clearLogs"
            class="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            title="Limpiar"
          >
            <i class="mdi mdi-trash-can-outline text-sm"></i>
          </button>

          <button
            @click="connect"
            class="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            title="Reconectar"
          >
            <i class="mdi mdi-refresh text-sm"></i>
          </button>
        </template>

        <i
          class="mdi text-slate-500 text-sm ml-1 cursor-pointer"
          :class="isOpen ? 'mdi-chevron-down' : 'mdi-chevron-up'"
          @click="toggle"
        ></i>
      </div>
    </div>

    <!-- Terminal -->
    <div
      v-show="isOpen"
      ref="terminalRef"
      class="flex-1 overflow-y-auto font-mono text-[11px] px-3 py-2 space-y-px"
    >
      <div
        v-if="filteredLogs.length === 0"
        class="flex items-center justify-center h-full text-slate-700 gap-2"
      >
        <i class="mdi mdi-text-box-remove-outline"></i>
        <span>Sin logs disponibles</span>
      </div>

      <div
        v-for="log in filteredLogs"
        :key="log.id"
        class="flex gap-2 px-1 rounded leading-relaxed"
        :class="rowClass(log.level)"
      >
        <span class="text-slate-700 shrink-0 tabular-nums select-none">{{ log.timestamp }}</span>
        <span class="shrink-0 w-12 text-right tabular-nums" :class="levelClass(log.level)">
          [{{ log.level }}]
        </span>
        <span
          class="text-slate-300 break-all"
          v-html="highlightMessage(log.message || log.raw)"
        ></span>
      </div>
    </div>
  </div>
</template>
