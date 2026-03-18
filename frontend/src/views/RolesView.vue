<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import AppLayout from '@/components/AppLayout.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useToastStore } from '@/store/useToast'
import * as api from '@/api/api'
import type { Role, Permission } from '@/types/types'

const toast = useToastStore()

const roles = ref<Role[]>([])
const loading = ref(false)

// Role modal
const showRoleModal = ref(false)
const editingRole = ref<Role | null>(null)
const roleForm = ref({ name: '', description: '' })
const saving = ref(false)

// Delete
const deleteTarget = ref<Role | null>(null)
const deleting = ref(false)

// Permissions modal
const permsModalRole = ref<Role | null>(null)
const permsModalRoleDetail = ref<Role | null>(null)
const allPermissions = ref<Permission[]>([])
const togglingPerm = ref<string | null>(null)

async function fetchData() {
  loading.value = true
  try {
    const data = await api.getRoles()
    roles.value = data
  } catch (e: any) {
    toast.error(e.message ?? 'Failed to load roles')
  } finally {
    loading.value = false
  }
}

onMounted(fetchData)

function openCreate() {
  editingRole.value = null
  roleForm.value = { name: '', description: '' }
  showRoleModal.value = true
}

function openEdit(role: Role) {
  editingRole.value = role
  roleForm.value = { name: role.name, description: role.description ?? '' }
  showRoleModal.value = true
}

function closeRoleModal() {
  showRoleModal.value = false
  editingRole.value = null
}

async function saveRole() {
  saving.value = true
  try {
    const payload = {
      name: roleForm.value.name,
      description: roleForm.value.description || undefined,
    }
    if (editingRole.value) {
      await api.updateRole(editingRole.value.id, payload)
      toast.success('Role updated')
    } else {
      await api.createRole(payload)
      toast.success('Role created')
    }
    closeRoleModal()
    await fetchData()
  } catch (e: any) {
    toast.error(e.message ?? 'Failed to save role')
  } finally {
    saving.value = false
  }
}

function confirmDelete(role: Role) {
  deleteTarget.value = role
}

async function doDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await api.deleteRole(deleteTarget.value.id)
    toast.success('Role deleted')
    deleteTarget.value = null
    await fetchData()
  } catch (e: any) {
    toast.error(e.message ?? 'Failed to delete role')
  } finally {
    deleting.value = false
  }
}

async function openPermsModal(role: Role) {
  permsModalRole.value = role
  permsModalRoleDetail.value = null
  allPermissions.value = []
  try {
    const detail = await api.getRoleById(role.id)
    permsModalRoleDetail.value = detail

    // Collect all known permissions across all roles
    const allRoles = await api.getRoles()
    const permsMap = new Map<string, Permission>()
    for (const r of allRoles) {
      const rd = await api.getRoleById(r.id)
      for (const p of (rd.permissions ?? [])) {
        permsMap.set(p.id, p)
      }
    }
    // Also add assigned perms from current role
    for (const p of (detail.permissions ?? [])) {
      permsMap.set(p.id, p)
    }
    allPermissions.value = Array.from(permsMap.values())
  } catch (e: any) {
    toast.error(e.message ?? 'Failed to load permissions')
  }
}

function closePermsModal() {
  permsModalRole.value = null
  permsModalRoleDetail.value = null
}

function roleHasPerm(permId: string): boolean {
  return (permsModalRoleDetail.value?.permissions ?? []).some((p: Permission) => p.id === permId)
}

async function togglePerm(permId: string) {
  if (!permsModalRole.value) return
  togglingPerm.value = permId
  try {
    if (roleHasPerm(permId)) {
      await api.removePermission(permsModalRole.value.id, permId)
      toast.success('Permission removed')
    } else {
      await api.assignPermission(permsModalRole.value.id, permId)
      toast.success('Permission assigned')
    }
    const detail = await api.getRoleById(permsModalRole.value.id)
    permsModalRoleDetail.value = detail
    await fetchData()
  } catch (e: any) {
    toast.error(e.message ?? 'Failed to update permission')
  } finally {
    togglingPerm.value = null
  }
}

// Group permissions by resource
const groupedPermissions = computed(() => {
  const groups: Record<string, Permission[]> = {}
  for (const p of allPermissions.value) {
    if (!groups[p.resource]) groups[p.resource] = []
    groups[p.resource].push(p)
  }
  return groups
})
</script>

