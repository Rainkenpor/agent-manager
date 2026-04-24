<script setup lang="ts">
import { ref } from 'vue'
import * as api from '@/api/api'
import type { ExportResource } from '@/api/api'

// ─── Tab ─────────────────────────────────────────────────────────────────────
const tab = ref<'export' | 'import'>('export')

// ─── Export ───────────────────────────────────────────────────────────────────
const resourceOptions: { key: ExportResource; label: string; icon: string }[] = [
  { key: 'agents',          label: 'Agentes',        icon: 'mdi-robot' },
  { key: 'skills',          label: 'Skills',          icon: 'mdi-lightning-bolt' },
  { key: 'mcps',            label: 'MCP Servers',     icon: 'mdi-server' },
  { key: 'traceabilities',  label: 'Trazabilidades',  icon: 'mdi-sitemap' },
  { key: 'roles',           label: 'Roles',           icon: 'mdi-shield-account' },
  { key: 'users',           label: 'Usuarios',        icon: 'mdi-account-group' },
]

const selectedResources = ref<ExportResource[]>([])
const exportLoading = ref(false)
const exportError = ref('')

function toggleResource(key: ExportResource) {
  const idx = selectedResources.value.indexOf(key)
  if (idx === -1) selectedResources.value.push(key)
  else selectedResources.value.splice(idx, 1)
}

function selectAll() {
  selectedResources.value = resourceOptions.map((r) => r.key)
}

function clearAll() {
  selectedResources.value = []
}

