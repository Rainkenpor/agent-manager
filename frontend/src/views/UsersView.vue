<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AppLayout from '@/components/AppLayout.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useToastStore } from '@/store/useToast'
import * as api from '@/api/api'
import type { User, Role } from '@/types/types'

const toast = useToastStore()

const users = ref<User[]>([])
const allRoles = ref<Role[]>([])
const loading = ref(false)

// Modal state
const showUserModal = ref(false)
const editingUser = ref<User | null>(null)
const userForm = ref({
  email: '',
  username: '',
  password: '',
  firstName: '',
  lastName: '',
})
const saving = ref(false)

// Delete
const deleteTarget = ref<User | null>(null)
const deleting = ref(false)

// Roles modal
const rolesModalUser = ref<User | null>(null)
const rolesModalUserDetail = ref<User | null>(null)
const togglingRole = ref<string | null>(null)

async function fetchData() {
  loading.value = true
  try {
    const [usersRes, rolesRes] = await Promise.all([api.getUsers(), api.getRoles()])
    users.value = usersRes
    allRoles.value = rolesRes
  } catch (e: any) {
    toast.error(e.message ?? 'Failed to load data')
  } finally {
    loading.value = false
  }
}

onMounted(fetchData)

function openCreate() {
  editingUser.value = null
  userForm.value = { email: '', username: '', password: '', firstName: '', lastName: '' }
  showUserModal.value = true
}

function openEdit(user: User) {
  editingUser.value = user
  userForm.value = {
    email: user.email,
    username: user.username,
    password: '',
    firstName: user.firstName ?? '',
    lastName: user.lastName ?? '',
  }
  showUserModal.value = true
}

function closeUserModal() {
  showUserModal.value = false
  editingUser.value = null
}

async function saveUser() {
  saving.value = true
  try {
    if (editingUser.value) {
      const payload: any = {
        email: userForm.value.email,
        firstName: userForm.value.firstName || undefined,
        lastName: userForm.value.lastName || undefined,
      }
      if (userForm.value.password) payload.password = userForm.value.password
      await api.updateUser(editingUser.value.id, payload)
      toast.success('User updated successfully')
    } else {
      const payload: any = {
        email: userForm.value.email,
        username: userForm.value.username,
        password: userForm.value.password,
      }
      if (userForm.value.firstName) payload.firstName = userForm.value.firstName
      if (userForm.value.lastName) payload.lastName = userForm.value.lastName
      await api.createUser(payload)
      toast.success('User created successfully')
    }
    closeUserModal()
    await fetchData()
  } catch (e: any) {
    toast.error(e.message ?? 'Failed to save user')
  } finally {
    saving.value = false
  }
}

function confirmDelete(user: User) {
  deleteTarget.value = user
}

async function doDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await api.deleteUser(deleteTarget.value.id)
    toast.success('User deleted')
    deleteTarget.value = null
    await fetchData()
  } catch (e: any) {
    toast.error(e.message ?? 'Failed to delete user')
  } finally {
    deleting.value = false
  }
}

async function openRolesModal(user: User) {
  rolesModalUser.value = user
  rolesModalUserDetail.value = null
  try {
    const detail = await api.getUserById(user.id)
    rolesModalUserDetail.value = detail
  } catch (e: any) {
    toast.error(e.message ?? 'Failed to load user details')
  }
}

function closeRolesModal() {
  rolesModalUser.value = null
  rolesModalUserDetail.value = null
}

function userHasRole(roleId: string): boolean {
  return (rolesModalUserDetail.value?.roles ?? []).some((r: Role) => r.id === roleId)
}

async function toggleRole(roleId: string) {
  if (!rolesModalUser.value) return
  togglingRole.value = roleId
  try {
    if (userHasRole(roleId)) {
      await api.removeRole(rolesModalUser.value.id, roleId)
      toast.success('Role removed')
    } else {
      await api.assignRole(rolesModalUser.value.id, roleId)
      toast.success('Role assigned')
    }
    const detail = await api.getUserById(rolesModalUser.value.id)
    rolesModalUserDetail.value = detail
    await fetchData()
  } catch (e: any) {
    toast.error(e.message ?? 'Failed to update role')
  } finally {
    togglingRole.value = null
  }
}
</script>

