<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { SystemMetrics } from '@/api/api'
import * as api from '@/api/api'
import PageLayout from '@/components/PageLayout.vue'

interface Sample {
	t: number
	cpu: number
	mem: number
}

const metrics = ref<SystemMetrics | null>(null)
const loading = ref(false)
const error = ref('')
const autoRefresh = ref(true)
const history = ref<Sample[]>([])
const MAX_SAMPLES = 60
let timer: ReturnType<typeof setInterval> | null = null

async function fetchMetrics() {
	loading.value = true
	error.value = ''
	try {
		const res = await api.getSystemMetrics()
		metrics.value = res.data ?? null
		if (metrics.value) {
			history.value.push({
				t: new Date(metrics.value.timestamp).getTime(),
				cpu: metrics.value.cpu.usage,
				mem: metrics.value.memory.usage
			})
			if (history.value.length > MAX_SAMPLES) history.value.splice(0, history.value.length - MAX_SAMPLES)
		}
	} catch (e: any) {
		error.value = e.message
	} finally {
		loading.value = false
	}
}

const CHART_W = 600
const CHART_H = 140

function buildPoints(key: 'cpu' | 'mem'): string {
	const samples = history.value
	if (samples.length === 0) return ''
	const n = samples.length
	const stepX = n > 1 ? CHART_W / (n - 1) : 0
	return samples
		.map((s, i) => {
			const x = n > 1 ? i * stepX : CHART_W / 2
			const y = CHART_H - (Math.min(100, Math.max(0, s[key])) / 100) * CHART_H
			return `${x.toFixed(1)},${y.toFixed(1)}`
		})
		.join(' ')
}

function buildArea(key: 'cpu' | 'mem'): string {
	const line = buildPoints(key)
	if (!line) return ''
	const samples = history.value
	const n = samples.length
	const stepX = n > 1 ? CHART_W / (n - 1) : 0
	const lastX = n > 1 ? (n - 1) * stepX : CHART_W / 2
	const firstX = n > 1 ? 0 : CHART_W / 2
	return `${firstX.toFixed(1)},${CHART_H} ${line} ${lastX.toFixed(1)},${CHART_H}`
}

const cpuPoints = computed(() => buildPoints('cpu'))
const memPoints = computed(() => buildPoints('mem'))
const cpuArea = computed(() => buildArea('cpu'))
const memArea = computed(() => buildArea('mem'))
const hasHistory = computed(() => history.value.length >= 2)

function startTimer() {
	if (timer) return
	timer = setInterval(fetchMetrics, 5000)
}

function stopTimer() {
	if (timer) {
		clearInterval(timer)
		timer = null
	}
}

function toggleAutoRefresh() {
	autoRefresh.value = !autoRefresh.value
	if (autoRefresh.value) startTimer()
	else stopTimer()
}

function barColor(pct: number): string {
	if (pct >= 90) return 'bg-red-500'
	if (pct >= 75) return 'bg-amber-500'
	return 'bg-indigo-500'
}