async function doExport() {
  if (!selectedResources.value.length) return
  exportLoading.value = true
  exportError.value = ''
  try {
    const res = await api.exportConfig(selectedResources.value)
    if (!res.success) throw new Error((res as any).error ?? 'Error desconocido')
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `agent-manager-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e: any) {
    exportError.value = e.message
  } finally {
    exportLoading.value = false
  }
}

// ─── Import ───────────────────────────────────────────────────────────────────
const fileInput = ref<HTMLInputElement | null>(null)
const importFile = ref<File | null>(null)
const importLoading = ref(false)
const importError = ref('')
const importResult = ref<Record<string, { created: number; skipped: number; errors: string[] }> | null>(null)
const isDragging = ref(false)

function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  importFile.value = target.files?.[0] ?? null
  importResult.value = null
  importError.value = ''
}

function onDrop(e: DragEvent) {
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file?.name.endsWith('.json')) {
    importFile.value = file
    importResult.value = null
    importError.value = ''
  }
}

async function doImport() {
  if (!importFile.value) return
  importLoading.value = true
  importError.value = ''
  importResult.value = null
  try {
    const text = await importFile.value.text()
    const payload = JSON.parse(text) as Record<string, unknown>
    const res = await api.importConfig(payload)
    if (!res.success) throw new Error((res as any).error ?? 'Error desconocido')
    importResult.value = res.data as any
  } catch (e: any) {
    importError.value = e.message
  } finally {
    importLoading.value = false
  }
}

function totalCreated(summary: Record<string, { created: number; skipped: number; errors: string[] }>) {
  return Object.values(summary).reduce((acc, v) => acc + v.created, 0)
}

function totalSkipped(summary: Record<string, { created: number; skipped: number; errors: string[] }>) {
  return Object.values(summary).reduce((acc, v) => acc + v.skipped, 0)
}

function allErrors(summary: Record<string, { created: number; skipped: number; errors: string[] }>) {
  return Object.entries(summary).flatMap(([key, v]) => v.errors.map((e) => `[${key}] ${e}`))
}

const sectionLabel: Record<string, string> = {
  agents: 'Agentes',
  skills: 'Skills',
  mcps: 'MCP Servers',
  traceabilities: 'Trazabilidades',
  roles: 'Roles',
  users: 'Usuarios',
}
</script>

<template>
  <div class="p-6 bg-slate-950 text-white min-h-full">
    <!-- Header -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-white flex items-center gap-2">
        <i class="mdi mdi-cog-transfer text-indigo-400"></i>
        Configuración
      </h1>
      <p class="text-slate-400 text-sm mt-1">Exporta e importa la configuración del sistema en formato JSON.</p>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 mb-6 bg-slate-900 rounded-xl p-1 w-fit">
      <button
        v-for="t in [{ key: 'export', label: 'Exportar', icon: 'mdi-download' }, { key: 'import', label: 'Importar', icon: 'mdi-upload' }]"
        :key="t.key"
        @click="tab = t.key as 'export' | 'import'"
        :class="[
          'px-5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
          tab === t.key ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
        ]">
        <i :class="`mdi ${t.icon}`"></i>
        {{ t.label }}
      </button>
    </div>

    <!-- Export Panel -->
    <div v-if="tab === 'export'" class="max-w-2xl">
      <div class="bg-slate-900 rounded-xl p-6 border border-slate-800">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-semibold text-white">Selecciona los recursos a exportar</h2>
          <div class="flex gap-2">
            <button @click="selectAll" class="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">Todos</button>
            <span class="text-slate-600">·</span>
            <button @click="clearAll" class="text-xs text-slate-400 hover:text-white transition-colors">Ninguno</button>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 mb-6">
          <button
            v-for="opt in resourceOptions"
            :key="opt.key"
            @click="toggleResource(opt.key)"
            :class="[
              'flex items-center gap-3 px-4 py-3 rounded-lg border transition-all text-left',
              selectedResources.includes(opt.key)
                ? 'border-indigo-500 bg-indigo-500/10 text-white'
                : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-white'
            ]">
            <i :class="`mdi ${opt.icon} text-lg`"
               :style="selectedResources.includes(opt.key) ? 'color: #818cf8' : ''"></i>
            <span class="text-sm font-medium">{{ opt.label }}</span>
            <i v-if="selectedResources.includes(opt.key)" class="mdi mdi-check ml-auto text-indigo-400"></i>
          </button>
        </div>

        <div v-if="exportError" class="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          <i class="mdi mdi-alert-circle mr-2"></i>{{ exportError }}
        </div>

        <button
          @click="doExport"
          :disabled="!selectedResources.length || exportLoading"
          class="w-full py-3 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2"
          :class="selectedResources.length && !exportLoading
            ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
            : 'bg-slate-800 text-slate-500 cursor-not-allowed'">
          <i v-if="exportLoading" class="mdi mdi-loading animate-spin"></i>
          <i v-else class="mdi mdi-download"></i>
          {{ exportLoading ? 'Exportando...' : `Descargar JSON (${selectedResources.length} recursos)` }}
        </button>
      </div>
    </div>

    <!-- Import Panel -->
    <div v-if="tab === 'import'" class="max-w-2xl">
      <div class="bg-slate-900 rounded-xl p-6 border border-slate-800">
        <h2 class="font-semibold text-white mb-4">Importar desde JSON</h2>

        <!-- Drop zone -->
        <div
          @dragover.prevent="isDragging = true"
          @dragleave="isDragging = false"
          @drop.prevent="onDrop"
          @click="fileInput?.click()"
          :class="[
            'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all mb-4',
            isDragging ? 'border-indigo-400 bg-indigo-500/10' : 'border-slate-700 hover:border-slate-600 bg-slate-800/30'
          ]">
          <input ref="fileInput" type="file" accept=".json" class="hidden" @change="onFileChange" />
          <i class="mdi mdi-file-upload-outline text-4xl text-slate-500 mb-2 block"></i>
          <p v-if="!importFile" class="text-slate-400 text-sm">
            Arrastra un archivo JSON aquí o <span class="text-indigo-400">haz clic para seleccionar</span>
          </p>
          <p v-else class="text-white text-sm font-medium flex items-center justify-center gap-2">
            <i class="mdi mdi-file-check text-green-400"></i>
            {{ importFile.name }}
            <span class="text-slate-400 font-normal">({{ (importFile.size / 1024).toFixed(1) }} KB)</span>
          </p>
        </div>

        <!-- Warning note about users -->
        <div class="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 text-xs flex gap-2">
          <i class="mdi mdi-information-outline shrink-0 mt-0.5"></i>
          <span>Los recursos existentes (mismo nombre/slug) serán omitidos. Los usuarios importados recibirán la contraseña temporal <code class="bg-amber-500/20 px-1 rounded">ChangeMe123!</code></span>
        </div>

        <div v-if="importError" class="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          <i class="mdi mdi-alert-circle mr-2"></i>{{ importError }}
        </div>

        <!-- Result summary -->
        <div v-if="importResult" class="mb-4 space-y-2">
          <div class="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
            <i class="mdi mdi-check-circle text-green-400 text-xl"></i>
            <div>
              <p class="text-green-400 font-medium text-sm">Importación completada</p>
              <p class="text-slate-400 text-xs">
                {{ totalCreated(importResult) }} creados · {{ totalSkipped(importResult) }} omitidos
              </p>
            </div>
          </div>

          <div v-for="(section, key) in importResult" :key="key"
               class="flex items-center justify-between px-4 py-2 bg-slate-800 rounded-lg">
            <span class="text-sm text-slate-300">{{ sectionLabel[key] ?? key }}</span>
            <div class="flex gap-3 text-xs">
              <span class="text-green-400"><i class="mdi mdi-plus"></i> {{ section.created }}</span>
              <span class="text-slate-500"><i class="mdi mdi-minus"></i> {{ section.skipped }}</span>
              <span v-if="section.errors.length" class="text-red-400">
                <i class="mdi mdi-alert"></i> {{ section.errors.length }}
              </span>
            </div>
          </div>

          <div v-if="allErrors(importResult).length"
               class="p-3 bg-red-500/10 border border-red-500/30 rounded-lg space-y-1">
            <p class="text-red-400 text-xs font-medium mb-1"><i class="mdi mdi-alert-circle mr-1"></i>Errores durante la importación:</p>
            <p v-for="(err, i) in allErrors(importResult)" :key="i" class="text-red-300 text-xs font-mono">{{ err }}</p>
          </div>
        </div>

        <button
          @click="doImport"
          :disabled="!importFile || importLoading"
          class="w-full py-3 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2"
          :class="importFile && !importLoading
            ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
            : 'bg-slate-800 text-slate-500 cursor-not-allowed'">
          <i v-if="importLoading" class="mdi mdi-loading animate-spin"></i>
          <i v-else class="mdi mdi-upload"></i>
          {{ importLoading ? 'Importando...' : 'Importar configuración' }}
        </button>
      </div>
    </div>
  </div>
</template>
