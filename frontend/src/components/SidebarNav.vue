<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/store/useAuth'
import { useThemeStore } from '@/store/useTheme'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const themeStore = useThemeStore()

const appVersion = __APP_VERSION__

type NavLink = {
	to: string
	label: string
	icon: string
	resources: string[] | null
	accessResource?: string
}

const allNavLinks: NavLink[] = [
	{ to: '/', label: 'Home', icon: 'mdi-home', resources: null },
	{ to: '/chat', label: 'Chat', icon: 'mdi-chat', resources: ['chat'] },
	{ to: '/agentes', label: 'Agentes', icon: 'mdi-robot', resources: ['agents', 'governance'] },
	{
		to: '/gobernanza',
		label: 'Gobernanza',
		icon: 'mdi-shield-check',
		resources: ['governance', 'governance_suggestion']
	},
	{ to: '/mcps', label: 'MCPs', icon: 'mdi-server', resources: ['mcp_servers', 'hook_servers', 'event_listeners'] },
	{ to: '/clarify', label: 'Clarify', icon: 'mdi-book-open-page-variant-outline', resources: ['clarify'], accessResource: 'clarify' },
	{ to: '/traceability', label: 'Trazabilidad', icon: 'mdi-sitemap', resources: ['traceability'] },
	{ to: '/proyectos', label: 'Proyectos', icon: 'mdi-folder-multiple', resources: ['proyectos'] },
	{ to: '/admin', label: 'Admin', icon: 'mdi-shield-account', resources: ['users', 'roles', 'mcp_credentials'] },
	{ to: '/config', label: 'Configuración', icon: 'mdi-cog-transfer', resources: ['users'] }
]

const navLinks = computed(() =>
	allNavLinks.filter((l) => {
		if (l.accessResource) return auth.hasResourceAccess(l.accessResource)
		return l.resources === null || auth.hasAnyResourceManageAccess(l.resources)
	})
)

function logout() {
	auth.logout()
	router.push('/login')
}
</script>

<template>
  <aside class="flex flex-col w-18 shrink-0 bg-base-200 h-full rounded-lg  shadow-sm">
    <!-- Logo -->
    <div class="flex items-center gap-3 px-5 py-5 border-b border-base-300/60">
      <div
        class="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
        AM
      </div>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 px-3 py-4 space-y-1">
      <RouterLink v-for="link in navLinks" :key="link.to" :to="link.to"
        class="flex items-center gap-3 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors routes" :class="(link.to === '/' ? route.path === '/' : route.path.startsWith(link.to))
          ? 'bg-primary text-primary-content'
          : 'text-base-content/60 hover:text-base-content hover:bg-base-300'
          ">
        <i class="mdi text-lg" :class="link.icon"></i>
        <!-- <span class="w-6 h-6 rounded flex items-center justify-center text-xs font-bold shrink-0"
          :class="(link.to === '/' ? route.path === '/' : route.path.startsWith(link.to)) ? 'bg-indigo-500' : 'bg-base-100'">
        </span> -->
        <div class="absolute ml-9 p-2 rounded-xl text-[11px] tooltip" :class="(link.to === '/' ? route.path === '/' : route.path.startsWith(link.to))
          ? 'bg-primary text-primary-content'
          : 'text-neutral-content bg-neutral'">
          {{ link.label }}
        </div>
      </RouterLink>
    </nav>

    <!-- User Info & Logout -->
    <div class="border-t border-base-300/60 px-4 py-4 ">
      <div v-if="auth.user" class="mb-3 routes">
        <div v-if="auth.user" class="tooltip ml-13 p-2 rounded-xl absolute text-neutral-content bg-neutral">
          <p class="text-sm font-medium truncate">{{ auth.user.username }}</p>
          <p class="text-xs opacity-70 truncate">{{ auth.user.email }}</p>
        </div>
        <p class="text-sm font-medium text-base-content truncate">{{ auth.user.username }}</p>
        <p class="text-xs text-base-content/60 truncate">{{ auth.user.email }}</p>
      </div>
      <div class="flex gap-1">
        <button
          class="w-full flex items-center justify-center p-1 rounded-lg text-sm font-medium text-base-content/60 hover:text-base-content hover:bg-base-300 transition-colors routes"
          @click="themeStore.toggle()">
          <span class="mdi" :class="themeStore.theme === 'am-dark' ? 'mdi-weather-sunny' : 'mdi-weather-night'"></span>
        </button>
        <button
          class="w-full flex items-center justify-center p-1 rounded-lg text-sm font-medium text-base-content/60 hover:text-base-content hover:bg-base-300 transition-colors"
          @click="logout">
          <span class="mdi mdi-logout"></span>
        </button>
      </div>
      <p class="text-center text-base-content/40 text-[10px] mt-2 font-mono">v{{ appVersion }}</p>
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
