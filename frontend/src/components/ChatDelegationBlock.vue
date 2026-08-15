<script setup lang="ts">
import { ref } from 'vue'

type DelegationStatus = 'running' | 'completed' | 'failed'

interface DelegationAction {
	callId: string
	name: string
	status: DelegationStatus
}

interface Delegation {
	callId: string
	agentId: string
	name: string
	instruction: string
	status: DelegationStatus
	actions: DelegationAction[]
}

defineProps<{ delegation: Delegation }>()

const collapsed = ref(true)

const STATUS_ICON: Record<DelegationStatus, string> = {
	running: 'mdi-loading mdi-spin',
	completed: 'mdi-check-circle',
	failed: 'mdi-alert-circle'
}

const STATUS_COLOR: Record<DelegationStatus, string> = {
	running: 'text-indigo-400',
	completed: 'text-success',
	failed: 'text-error'
}

const STATUS_LABEL: Record<DelegationStatus, string> = {
	running: 'trabajando…',
	completed: 'completado',
	failed: 'falló'
}
</script>

<template>
  <div class="mb-2 rounded-xl border border-base-300 bg-base-200/40 overflow-hidden">
    <!-- Cabecera: el agente al que se delegó -->
    <button class="w-full flex items-center gap-2 px-3 py-2 hover:bg-base-200/70 transition-colors text-left"
      @click="collapsed = !collapsed">
      <span class="w-6 h-6 rounded-lg bg-indigo-500/15 flex items-center justify-center shrink-0">
        <i class="mdi mdi-robot-outline text-[13px] text-indigo-400" />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block text-xs font-semibold text-base-content truncate">{{ delegation.name }}</span>
        <span class="block text-[11px]" :class="STATUS_COLOR[delegation.status]">
          {{ STATUS_LABEL[delegation.status] }}
          <template v-if="delegation.actions.length"> · {{ delegation.actions.length }} acción(es)</template>
        </span>
      </span>
      <i class="mdi text-sm shrink-0" :class="[STATUS_ICON[delegation.status], STATUS_COLOR[delegation.status]]" />
      <i class="mdi text-sm shrink-0 text-base-content/40" :class="collapsed ? 'mdi-chevron-down' : 'mdi-chevron-up'" />
    </button>

    <!-- Cuerpo: la conversación interna con el agente -->
    <div v-if="!collapsed" class="px-3 pb-3 space-y-2">
      <!-- Instrucción enviada, como mensaje de usuario del chat interno -->
      <div class="flex justify-end">
        <div class="max-w-[92%] px-3 py-2 rounded-xl rounded-tr-sm bg-indigo-600/90 text-white text-xs whitespace-pre-wrap">
          {{ delegation.instruction }}
        </div>
      </div>

      <!-- Tools que va ejecutando el agente, con el mismo chip que el resto del chat -->
      <div v-if="delegation.actions.length" class="flex justify-start">
        <div class="max-w-[92%] px-3 py-2 rounded-xl rounded-tl-sm bg-base-100 border border-base-300">
          <div class="flex flex-wrap gap-1.5">
            <span v-for="action in delegation.actions" :key="action.callId"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-base-100/60 text-base-content/50 text-xs font-mono">
              <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {{ action.name }}
            </span>
          </div>
        </div>
      </div>

      <p v-else-if="delegation.status === 'running'" class="text-[11px] text-base-content/50 pl-1">
        Sin acciones todavía…
      </p>
    </div>
  </div>
</template>
