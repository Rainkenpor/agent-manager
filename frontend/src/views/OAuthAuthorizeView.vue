<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import * as api from '@/api/api'

const route = useRoute()

// OAuth params from query string
const clientId = computed(() => route.query.client_id as string ?? '')
const clientName = computed(() => route.query.client_name as string ?? route.query.client_id as string ?? 'Unknown App')
const redirectUri = computed(() => route.query.redirect_uri as string ?? '')
const state = computed(() => route.query.state as string ?? '')
const scope = computed(() => route.query.scope as string ?? 'mcp:all')

const scopes = computed(() =>
  scope.value
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((s) => ({
      key: s,
      label: scopeLabel(s),
    }))
)

function scopeLabel(s: string): string {
  const labels: Record<string, string> = {
    'mcp:all': 'Full access to all MCP tools and agents',
    'mcp:tools': 'Access to MCP tools',
    'mcp:resources': 'Access to MCP resources',
    'mcp:prompts': 'Access to MCP prompts',
  }
  return labels[s] ?? s
}

// Form state
const username = ref('')
const password = ref('')
const azureToken = ref('')
const loading = ref(false)
const azureLoading = ref(false)
const error = ref('')
const denied = ref(false)

// Invalid request detection
const isValid = computed(() => !!clientId.value && !!redirectUri.value)

onMounted(async () => {
  if (!isValid.value) {
    error.value = 'Invalid OAuth request: missing client_id or redirect_uri.'
    return
  }
  // Handle Azure AD callback: azureToken is appended to this page's URL
  const token = route.query.azureToken as string | undefined
  if (token) {
    azureToken.value = token
    azureLoading.value = true
    await authorize(true)
    azureLoading.value = false
  }
})

function loginWithAzure() {
  // Build the return_to URL so Azure callback redirects back here with the OAuth params
  const oauthParams = new URLSearchParams()
  oauthParams.set('client_id', clientId.value)
  oauthParams.set('redirect_uri', redirectUri.value)
  if (state.value) oauthParams.set('state', state.value)
  if (scope.value) oauthParams.set('scope', scope.value)
  const clientNameVal = route.query.client_name as string | undefined
  if (clientNameVal) oauthParams.set('client_name', clientNameVal)
  const returnTo = `${window.location.origin}/oauth/authorize/mcp?${oauthParams.toString()}`
  window.location.href = `/api/auth/azure?return_to=${encodeURIComponent(returnTo)}`
}

