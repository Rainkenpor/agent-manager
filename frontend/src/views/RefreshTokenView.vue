<template>
  <PageLayout title="OpenAI"
    description="La credencial se guarda en base de datos, se sirve desde cache y se valida automáticamente cada 2 horas.">
    <template #actions>
      <div :class="['px-3 py-1 rounded-full border text-xs font-medium', openaiBadgeClass]">
        {{ openaiBadgeText }}
      </div>
    </template>


    <div v-if="providerMessage"
      class="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 text-sm">
      <i class="mdi mdi-check-circle mr-2"></i>{{ providerMessage }}
    </div>

    <div v-if="providerError" class="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
      <i class="mdi mdi-alert-circle mr-2"></i>{{ providerError }}
    </div>

    <div v-if="openaiAuthUrl" class="mb-4 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
      <p class="text-sm text-indigo-200 mb-2">Enlace de autenticación generado:</p>
      <a :href="openaiAuthUrl" target="_blank" rel="noopener noreferrer"
        class="text-sm break-all text-indigo-300 hover:text-indigo-200 underline">
        {{ openaiAuthUrl }}
      </a>
    </div>

    <div class="grid sm:grid-cols-2 gap-3 mb-6">
      <div class="rounded-lg border border-base-300 bg-base-300/50 p-4">
        <p class="text-xs uppercase tracking-wide text-base-content/50 mb-1">Última actualización</p>
        <p class="text-sm text-base-content">{{ formatDate(openaiStatus?.updatedAt ?? null) }}</p>
      </div>
      <div class="rounded-lg border border-base-300 bg-base-300/50 p-4">
        <p class="text-xs uppercase tracking-wide text-base-content/50 mb-1">Última validación</p>
        <p class="text-sm text-base-content">{{ formatDate(openaiStatus?.lastValidatedAt ?? null) }}</p>
      </div>
      <div class="rounded-lg border border-base-300 bg-base-300/50 p-4">
        <p class="text-xs uppercase tracking-wide text-base-content/50 mb-1">Expira</p>
        <p class="text-sm text-base-content">{{ formatDate(openaiStatus?.expiresAt ?? null) }}</p>
      </div>
      <div class="rounded-lg border border-base-300 bg-base-300/50 p-4">
        <p class="text-xs uppercase tracking-wide text-base-content/50 mb-1">Refresh token</p>
        <p class="text-sm text-base-content">{{ openaiStatus?.hasRefreshToken ? 'Disponible' : 'No disponible' }}
        </p>
      </div>
    </div>

    <div class="flex flex-wrap gap-3">
      <button @click="connectOpenAI" :disabled="providerBusy"
        class="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-indigo-600 hover:bg-indigo-500 disabled:bg-base-200 disabled:text-base-content/50">
        <i class="mdi mdi-open-in-new mr-2"></i>
        {{ openaiStatus?.configured ? 'Reconectar OpenAI' : 'Conectar OpenAI' }}
      </button>

      <button @click="refreshOpenAI" :disabled="providerBusy || !openaiStatus?.configured"
        class="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-base-200 hover:bg-base-100 disabled:text-base-content/50">
        <i class="mdi mdi-refresh mr-2" :class="{ 'animate-spin': providerBusy }"></i>
        Validar / refrescar
      </button>

      <button @click="loadOpenAIStatus" :disabled="providerLoading"
        class="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-base-200 hover:bg-base-100 disabled:text-base-content/50">
        <i class="mdi mdi-reload mr-2" :class="{ 'animate-spin': providerLoading }"></i>
        Recargar estado
      </button>

      <button @click="deleteOpenAI" :disabled="providerBusy || !openaiStatus?.configured"
        class="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 disabled:text-base-content/50 disabled:border-base-300">
        <i class="mdi mdi-delete-outline mr-2"></i>
        Eliminar
      </button>
    </div>
  </pageLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { ProviderConfigSummary } from '@/api/api'
import * as api from '@/api/api'
import PageLayout from '@/components/PageLayout.vue'

const route = useRoute()
const router = useRouter()

const tab = ref<'providers'>('providers')
const openaiStatus = ref<ProviderConfigSummary | null>(null)
const providerLoading = ref(false)
const providerBusy = ref(false)
const providerError = ref('')
const providerMessage = ref('')
const openaiAuthUrl = ref('')

const openaiBadgeClass = computed(() => {
  if (!openaiStatus.value?.configured) return 'bg-base-200 text-base-content border-base-300'
  if (openaiStatus.value.needsRefresh) return 'bg-amber-500/10 text-amber-300 border-amber-500/30'
  return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
})

const openaiBadgeText = computed(() => {
  if (!openaiStatus.value?.configured) return 'No configurado'
  return openaiStatus.value.needsRefresh ? 'Requiere refresh' : 'Conectado'
})

function formatDate(value: string | null) {
  if (!value) return 'N/D'
  return new Date(value).toLocaleString()
}

async function loadOpenAIStatus() {
  providerLoading.value = true
  providerError.value = ''
  try {
    const res = await api.getOpenAIProviderConfig()
    openaiStatus.value = res.data
  } catch (error: any) {
    providerError.value = error.message
  } finally {
    providerLoading.value = false
  }
}

async function connectOpenAI() {
  providerBusy.value = true
  providerError.value = ''
  providerMessage.value = ''
  try {
    const returnTo = `${window.location.origin}/config`
    const res = await api.startOpenAIProviderAuth(returnTo)
    openaiAuthUrl.value = res.data.authUrl
    providerMessage.value = 'Abre el enlace para completar la autenticación de OpenAI.'
  } catch (error: any) {
    providerError.value = error.message
    openaiAuthUrl.value = ''
  } finally {
    providerBusy.value = false
  }
}

async function refreshOpenAI() {
  providerBusy.value = true
  providerError.value = ''
  providerMessage.value = ''
  try {
    const res = await api.refreshOpenAIProviderToken()
    openaiStatus.value = res.data
    providerMessage.value = 'Token de OpenAI validado correctamente.'
  } catch (error: any) {
    providerError.value = error.message
  } finally {
    providerBusy.value = false
  }
}

async function deleteOpenAI() {
  if (!window.confirm('Se eliminará la configuración almacenada de OpenAI.')) return

  providerBusy.value = true
  providerError.value = ''
  providerMessage.value = ''
  try {
    await api.deleteOpenAIProviderConfig()
    openaiAuthUrl.value = ''
    openaiStatus.value = {
      provider: 'openai',
      configured: false,
      hasRefreshToken: false,
      lastValidatedAt: null,
      expiresAt: null,
      updatedAt: null,
      needsRefresh: false
    }
    providerMessage.value = 'Configuración de OpenAI eliminada.'
  } catch (error: any) {
    providerError.value = error.message
  } finally {
    providerBusy.value = false
  }
}

onMounted(async () => {
  const authResult = typeof route.query.auth === 'string' ? route.query.auth : ''
  const authMessage = typeof route.query.message === 'string' ? route.query.message : ''
  const provider = typeof route.query.provider === 'string' ? route.query.provider : ''

  if (provider === 'openai') {
    tab.value = 'providers'
    if (authResult === 'success') providerMessage.value = 'OpenAI conectado correctamente.'
    if (authResult === 'error') providerError.value = authMessage || 'No fue posible completar la autenticación de OpenAI.'
    await router.replace({ query: {} })
  }

  await loadOpenAIStatus()
})
</script>