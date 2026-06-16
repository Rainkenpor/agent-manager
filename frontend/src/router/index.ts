import { createRouter, createWebHistory } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'
import { useAuthStore } from '@/store/useAuth'

const router = createRouter({
	history: createWebHistory(__BASE_URL__),
	routes: [
		{
			path: '/login',
			name: 'login',
			component: () => import('@/views/LoginView.vue'),
			meta: { requiresAuth: false }
		},
		{
			path: '/oauth/authorize/mcp',
			name: 'oauth-authorize-mcp',
			component: () => import('@/views/OAuthAuthorizeView.vue'),
			meta: { requiresAuth: false }
		},
		{
			path: '/conocimiento-distelsa',
			name: 'public-chat',
			component: () => import('@/views/PublicChatView.vue'),
			meta: { requiresAuth: false }
		},
		{
			path: '/',
			component: AppLayout,
			meta: { requiresAuth: true },
			children: [
				{
					path: '',
					name: 'home',
					component: () => import('@/views/HomeView.vue')
				},
				{
					path: 'chat',
					name: 'chat',
					component: () => import('@/views/ChatView.vue'),
					meta: { resource: 'chat' }
				},
				{
					path: 'agentes',
					name: 'agentes',
					component: () => import('@/views/AgentesView.vue'),
					meta: { resources: ['agents', 'governance'] }
				},
				{
					path: 'gobernanza',
					name: 'gobernanza',
					component: () => import('@/views/GovernanceView.vue'),
					meta: { resources: ['governance', 'governance_suggestion'] }
				},
				{
					path: 'mcps',
					name: 'mcps',
					component: () => import('@/views/McpHubView.vue'),
					meta: { resources: ['mcp_servers', 'hook_servers', 'event_listeners'] }
				},
				{
					path: 'clarify',
					name: 'clarify',
					component: () => import('@/views/ClarifyView.vue'),
					meta: { resourceAccess: 'clarify' }
				},
				{
					path: 'traceability',
					name: 'traceability',
					component: () => import('@/views/TraceabilityView.vue'),
					meta: { resource: 'traceability' }
				},
				{
					path: 'admin',
					name: 'admin',
					component: () => import('@/views/AdminView.vue'),
					meta: { resources: ['users', 'roles', 'mcp_credentials'] }
				},
				{
					path: 'config',
					name: 'config',
					component: () => import('@/views/ConfigView.vue'),
					meta: { resources: ['users', 'llm_tokens', 'webhooks'] }
				},
				// Redirects for backward compatibility
				{ path: 'agents', redirect: '/agentes' },
				{ path: 'skills', redirect: '/agentes' },
				{ path: 'mcps', redirect: '/mcps' },
				{ path: 'mcp-credentials', redirect: '/mcps' },
				{ path: 'hook-servers', redirect: '/automatizacion' },
				{ path: 'event-listeners', redirect: '/automatizacion' },
				{ path: 'users', redirect: '/admin' },
				{ path: 'roles', redirect: '/admin' }
			]
		}
	]
})

router.beforeEach(async (to) => {
	const auth = useAuthStore()

	const requiresAuth = to.matched.some((r) => r.meta.requiresAuth)

	if (requiresAuth && !auth.isAuthenticated) {
		if (auth.token) {
			await auth.fetchCurrentUser()
			if (!auth.isAuthenticated) {
				return { name: 'login' }
			}
		} else {
			return { name: 'login' }
		}
	}

	if (to.name === 'login' && auth.isAuthenticated) {
		return { path: '/' }
	}

	const resource = to.meta.resource as string | undefined
	if (resource && auth.isAuthenticated && !auth.hasResourceManageAccess(resource)) {
		return { name: 'home' }
	}

	const resources = to.meta.resources as string[] | undefined
	if (resources && auth.isAuthenticated && !auth.hasAnyResourceManageAccess(resources)) {
		return { name: 'home' }
	}

	const resourceAccess = to.meta.resourceAccess as string | undefined
	if (resourceAccess && auth.isAuthenticated && !auth.hasResourceAccess(resourceAccess)) {
		return { name: 'home' }
	}
})

export default router
