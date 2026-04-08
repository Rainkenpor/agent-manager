import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/store/useAuth'

const router = createRouter({
  history: createWebHistory('/'),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/users',
      name: 'users',
      component: () => import('@/views/UsersView.vue'),
      meta: { requiresAuth: true, resource: 'users' },
    },
    {
      path: '/roles',
      name: 'roles',
      component: () => import('@/views/RolesView.vue'),
      meta: { requiresAuth: true, resource: 'roles' },
    },
    {
      path: '/agents',
      name: 'agents',
      component: () => import('@/views/AgentsView.vue'),
      meta: { requiresAuth: true, resource: 'agents' },
    },
    {
      path: '/mcps',
      name: 'mcps',
      component: () => import('@/views/McpServersView.vue'),
      meta: { requiresAuth: true, resource: 'mcp_servers' },
    },
    {
      path: '/chat',
      name: 'chat',
      component: () => import('@/views/ChatView.vue'),
      meta: { requiresAuth: true, resource: 'chat' },
    },
    {
      path: '/mcp-credentials',
      name: 'mcp-credentials',
      component: () => import('@/views/McpCredentialsView.vue'),
      meta: { requiresAuth: true, resource: 'mcp_credentials' },
    },
    {
      path: '/skills',
      name: 'skills',
      component: () => import('@/views/SkillsView.vue'),
      meta: { requiresAuth: true, resource: 'skills' },
    },
    {
      path: '/traceability',
      name: 'traceability',
      component: () => import('@/views/TraceabilityView.vue'),
      meta: { requiresAuth: true, resource: 'traceability' },
    },
    {
      path: '/oauth/authorize/mcp',
      name: 'oauth-authorize-mcp',
      component: () => import('@/views/OAuthAuthorizeView.vue'),
      meta: { requiresAuth: false },
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
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
  if (resource && auth.isAuthenticated && !auth.hasResourceAccess(resource)) {
    return { name: 'home' }
  }
})

export default router