async function authorize(approved: boolean) {
  if (!isValid.value) return
  error.value = ''
  loading.value = true
  denied.value = !approved

  try {
    const result = await api.oauthAuthorize({
      client_id: clientId.value,
      redirect_uri: redirectUri.value,
      state: state.value || undefined,
      scope: scope.value || undefined,
      ...(azureToken.value
        ? { token: azureToken.value }
        : { username: username.value, password: password.value }),
      approved,
    })

    if (result.error) {
      if (result.error === 'invalid_credentials') {
        error.value = 'Invalid username or password.'
      } else {
        error.value = `Authorization failed: ${result.error}`
      }
      denied.value = false
      return
    }

    if (result.redirect) {
      window.location.href = result.redirect
    }
  } catch (e: any) {
    error.value = e.message ?? 'Authorization failed'
    denied.value = false
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex items-center justify-center p-4">
    <div class="w-full max-w-md">

      <!-- Logo / Brand -->
      <div class="flex justify-center mb-8">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-base shadow-lg">
            AM
          </div>
          <span class="text-white text-lg font-semibold tracking-wide">Agent Manager</span>
        </div>
      </div>

      <!-- Invalid request -->
      <div v-if="!isValid" class="bg-red-900/40 border border-red-700/50 rounded-2xl p-6 text-center">
        <svg class="w-10 h-10 text-red-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <p class="text-red-300 font-medium">Invalid OAuth Request</p>
        <p class="text-red-400 text-sm mt-1">{{ error }}</p>
      </div>

      <!-- Authorization card -->
      <div v-else class="bg-white/5 backdrop-blur border border-white/10 rounded-2xl shadow-2xl overflow-hidden">

        <!-- Header -->
        <div class="px-8 pt-8 pb-6 border-b border-white/10">
          <div class="flex items-center justify-between mb-4">
            <!-- App badge -->
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                <svg class="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
                </svg>
              </div>
              <div>
                <p class="text-white font-semibold text-sm">{{ clientName }}</p>
                <p class="text-slate-400 text-xs">is requesting access</p>
              </div>
            </div>
            <!-- Arrow -->
            <svg class="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            <!-- Platform -->
            <div class="flex items-center gap-3">
              <div>
                <p class="text-white font-semibold text-sm text-right">Agent Manager</p>
                <p class="text-slate-400 text-xs text-right">MCP Server</p>
              </div>
              <div class="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
                </svg>
              </div>
            </div>
          </div>

          <h2 class="text-white text-lg font-semibold mb-1">Authorize Access</h2>
          <p class="text-slate-400 text-sm">
            Sign in to grant <span class="text-white font-medium">{{ clientName }}</span> access to your MCP tools.
          </p>
        </div>

        <!-- Permissions -->
        <div class="px-8 py-5 border-b border-white/10">
          <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Requested Permissions</p>
          <ul class="space-y-2">
            <li
              v-for="s in scopes"
              :key="s.key"
              class="flex items-start gap-2.5"
            >
              <svg class="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <span class="text-slate-300 text-sm">{{ s.label }}</span>
            </li>
          </ul>
        </div>

        <!-- Login form -->
        <div class="px-8 py-6">

          <!-- Azure loading overlay -->
          <div v-if="azureLoading" class="flex flex-col items-center justify-center py-6 gap-3">
            <svg class="animate-spin h-8 w-8 text-indigo-400" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <p class="text-sm text-slate-400">Completing Microsoft sign-in...</p>
          </div>

          <template v-else>
          <!-- Sign in with Microsoft -->
          <button
            type="button"
            @click="loginWithAzure"
            class="w-full flex items-center justify-center gap-3 border border-white/10 hover:bg-white/5 text-slate-300 hover:text-white font-medium py-2.5 rounded-lg transition-colors text-sm mb-4"
          >
            <svg width="18" height="18" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
              <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
            </svg>
            Sign in with Microsoft
          </button>

          <!-- Divider -->
          <div class="flex items-center gap-3 mb-4">
            <div class="flex-1 h-px bg-white/10"></div>
            <span class="text-xs text-slate-500">or continue with username</span>
            <div class="flex-1 h-px bg-white/10"></div>
          </div>

          <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Your Credentials</p>

          <div class="space-y-3">
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1.5">Username or Email</label>
              <input
                v-model="username"
                type="text"
                autocomplete="username"
                placeholder="Enter your username"
                class="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
              <input
                v-model="password"
                type="password"
                autocomplete="current-password"
                placeholder="Enter your password"
                class="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <!-- Error -->
          <div v-if="error" class="mt-4 flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-700/30 rounded-lg px-3 py-2.5">
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {{ error }}
          </div>

          <!-- Actions -->
          <div class="flex gap-3 mt-6">
            <button
              :disabled="loading"
              class="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-50"
              @click="authorize(false)"
            >
              <span v-if="loading && denied" class="flex items-center justify-center gap-2">
                <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Denying...
              </span>
              <span v-else>Deny</span>
            </button>
            <button
              :disabled="loading || (!azureToken && (!username || !password))"
              class="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors shadow-lg shadow-indigo-500/20"
              @click="authorize(true)"
            >
              <span v-if="loading && !denied" class="flex items-center justify-center gap-2">
                <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Authorizing...
              </span>
              <span v-else>Authorize</span>
            </button>
          </div>

          <p class="text-center text-xs text-slate-500 mt-5">
            Your credentials are verified directly with Agent Manager<br/>and never shared with the requesting app.
          </p>
          </template>
        </div>
      </div>

      <!-- Footer -->
      <p class="text-center text-slate-600 text-xs mt-6">
        Redirect URI: <span class="font-mono">{{ redirectUri }}</span>
      </p>
    </div>
  </div>
</template>