<template>
  <AppLayout>
    <div class="p-8">
      <!-- Header -->
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-2xl font-bold text-slate-800">Users</h1>
          <p class="text-slate-500 text-sm mt-0.5">Manage user accounts and role assignments</p>
        </div>
        <button
          class="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
          @click="openCreate"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Create User
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
              <th class="text-left px-6 py-3.5 font-semibold text-slate-600">Username</th>
              <th class="text-left px-6 py-3.5 font-semibold text-slate-600">Email</th>
              <th class="text-left px-6 py-3.5 font-semibold text-slate-600">Name</th>
              <th class="text-left px-6 py-3.5 font-semibold text-slate-600">Roles</th>
              <th class="text-left px-6 py-3.5 font-semibold text-slate-600">Status</th>
              <th class="text-right px-6 py-3.5 font-semibold text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="user in users"
              :key="user.id"
              class="hover:bg-slate-50 transition-colors cursor-pointer"
              @click="openRolesModal(user)"
            >
              <td class="px-6 py-4 font-medium text-slate-800">{{ user.username }}</td>
              <td class="px-6 py-4 text-slate-600">{{ user.email }}</td>
              <td class="px-6 py-4 text-slate-600">
                {{ [user.firstName, user.lastName].filter(Boolean).join(' ') || '—' }}
              </td>
              <td class="px-6 py-4">
                <div class="flex flex-wrap gap-1.5">
                  <span
                    v-for="role in (user.roles ?? []).slice(0, 3)"
                    :key="role.id"
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700"
                  >
                    {{ role.name }}
                  </span>
                  <span
                    v-if="(user.roles ?? []).length > 3"
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600"
                  >
                    +{{ (user.roles ?? []).length - 3 }}
                  </span>
                  <span v-if="!(user.roles ?? []).length" class="text-slate-400 text-xs">No roles</span>
                </div>
              </td>
              <td class="px-6 py-4">
                <span
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                  :class="user.active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'"
                >
                  {{ user.active ? 'Active' : 'Inactive' }}
                </span>
              </td>
              <td class="px-6 py-4">
                <div class="flex items-center justify-end gap-2" @click.stop>
                  <button
                    class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                    title="Edit user"
                    @click="openEdit(user)"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    class="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Delete user"
                    @click="confirmDelete(user)"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!users.length">
              <td colspan="6" class="px-6 py-12 text-center text-slate-400">No users found</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- User Create/Edit Modal -->
    <div v-if="showUserModal" class="fixed inset-0 z-40 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closeUserModal" />
      <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div class="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
          <h2 class="text-lg font-semibold text-slate-800">
            {{ editingUser ? 'Edit User' : 'Create User' }}
          </h2>
          <button class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition" @click="closeUserModal">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form class="px-6 py-5 space-y-4" @submit.prevent="saveUser">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1.5">First Name</label>
              <input v-model="userForm.firstName" type="text" placeholder="Optional"
                class="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1.5">Last Name</label>
              <input v-model="userForm.lastName" type="text" placeholder="Optional"
                class="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1.5">Username <span class="text-red-500">*</span></label>
            <input v-model="userForm.username" type="text" placeholder="username" required :disabled="!!editingUser"
              class="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1.5">Email <span class="text-red-500">*</span></label>
            <input v-model="userForm.email" type="email" placeholder="user@example.com" required
              class="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1.5">
              Password {{ editingUser ? '(leave blank to keep current)' : '' }}
              <span v-if="!editingUser" class="text-red-500">*</span>
            </label>
            <input v-model="userForm.password" type="password" placeholder="Password" :required="!editingUser"
              class="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div class="flex gap-3 pt-2">
            <button type="button" class="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors" @click="closeUserModal">
              Cancel
            </button>
            <button type="submit" :disabled="saving"
              class="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors">
              {{ saving ? 'Saving...' : editingUser ? 'Save Changes' : 'Create User' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Roles Modal -->
    <div v-if="rolesModalUser" class="fixed inset-0 z-40 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closeRolesModal" />
      <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div class="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold text-slate-800">Manage Roles</h2>
            <p class="text-sm text-slate-500">{{ rolesModalUser.username }}</p>
          </div>
          <button class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition" @click="closeRolesModal">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="px-6 py-5">
          <div v-if="!rolesModalUserDetail" class="flex justify-center py-8">
            <svg class="animate-spin h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="role in allRoles"
              :key="role.id"
              class="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              @click="toggleRole(role.id)"
            >
              <div class="relative">
                <input
                  type="checkbox"
                  :checked="userHasRole(role.id)"
                  :disabled="togglingRole === role.id"
                  class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                  @click.stop
                  @change="toggleRole(role.id)"
                />
              </div>
              <div class="flex-1">
                <p class="text-sm font-medium text-slate-800">{{ role.name }}</p>
                <p v-if="role.description" class="text-xs text-slate-400">{{ role.description }}</p>
              </div>
              <svg v-if="togglingRole === role.id" class="animate-spin h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            </div>
            <div v-if="!allRoles.length" class="text-center text-slate-400 py-6 text-sm">No roles available</div>
          </div>
        </div>
        <div class="px-6 pb-5">
          <button class="w-full px-4 py-2.5 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700 transition-colors" @click="closeRolesModal">
            Done
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirm -->
    <ConfirmDialog
      v-if="deleteTarget"
      title="Delete User"
      :message="`Are you sure you want to delete &quot;${deleteTarget.username}&quot;? This action cannot be undone.`"
      :loading="deleting"
      @confirm="doDelete"
      @cancel="deleteTarget = null"
    />
  </AppLayout>
</template>
