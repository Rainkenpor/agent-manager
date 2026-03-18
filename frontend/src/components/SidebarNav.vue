<script setup lang="ts">
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/store/useAuth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const navLinks = [
  { to: '/users', label: 'Users', icon: 'U' },
  { to: '/roles', label: 'Roles', icon: 'R' },
  { to: '/agents', label: 'Agents', icon: 'A' },
]

function logout() {
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <aside class="flex flex-col w-64 shrink-0 bg-slate-900 min-h-screen text-slate-100">
    <!-- Logo -->
    <div class="flex items-center gap-3 px-6 py-5 border-b border-slate-700/60">
      <div class="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
        AM
      </div>
      <span class="font-semibold text-white tracking-wide">Agent Manager</span>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 px-3 py-4 space-y-1">
      <RouterLink
        v-for="link in navLinks"
        :key="link.to"
        :to="link.to"
        class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
        :class="
          route.path === link.to
            ? 'bg-indigo-600 text-white'
            : 'text-slate-400 hover:text-white hover:bg-slate-800'
        "
      >
        <span
          class="w-6 h-6 rounded flex items-center justify-center text-xs font-bold shrink-0"
          :class="route.path === link.to ? 'bg-indigo-500' : 'bg-slate-700'"
        >
          {{ link.icon }}
        </span>
        {{ link.label }}
      </RouterLink>
    </nav>

    <!-- User Info & Logout -->
    <div class="border-t border-slate-700/60 px-4 py-4">
      <div v-if="auth.user" class="mb-3">
        <p class="text-sm font-medium text-white truncate">{{ auth.user.username }}</p>
        <p class="text-xs text-slate-400 truncate">{{ auth.user.email }}</p>
      </div>
      <button
        class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        @click="logout"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        Logout
      </button>
    </div>
  </aside>
</template>