function fmtBytes(bytes: number): string {
	if (bytes <= 0) return '0 B'
	const units = ['B', 'KB', 'MB', 'GB', 'TB']
	const i = Math.floor(Math.log(bytes) / Math.log(1024))
	return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function fmtUptime(seconds: number): string {
	const d = Math.floor(seconds / 86400)
	const h = Math.floor((seconds % 86400) / 3600)
	const m = Math.floor((seconds % 3600) / 60)
	const parts: string[] = []
	if (d > 0) parts.push(`${d}d`)
	if (h > 0) parts.push(`${h}h`)
	parts.push(`${m}m`)
	return parts.join(' ')
}

const lastUpdated = computed(() => (metrics.value ? new Date(metrics.value.timestamp).toLocaleTimeString() : ''))

onMounted(() => {
	fetchMetrics()
	if (autoRefresh.value) startTimer()
})

onBeforeUnmount(stopTimer)
</script>

<template>
  <PageLayout title="Recursos del servidor" description="Uso de CPU y memoria donde se ejecuta el backend">
    <template #actions>
      <button @click="toggleAutoRefresh"
        class="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-base-200 hover:bg-base-100 text-base-content transition-colors">
        <span class="w-2 h-2 rounded-full" :class="autoRefresh ? 'bg-green-500' : 'bg-base-content/40'" />
        {{ autoRefresh ? 'Auto cada 5s' : 'Auto pausado' }}
      </button>
      <button @click="fetchMetrics"
        class="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-base-200 hover:bg-base-100 text-base-content transition-colors">
        <svg class="w-3.5 h-3.5" :class="loading ? 'animate-spin' : ''" fill="none" viewBox="0 0 24 24"
          stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Actualizar
      </button>
    </template>

    <div v-if="error" class="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-500/30 text-red-400 text-sm">
      {{ error }}
    </div>

    <div v-if="metrics" class="space-y-6">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <!-- CPU -->
        <div class="rounded-2xl p-5 bg-base-300 border border-base-300">
          <div class="flex items-center justify-between mb-3">
            <p class="text-xs text-base-content/60 font-semibold uppercase tracking-wider">CPU</p>
            <span class="text-xs font-mono text-base-content/50">{{ metrics.cpu.cores }} núcleos</span>
          </div>
          <div class="flex items-end justify-between mb-2">
            <span class="text-2xl font-bold font-mono"
              :class="metrics.cpu.usage >= 90 ? 'text-red-400' : metrics.cpu.usage >= 75 ? 'text-amber-400' : 'text-green-500'">
              {{ metrics.cpu.usage }}%
            </span>
            <span class="text-xs text-base-content/50">en uso</span>
          </div>
          <div class="h-2 rounded-full bg-base-100 overflow-hidden mb-3">
            <div class="h-full rounded-full transition-all" :class="barColor(metrics.cpu.usage)"
              :style="{ width: `${metrics.cpu.usage}%` }" />
          </div>
          <p class="text-xs text-base-content/40 truncate" :title="metrics.cpu.model">{{ metrics.cpu.model }}</p>
          <p class="text-xs text-base-content/40 mt-1">
            Carga: {{ metrics.cpu.loadAvg.map((l) => l.toFixed(2)).join(' / ') }}
          </p>
        </div>

        <!-- Memory -->
        <div class="rounded-2xl p-5 bg-base-300 border border-base-300">
          <div class="flex items-center justify-between mb-3">
            <p class="text-xs text-base-content/60 font-semibold uppercase tracking-wider">Memoria</p>
            <span class="text-xs font-mono text-base-content/50">{{ fmtBytes(metrics.memory.total) }}</span>
          </div>
          <div class="flex items-end justify-between mb-2">
            <span class="text-2xl font-bold font-mono"
              :class="metrics.memory.usage >= 90 ? 'text-red-400' : metrics.memory.usage >= 75 ? 'text-amber-400' : 'text-green-500'">
              {{ metrics.memory.usage }}%
            </span>
            <span class="text-xs text-base-content/50">en uso</span>
          </div>
          <div class="h-2 rounded-full bg-base-100 overflow-hidden mb-3">
            <div class="h-full rounded-full transition-all" :class="barColor(metrics.memory.usage)"
              :style="{ width: `${metrics.memory.usage}%` }" />
          </div>
          <div class="flex justify-between items-center text-xs">
            <span class="text-base-content/50">Usado {{ fmtBytes(metrics.memory.used) }}</span>
            <span class="text-base-content/60">Libre {{ fmtBytes(metrics.memory.free) }}</span>
          </div>
        </div>
      </div>

      <!-- Time-series chart -->
      <div class="rounded-2xl p-5 bg-base-300 border border-base-300">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold text-base-content">Histórico en el tiempo</h3>
          <div class="flex items-center gap-4 text-xs">
            <span class="flex items-center gap-1.5"><span class="w-3 h-0.5 rounded-full bg-indigo-500" /> CPU</span>
            <span class="flex items-center gap-1.5"><span class="w-3 h-0.5 rounded-full bg-emerald-500" /> Memoria</span>
          </div>
        </div>
        <div v-if="hasHistory" class="relative">
          <svg :viewBox="`0 0 ${CHART_W} ${CHART_H}`" preserveAspectRatio="none" class="w-full h-40">
            <line v-for="p in [0, 25, 50, 75, 100]" :key="p" x1="0" :x2="CHART_W"
              :y1="CHART_H - (p / 100) * CHART_H" :y2="CHART_H - (p / 100) * CHART_H"
              stroke="currentColor" stroke-width="0.5" class="text-base-content/10" />
            <polygon :points="memArea" fill="rgb(16 185 129 / 0.12)" />
            <polygon :points="cpuArea" fill="rgb(99 102 241 / 0.12)" />
            <polyline :points="memPoints" fill="none" stroke="rgb(16 185 129)" stroke-width="1.5"
              stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
            <polyline :points="cpuPoints" fill="none" stroke="rgb(99 102 241)" stroke-width="1.5"
              stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
          </svg>
          <div class="flex flex-col justify-between absolute -left-1 top-0 h-40 -translate-x-full pr-2 text-[10px] text-base-content/40">
            <span>100%</span><span>50%</span><span>0%</span>
          </div>
        </div>
        <p v-else class="text-xs text-base-content/40 py-8 text-center">
          Recopilando datos… la gráfica aparecerá tras la segunda muestra.
        </p>
        <p class="text-[10px] text-base-content/40 mt-2 text-right">
          Últimas {{ history.length }} muestras (máx. {{ MAX_SAMPLES }})
        </p>
      </div>

      <!-- Process & host details -->
      <div>
        <h3 class="text-sm font-semibold text-base-content mb-3">Proceso del backend</h3>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div class="rounded-xl p-4 bg-base-200 border border-base-300">
            <p class="text-xs text-base-content/50 mb-1">Memoria RSS</p>
            <p class="text-lg font-mono font-semibold">{{ fmtBytes(metrics.memory.process.rss) }}</p>
          </div>
          <div class="rounded-xl p-4 bg-base-200 border border-base-300">
            <p class="text-xs text-base-content/50 mb-1">Heap usado</p>
            <p class="text-lg font-mono font-semibold">{{ fmtBytes(metrics.memory.process.heapUsed) }}</p>
          </div>
          <div class="rounded-xl p-4 bg-base-200 border border-base-300">
            <p class="text-xs text-base-content/50 mb-1">Heap total</p>
            <p class="text-lg font-mono font-semibold">{{ fmtBytes(metrics.memory.process.heapTotal) }}</p>
          </div>
          <div class="rounded-xl p-4 bg-base-200 border border-base-300">
            <p class="text-xs text-base-content/50 mb-1">Tiempo activo</p>
            <p class="text-lg font-mono font-semibold">{{ fmtUptime(metrics.processUptime) }}</p>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap gap-x-6 gap-y-2 text-xs text-base-content/50">
        <span><span class="text-base-content/40">Host:</span> {{ metrics.hostname }}</span>
        <span><span class="text-base-content/40">Plataforma:</span> {{ metrics.platform }}</span>
        <span><span class="text-base-content/40">Uptime del sistema:</span> {{ fmtUptime(metrics.uptime) }}</span>
        <span v-if="lastUpdated"><span class="text-base-content/40">Actualizado:</span> {{ lastUpdated }}</span>
      </div>
    </div>

    <div v-else-if="!error" class="text-sm text-base-content/50">Cargando métricas…</div>
  </PageLayout>
</template>
