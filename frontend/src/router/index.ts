import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/store/useAuth'
import AppLayout from '@/components/AppLayout.vue'

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
      path: '/oauth/authorize/mcp',
      name: 'oauth-authorize-mcp',
      component: () => import('@/views/OAuthAuthorizeView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/',
      component: AppLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'home',
          component: () => import('@/views/HomeView.vue'),
        },
        {
          path: 'users',
          name: 'users',
          component: () => import('@/views/UsersView.vue'),
          meta: { resource: 'users' },
        },
        {
          path: 'roles',
          name: 'roles',
          component: () => import('@/views/RolesView.vue'),
          meta: { resource: 'roles' },
        },
        {
          path: 'agents',
          name: 'agents',
          component: () => import('@/views/AgentsView.vue'),
          meta: { resource: 'agents' },
        },
        {
          path: 'mcps',
          name: 'mcps',
          component: () => import('@/views/McpServersView.vue'),
          meta: { resource: 'mcp_servers' },
        },
        {
          path: 'chat',
          name: 'chat',
          component: () => import('@/views/ChatView.vue'),
          meta: { resource: 'chat' },
        },
        {
          path: 'mcp-credentials',
          name: 'mcp-credentials',
          component: () => import('@/views/McpCredentialsView.vue'),
          meta: { resource: 'mcp_credentials' },
        },
        {
          path: 'skills',
          name: 'skills',
          component: () => import('@/views/SkillsView.vue'),
          meta: { resource: 'skills' },
        },
        {
          path: 'traceability',
          name: 'traceability',
          component: () => import('@/views/TraceabilityView.vue'),
          meta: { resource: 'traceability' },
        },
        {
          path: 'hook-servers',
          name: 'hook-servers',
          component: () => import('@/views/HookServersView.vue'),
          meta: { resource: 'hook_servers' },
        },
        {
          path: 'event-listeners',
          name: 'event-listeners',
          component: () => import('@/views/EventListenerView.vue'),
          meta: { resource: 'event_listeners' },
        },
      ],
    },
  ],
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
  if (resource && auth.isAuthenticated && !auth.hasResourceAccess(resource)) {
    return { name: 'home' }
  }
})

export default router
