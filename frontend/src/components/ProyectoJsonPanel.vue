<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import * as api from '@/api/api'
import { PROYECTO_DATA_SECTIONS, type ProyectoData } from '@/api/api'
import { useToastStore } from '@/store/useToast'

const props = defineProps<{ proyectoId: string; data: ProyectoData; canManage: boolean }>()
const emit = defineEmits<{ saved: [ProyectoData] }>()

const toast = useToastStore()

const sectionLabels: Record<string, string> = {
	historiasUsuario: 'Historias de usuario',
	arquitectura: 'Arquitectura',
	proyectosRelacionados: 'Proyectos relacionados',
	metadatos: 'Metadatos'
}

/** Las cuatro secciones garantizadas primero, luego las secciones propias del documento. */
const sections = computed(() => {
	const extra = Object.keys(props.data).filter((key) => !PROYECTO_DATA_SECTIONS.includes(key as never))
	return [...PROYECTO_DATA_SECTIONS, ...extra]
})

const buffers = ref<Record<string, string>>({})
const pristine = ref<Record<string, string>>({})
const open = ref<Record<string, boolean>>({ historiasUsuario: true })
const saving = ref<string | null>(null)

const serialize = (value: unknown) => JSON.stringify(value ?? null, null, 2)

function resetBuffers() {
	const next: Record<string, string> = {}
	for (const section of sections.value) next[section] = serialize(props.data[section])
	buffers.value = { ...next }
	pristine.value = { ...next }
}

watch(() => props.data, resetBuffers, { immediate: true, deep: true })

function errorOf(section: string): string {
	const raw = buffers.value[section] ?? ''
	if (raw.trim() === '') return 'La sección no puede estar vacía'
	try {
		JSON.parse(raw)
		return ''
	} catch (e: any) {
		return e.message
	}
}

const isDirty = (section: string) => buffers.value[section] !== pristine.value[section]

function format(section: string) {
	if (errorOf(section)) {
		toast.error('Corrige el JSON antes de formatear')
		return
	}
	buffers.value[section] = serialize(JSON.parse(buffers.value[section]))
}

async function save(section: string) {
	const error = errorOf(section)
	if (error) {
		toast.error(error)
		return
	}
	saving.value = section
	try {
		const res = await api.updateProyectoDataSection(props.proyectoId, section, JSON.parse(buffers.value[section]))
		if (!res.success) throw new Error(res.error)
		pristine.value[section] = buffers.value[section]
		emit('saved', { ...props.data, [section]: JSON.parse(buffers.value[section]) } as ProyectoData)
		toast.success(`Sección "${sectionLabels[section] ?? section}" guardada`)
	} catch (e: any) {
		toast.error(e.message)
	} finally {
		saving.value = null
	}
}

function summary(section: string): string {
	const value = props.data[section]
	if (Array.isArray(value)) return `${value.length} elemento(s)`
	if (value && typeof value === 'object') return `${Object.keys(value).length} clave(s)`
	return String(value ?? 'vacío')
}
</script>

<template>
  <div class="flex flex-col min-h-0 h-full">
    <div class="flex items-center justify-between mb-3 shrink-0">
      <div>
        <h2 class="text-sm font-semibold text-base-content">Información del proyecto (JSON)</h2>
        <p class="text-xs text-base-content/50">Cada sección se guarda por separado. El agente puede leerla y editarla con sus herramientas.</p>
      </div>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
      <fieldset v-for="section in sections" :key="section" class="border border-base-300 rounded-xl p-4 space-y-3">
        <legend class="text-xs font-semibold text-base-content/60 px-1 uppercase tracking-wider">
          {{ sectionLabels[section] ?? section }}
        </legend>

        <button type="button" class="w-full flex items-center justify-between text-left" @click="open[section] = !open[section]">
          <span class="text-sm text-base-content/70">
            {{ summary(section) }}
            <span v-if="isDirty(section)" class="ml-2 text-xs text-warning">· sin guardar</span>
          </span>
          <i class="mdi text-base-content/50" :class="open[section] ? 'mdi-chevron-up' : 'mdi-chevron-down'" />
        </button>

        <template v-if="open[section]">
          <textarea v-model="buffers[section]" rows="12" :disabled="!canManage"
            class="w-full bg-base-200 border border-base-content/20 rounded-lg px-3 py-2 text-base-content font-mono text-sm focus:outline-none focus:border-indigo-500 resize-y disabled:opacity-60"></textarea>

          <p v-if="errorOf(section)" class="text-xs text-error">
            <i class="mdi mdi-alert-circle-outline" /> {{ errorOf(section) }}
          </p>

          <div class="flex items-center gap-2">
            <button class="btn btn-sm btn-primary" :disabled="!canManage || !!errorOf(section) || saving === section || !isDirty(section)"
              @click="save(section)">
              <i class="mdi mdi-content-save" /> {{ saving === section ? 'Guardando…' : 'Guardar sección' }}
            </button>
            <button class="btn btn-sm btn-ghost" :disabled="!canManage" @click="format(section)">
              <i class="mdi mdi-code-braces" /> Formatear
            </button>
            <button class="btn btn-sm btn-ghost" :disabled="!isDirty(section)" @click="buffers[section] = pristine[section]">
              <i class="mdi mdi-undo" /> Descartar
            </button>
          </div>
        </template>
      </fieldset>
    </div>
  </div>
</template>
