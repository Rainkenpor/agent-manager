<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import * as api from '@/api/api'
import PageLayout from '@/components/PageLayout.vue'

interface Period {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  callCount: number
}

interface DailyMetric {
  date: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  callCount: number
}

interface ModelMetric {
  model: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  callCount: number
}

interface TokenMetrics {
  today: Period
  currentMonth: Period
  currentYear: Period
  allTime: Period
  last30Days: DailyMetric[]
  byModel: ModelMetric[]
}

interface CodexUsageWindow {
  usedPercent: number
  remainingPercent: number
  limitWindowSeconds: number
  resetAfterSeconds: number
  resetAt: number
}

interface CodexUsage {
  planType: string | null
  limitReached: boolean
  primaryWindow: CodexUsageWindow | null
  secondaryWindow: CodexUsageWindow | null
}

const metrics = ref<TokenMetrics | null>(null)
const loading = ref(false)
const error = ref('')

const codexUsage = ref<CodexUsage | null>(null)
const codexError = ref('')

async function fetchMetrics() {
  loading.value = true
  error.value = ''
  try {
    const res = await api.getTokenMetrics()
    metrics.value = res.data ?? null
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function fetchCodexUsage() {
  codexError.value = ''
  try {
    const res = await api.getCodexUsage()
    codexUsage.value = res.data ?? null
  } catch (e: any) {
    codexError.value = e.message
    codexUsage.value = null
  }
}

function refreshAll() {
  fetchMetrics()
  fetchCodexUsage()
}

function windowLabel(seconds: number): string {
  if (seconds >= 604800) return `Semanal (${Math.round(seconds / 86400)}d)`
  if (seconds >= 86400) return `Diario (${Math.round(seconds / 86400)}d)`
  if (seconds >= 3600) return `${Math.round(seconds / 3600)} horas`
  return `${Math.round(seconds / 60)} min`
}

function fmtResetAt(resetAt: number): string {
  if (!resetAt) return '—'
  return new Date(resetAt * 1000).toLocaleString('es-GT', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function fmtCountdown(seconds: number): string {
  if (!seconds || seconds <= 0) return '0m'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

const maxDailyTotal = computed(() => {
  if (!metrics.value) return 1
  return Math.max(...metrics.value.last30Days.map((d) => d.totalTokens), 1)
})

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function fmtDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

onMounted(refreshAll)
</script>

<template>
  <PageLayout title="Consumo de Tokens LLM" description="Métricas de uso de tokens en llamadas a modelos de lenguaje">
    <template #actions>
      <button @click="refreshAll"
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

    <!-- Codex (ChatGPT) usage windows -->
    <div v-if="codexUsage || codexError" class="mb-6">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold text-base-content">Límites de uso de Codex</h3>
        <span v-if="codexUsage?.planType"
          class="text-xs px-2 py-0.5 rounded-full bg-base-200 text-base-content/70 uppercase tracking-wider">
          {{ codexUsage.planType }}
        </span>
      </div>

      <div v-if="codexError" class="p-3 rounded-lg bg-amber-900/30 border border-amber-500/30 text-amber-400 text-sm">
        No se pudo obtener el uso de Codex: {{ codexError }}
      </div>

      <div v-else-if="codexUsage" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div v-for="w in [
          { key: 'primary', label: 'Uso diario', win: codexUsage.primaryWindow },
          { key: 'secondary', label: 'Uso semanal', win: codexUsage.secondaryWindow }
        ]" :key="w.key" class="rounded-2xl p-5 bg-base-300 border border-base-300">
          <template v-if="w.win">
            <div class="flex items-center justify-between mb-3">
              <p class="text-xs text-base-content/60 font-semibold uppercase tracking-wider">{{ w.label }}</p>
              <span class="text-xs font-mono text-base-content/50">{{ windowLabel(w.win.limitWindowSeconds) }}</span>
            </div>
            <div class="flex items-end justify-between mb-2">
              <span class="text-2xl font-bold font-mono"
                :class="w.win.remainingPercent <= 10 ? 'text-red-400' : w.win.remainingPercent <= 25 ? 'text-amber-400' : 'text-green-500'">
                {{ w.win.remainingPercent }}%
              </span>
              <span class="text-xs text-base-content/50">restante</span>
            </div>
            <div class="h-2 rounded-full bg-base-100 overflow-hidden mb-3">
              <div class="h-full rounded-full transition-all"
                :class="w.win.usedPercent >= 90 ? 'bg-red-500' : w.win.usedPercent >= 75 ? 'bg-amber-500' : 'bg-indigo-500'"
                :style="{ width: `${100 - w.win.usedPercent}%` }" />
            </div>
            <div class="flex justify-between items-center text-xs">
              <span class="text-base-content/50">Usado {{ w.win.usedPercent }}%</span>
              <span class="text-base-content/60">Reinicia en {{ fmtCountdown(w.win.resetAfterSeconds) }}</span>
            </div>
            <p class="text-xs text-base-content/40 mt-1">{{ fmtResetAt(w.win.resetAt) }}</p>
          </template>
          <p v-else class="text-sm text-base-content/40 italic">Sin datos para esta ventana.</p>
        </div>
      </div>
    </div>

    <div v-if="loading && !metrics" class="flex justify-center items-center py-20">
      <div class="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
    </div>

    <div v-else-if="metrics" class="space-y-6">

      <!-- Period cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div
          v-for="(period, key) in { 'Hoy': metrics.today, 'Mes en curso': metrics.currentMonth, 'Año en curso': metrics.currentYear, 'Histórico': metrics.allTime }"
          :key="key" class="rounded-2xl p-5 bg-base-300 border border-base-300">
          <p class="text-xs text-base-content/60 font-semibold uppercase tracking-wider mb-3">{{ key }}</p>
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <span class="text-xs text-base-content/50">Tokens entrada</span>
              <span class="text-sm font-mono text-indigo-300">{{ fmt(period.inputTokens) }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-xs text-base-content/50">Tokens salida</span>
              <span class="text-sm font-mono text-emerald-300">{{ fmt(period.outputTokens) }}</span>
            </div>
            <div class="border-t border-base-300 pt-2 flex justify-between items-center">
              <span class="text-xs text-base-content/60 font-semibold">Total tokens</span>
              <span class="text-base font-bold font-mono text-base-content">{{ fmt(period.totalTokens) }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-xs text-base-content/50">Llamadas</span>
              <span class="text-xs font-mono text-base-content/60">{{ period.callCount }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Last 30 days chart -->
      <div class="rounded-2xl bg-base-300 border border-base-300 p-5">
        <h3 class="text-sm font-semibold text-base-content mb-4">Últimos 30 días</h3>
        <div class="flex items-end gap-0.5 h-32 w-full">
          <div v-for="day in metrics.last30Days" :key="day.date"
            class="flex-1 flex flex-col justify-end gap-0 group relative" style="height: 100%"
            :title="`${day.date}: ${fmt(day.totalTokens)} tokens`">
            <div class="w-full bg-indigo-500/70 hover:bg-indigo-400 transition-colors rounded-t-sm"
              :style="{ height: `${(day.totalTokens / maxDailyTotal) * 100}%`, minHeight: day.totalTokens > 0 ? '2px' : '0' }" />
            <!-- tooltip -->
            <div
              class="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center pointer-events-none z-10">
              <div
                class="bg-base-200 border border-base-300 rounded-lg px-2 py-1.5 text-xs whitespace-nowrap shadow-xl">
                <p class="text-base-content font-mono">{{ fmt(day.totalTokens) }}</p>
                <p class="text-base-content/60">{{ fmtDate(day.date) }}</p>
              </div>
            </div>
          </div>
        </div>
        <!-- X-axis labels: show only first, middle, last -->
        <div class="flex justify-between mt-1 text-xs text-base-content/40 font-mono">
          <span>{{ fmtDate(metrics.last30Days[0].date) }}</span>
          <span>{{ fmtDate(metrics.last30Days[14].date) }}</span>
          <span>{{ fmtDate(metrics.last30Days[29].date) }}</span>
        </div>
      </div>

      <!-- By model table -->
      <div class="rounded-2xl bg-base-300 border border-base-300 overflow-hidden">
        <header class="px-5 py-4 border-b border-base-300">
          <h3 class="text-sm font-semibold text-base-content">Consumo por modelo</h3>
        </header>
        <div v-if="!metrics.byModel.length" class="px-5 py-10 text-center text-sm text-base-content/50 italic">
          Aún no hay datos de consumo registrados.
        </div>
        <table v-else class="w-full text-sm">
          <thead class="bg-base-300/50">
            <tr>
              <th class="px-5 py-3 text-left text-xs text-base-content/60 font-semibold uppercase tracking-wider">Modelo
              </th>
              <th class="px-5 py-3 text-right text-xs text-base-content/60 font-semibold uppercase tracking-wider">
                Tokens
                entrada</th>
              <th class="px-5 py-3 text-right text-xs text-base-content/60 font-semibold uppercase tracking-wider">
                Tokens
                salida</th>
              <th class="px-5 py-3 text-right text-xs text-base-content/60 font-semibold uppercase tracking-wider">Total
              </th>
              <th class="px-5 py-3 text-right text-xs text-base-content/60 font-semibold uppercase tracking-wider">
                Llamadas
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-base-300">
            <tr v-for="m in metrics.byModel" :key="m.model" class="hover:bg-base-200/40 transition-colors">
              <td class="px-5 py-3 font-mono text-indigo-300 text-xs">{{ m.model }}</td>
              <td class="px-5 py-3 text-right font-mono text-base-content text-xs">{{ fmt(m.inputTokens) }}</td>
              <td class="px-5 py-3 text-right font-mono text-base-content text-xs">{{ fmt(m.outputTokens) }}</td>
              <td class="px-5 py-3 text-right font-mono text-base-content font-semibold text-xs">{{ fmt(m.totalTokens)
              }}
              </td>
              <td class="px-5 py-3 text-right font-mono text-base-content/60 text-xs">{{ m.callCount }}</td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>

    <div v-else-if="!loading" class="flex flex-col items-center justify-center py-20 text-center text-base-content/50">
      <p class="text-sm">No se pudieron cargar las métricas.</p>
    </div>
  </PageLayout>
</template>