<template>
  <AppLayout>
    <div class="p-8">
      <!-- Header -->
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-2xl font-bold text-slate-800">Roles</h1>
          <p class="text-slate-500 text-sm mt-0.5">Manage roles and permission assignments</p>
        </div>
        <button
          class="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
          @click="openCreate"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Create Role
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-20">
        <svg class="animate-spin h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>

      <!-- Table -->
      <div v-else class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-slate-200 bg-slate-50">
              <th class="text-left px-6 py-3.5 font-semibold text-slate-600">Name</th>
              <th class="text-left px-6 py-3.5 font-semibold text-slate-600">Description</th>
              <th class="text-left px-6 py-3.5 font-semibold text-slate-600">Permissions</th>
              <th class="text-left px-6 py-3.5 font-semibold text-slate-600">Status</th>
              <th class="text-right px-6 py-3.5 font-semibold text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="role in roles"
              :key="role.id"
              class="hover:bg-slate-50 transition-colors cursor-pointer"
              @click="openPermsModal(role)"
            >
              <td class="px-6 py-4 font-medium text-slate-800">{{ role.name }}</td>
              <td class="px-6 py-4 text-slate-500">{{ role.description || '—' }}</td>
              <td class="px-6 py-4">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">
                  {{ (role.permissions ?? []).length }} permission{{ (role.permissions ?? []).length !== 1 ? 's' : '' }}
                </span>
              </td>
              <td class="px-6 py-4">
                <span
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                  :class="role.active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'"
                >
                  {{ role.active ? 'Active' : 'Inactive' }}
                </span>
              </td>
              <td class="px-6 py-4">
                <div class="flex items-center justify-end gap-2" @click.stop>
                  <button
                    class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                    title="Edit role"
                    @click="openEdit(role)"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    class="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Delete role"
                    @click="confirmDelete(role)"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!roles.length">
              <td colspan="5" class="px-6 py-12 text-center text-slate-400">No roles found</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Role Create/Edit Modal -->
    <div v-if="showRoleModal" class="fixed inset-0 z-40 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closeRoleModal" />
      <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div class="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
          <h2 class="text-lg font-semibold text-slate-800">{{ editingRole ? 'Edit Role' : 'Create Role' }}</h2>
          <button class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition" @click="closeRoleModal">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form class="px-6 py-5 space-y-4" @submit.prevent="saveRole">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1.5">Name <span class="text-red-500">*</span></label>
            <input v-model="roleForm.name" type="text" placeholder="Role name" required
              class="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
            <textarea v-model="roleForm.description" placeholder="Optional description" rows="3"
              class="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none" />
          </div>
          <div class="flex gap-3 pt-2">
            <button type="button" class="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors" @click="closeRoleModal">
              Cancel
            </button>
            <button type="submit" :disabled="saving"
              class="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors">
              {{ saving ? 'Saving...' : editingRole ? 'Save Changes' : 'Create Role' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Permissions Modal -->
    <div v-if="permsModalRole" class="fixed inset-0 z-40 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closePermsModal" />
      <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden flex flex-col max-h-[80vh]">
        <div class="px-6 py-5 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <h2 class="text-lg font-semibold text-slate-800">Manage Permissions</h2>
            <p class="text-sm text-slate-500">{{ permsModalRole.name }}</p>
          </div>
          <button class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition" @click="closePermsModal">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto px-6 py-5">
          <div v-if="!permsModalRoleDetail" class="flex justify-center py-8">
            <svg class="animate-spin h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
          <div v-else-if="!allPermissions.length" class="text-center text-slate-400 py-8 text-sm">
            No permissions available in the system
          </div>
          <div v-else class="space-y-4">
            <div v-for="(perms, resource) in groupedPermissions" :key="resource">
              <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{{ resource }}</h3>
              <div class="space-y-1">
                <div
                  v-for="perm in perms"
                  :key="perm.id"
                  class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                  @click="togglePerm(perm.id)"
                >
                  <input
                    type="checkbox"
                    :checked="roleHasPerm(perm.id)"
                    :disabled="togglingPerm === perm.id"
                    class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                    @click.stop
                    @change="togglePerm(perm.id)"
                  />
                  <div class="flex-1">
                    <span class="text-sm font-medium text-slate-700">{{ perm.action }}</span>
                    <span v-if="perm.description" class="text-xs text-slate-400 block">{{ perm.description }}</span>
                  </div>
                  <span class="text-xs text-slate-400 font-mono">{{ resource }}:{{ perm.action }}</span>
                  <svg v-if="togglingPerm === perm.id" class="animate-spin h-4 w-4 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 border-t border-slate-200 shrink-0">
          <button class="w-full px-4 py-2.5 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700 transition-colors" @click="closePermsModal">
            Done
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirm -->
    <ConfirmDialog
      v-if="deleteTarget"
      title="Delete Role"
      :message="`Are you sure you want to delete the role &quot;${deleteTarget.name}&quot;? This action cannot be undone.`"
      :loading="deleting"
      @confirm="doDelete"
      @cancel="deleteTarget = null"
    />
  </AppLayout>
</template>
