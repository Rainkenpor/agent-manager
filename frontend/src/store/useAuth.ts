import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as api from '@/api/api'
import type { User, Permission } from '@/types/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem('token'))
  const isAuthenticated = computed(() => !!token.value && !!user.value)

  async function login(credentials: { username: string; password: string }) {
    const res = await api.login(credentials)
    token.value = res.token
    user.value = res.user
    localStorage.setItem('token', res.token)
  }

  async function loginWithToken(jwtToken: string) {
    token.value = jwtToken
    localStorage.setItem('token', jwtToken)
    await fetchCurrentUser()
  }

  function logout() {
    user.value = null
    token.value = null
    localStorage.removeItem('token')
  }

  async function fetchCurrentUser() {
    try {
      const me = await api.getMe()
      user.value = me
    } catch {
      logout()
    }
  }

  function hasPermission(resource: string, action: string): boolean {
    if (!user.value) return false
    const perms: Permission[] = user.value.permissions ?? []
    return perms.some((p) => p.resource === resource && p.action === action)
  }

  return {
    user,
    token,
    isAuthenticated,
    login,
    loginWithToken,
    logout,
    fetchCurrentUser,
    hasPermission,
  }
})
