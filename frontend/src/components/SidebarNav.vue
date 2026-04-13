<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/store/useAuth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const allNavLinks = [
  { to: '/', label: 'Home', icon: 'mdi-home', resource: null },
  { to: '/chat', label: 'Chat', icon: 'mdi-chat', resource: 'chat' },
  { to: '/users', label: 'Users', icon: 'mdi-account', resource: 'users' },
  { to: '/roles', label: 'Roles', icon: 'mdi-shield-account', resource: 'roles' },
  { to: '/agents', label: 'Agents', icon: 'mdi-robot', resource: 'agents' },
  { to: '/mcps', label: 'MCP Servers', icon: 'mdi-server', resource: 'mcp_servers' },
  { to: '/skills', label: 'Skills', icon: 'mdi-lightning-bolt', resource: 'skills' },
  { to: '/mcp-credentials', label: 'My Credentials', icon: 'mdi-key', resource: 'mcp_credentials' },
  { to: '/traceability', label: 'Trazabilidad', icon: 'mdi-sitemap', resource: 'traceability' },
  { to: '/hook-servers', label: 'Hook Servers', icon: 'mdi-webhook', resource: 'hook_servers' },
]

const navLinks = computed(() =>
  allNavLinks.filter((l) => l.resource === null || auth.hasResourceAccess(l.resource))
)

function logout() {
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <aside class="flex flex-col w-18 shrink-0 bg-slate-900 h-full text-slate-100 rounded-lg">
    <!-- Logo -->
    <div class="flex items-center gap-3 px-5 py-5 border-b border-slate-700/60">
      <div
        class="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
        AM
      </div>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 px-3 py-4 space-y-1">
      <RouterLink v-for="link in navLinks" :key="link.to" :to="link.to"
        class="flex items-center gap-3 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors routes" :class="(link.to === '/' ? route.path === '/' : route.path.startsWith(link.to))
          ? 'bg-indigo-600 text-white'
          : 'text-slate-400 hover:text-white hover:bg-slate-800'
          ">
        <i class="mdi text-lg" :class="link.icon"></i>
        <!-- <span class="w-6 h-6 rounded flex items-center justify-center text-xs font-bold shrink-0"
          :class="(link.to === '/' ? route.path === '/' : route.path.startsWith(link.to)) ? 'bg-indigo-500' : 'bg-slate-700'">
        </span> -->
        <div class="absolute ml-9 p-2 rounded-xl text-[11px] tooltip" :class="(link.to === '/' ? route.path === '/' : route.path.startsWith(link.to))
          ? 'bg-indigo-600 text-white'
          : 'text-white bg-slate-800'">
          {{ link.label }}
        </div>
      </RouterLink>
    </nav>

    <!-- User Info & Logout -->
    <div class="border-t border-slate-700/60 px-4 py-4 ">
      <div v-if="auth.user" class="mb-3 routes">
        <div v-if="auth.user" class="tooltip ml-13 p-2 rounded-xl absolute text-white bg-slate-800">
          <p class="text-sm font-medium text-white truncate">{{ auth.user.username }}</p>
          <p class="text-xs text-slate-400 truncate">{{ auth.user.email }}</p>
        </div>
        <p class="text-sm font-medium text-white truncate">{{ auth.user.username }}</p>
        <p class="text-xs text-slate-400 truncate">{{ auth.user.email }}</p>
      </div>
      <button
        class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        @click="logout">
        <span class="mdi mdi-logout"></span>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.routes .tooltip {
  opacity: 0;
  transform: translateY(-5px);
  pointer-events: none;
}

.routes:hover .tooltip {
  opacity: 1;
  transform: translateY(0);
}
</style>