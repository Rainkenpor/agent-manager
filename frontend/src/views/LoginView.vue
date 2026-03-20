<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/store/useAuth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const azureLoading = ref(false)

onMounted(async () => {
  // Manejar token retornado por Azure AD callback
  const azureToken = route.query.azureToken as string | undefined
  if (azureToken) {
    azureLoading.value = true
    try {
      await auth.loginWithToken(azureToken)
      router.replace('/')
    } catch {
      error.value = 'Azure login failed. Please try again.'
    } finally {
      azureLoading.value = false
    }
    return
  }

  // Mostrar error de Azure si viene en la URL
  const azureError = route.query.error as string | undefined
  if (azureError) {
    error.value = `Azure login error: ${azureError}`
  }
})

async function handleLogin() {
  if (!username.value || !password.value) {
    error.value = 'Username and password are required.'
    return
  }
  error.value = ''
  loading.value = true
  try {
    await auth.login({ username: username.value, password: password.value })
    router.push('/')
  } catch (e: any) {
    error.value = e.message ?? 'Login failed. Please try again.'
  } finally {
    loading.value = false
  }
}

function loginWithAzure() {
  window.location.href = '/api/auth/azure'
}
</script>

<template>
  <div
    class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex items-center justify-center px-4">
    <div class="w-full max-w-md">
      <!-- Logo / Title -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 shadow-lg mb-4">
          <span class="text-white text-2xl font-bold">AM</span>
        </div>
        <h1 class="text-3xl font-bold text-white">Agent Manager</h1>
        <p class="text-slate-400 mt-1 text-sm">Sign in to your admin account</p>
      </div>

      <!-- Card -->
      <div class="bg-white rounded-2xl shadow-2xl p-8">

        <!-- Azure loading overlay -->
        <div v-if="azureLoading" class="flex flex-col items-center justify-center py-6 gap-3">
          <svg class="animate-spin h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <p class="text-sm text-slate-500">Completing Azure sign-in...</p>
        </div>

        <template v-else>
          <!-- Error -->
          <div v-if="error" class="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-5">
            {{ error }}
          </div>

          <!-- Azure AD Login -->
          <button type="button" @click="loginWithAzure"
            class="w-full flex items-center justify-center gap-3 border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium py-2.5 rounded-lg transition-colors text-sm mb-5">
            <!-- Microsoft logo -->
            <svg width="18" height="18" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="9" height="9" fill="#F25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
              <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
            </svg>
            Sign in with Microsoft
          </button>

          <!-- Divider -->
          <div class="flex items-center gap-3 mb-5">
            <div class="flex-1 h-px bg-slate-200"></div>
            <span class="text-xs text-slate-400">or continue with username</span>
            <div class="flex-1 h-px bg-slate-200"></div>
          </div>

          <!-- Credentials form -->
          <form @submit.prevent="handleLogin" class="space-y-5">
            <!-- Username -->
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1.5">Username</label>
              <input v-model="username" type="text" placeholder="Enter your username" autocomplete="username"
                class="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 placeholder-slate-400 text-sm transition" />
            </div>

            <!-- Password -->
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <input v-model="password" type="password" placeholder="Enter your password"
                autocomplete="current-password"
                class="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 placeholder-slate-400 text-sm transition" />
            </div>

            <!-- Submit -->
            <button type="submit" :disabled="loading"
              class="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm shadow-sm">
              <span v-if="loading" class="flex items-center justify-center gap-2">
                <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Signing in...
              </span>
              <span v-else>Sign In</span>
            </button>
          </form>
        </template>
      </div>
    </div>
  </div>
</template>
