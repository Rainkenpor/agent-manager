<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { RouterLink } from 'vue-router'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import PageLayout from '@/components/PageLayout.vue'
import { useToastStore } from '@/store/useToast'
import * as api from '@/api/api'
import type { Role, McpServer, Agent, McpTool } from '@/types/types'

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

// Role associations modal
const assocModalRole = ref<Role | null>(null)
const assocTab = ref<'mcps' | 'agents' | 'permissions' | 'skills'>('mcps')
const assocLoading = ref(false)

// Available items
const allMcps = ref<McpServer[]>([])
const allAgents = ref<Agent[]>([])

// Assigned items for selected role
const assignedMcps = ref<McpServer[]>([])
const assignedAgents = ref<Array<{ id: string; name: string; slug: string; mode: string }>>([])

const toggling = ref<string | null>(null)

// Permissions
const allPermissions = ref<Array<{ id: string; resource: string; action: string; description?: string }>>([])
const assignedPermissions = ref<Array<{ id: string; resource: string; action: string }>>([])

// Skills
const allSkills = ref<Array<{ id: string; name: string; slug: string; description?: string | null; isActive: boolean }>>([])
const assignedSkills = ref<Array<{ id: string; name: string; slug: string }>>([])

// ── Tool selection sub-panel ──────────────────────────────────────────────────
const toolPanelMcp = ref<McpServer | null>(null)
const availableTools = ref<McpTool[]>([])
const selectedTools = ref<Set<string>>(new Set())
const toolsLoading = ref(false)
const toolsSaving = ref(false)

async function fetchData() {
  loading.value = true
  try {
    roles.value = await api.getRoles()
  } catch (e: any) {
    toast.error(e.message ?? 'Failed to load roles')
  } finally {
    loading.value = false
  }
}

onMounted(fetchData)

// ── Role CRUD ──────────────────────────────────────────────────────────────

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

// ── Associations modal ─────────────────────────────────────────────────────

async function openAssocModal(role: Role) {
  assocModalRole.value = role
  assocTab.value = 'mcps'
  assocLoading.value = true
  assignedMcps.value = []
  assignedAgents.value = []
  assignedPermissions.value = []
  assignedSkills.value = []
  toolPanelMcp.value = null
  try {
    const [mcpsRes, agentsRes, mcpAssignedRes, agentAssignedRes, allPermsRes, rolePermsRes, allSkillsRes, roleSkillsRes] = await Promise.all([
      api.getMcpServers(),
      api.getAgents(),
      api.getRoleMcps(role.id),
      api.getRoleAgents(role.id),
      api.getPermissions(),
      api.getRolePermissions(role.id),
      api.getSkills(),
      api.getRoleSkills(role.id),
    ])
    allMcps.value = (mcpsRes.data ?? (mcpsRes as any)).filter((m: McpServer) => m.active)
    allAgents.value = (agentsRes.data ?? (agentsRes as any)).filter((a: Agent) => a.isActive)
    assignedMcps.value = mcpAssignedRes.data ?? (mcpAssignedRes as any)
    assignedAgents.value = agentAssignedRes.data ?? (agentAssignedRes as any)
    allPermissions.value = allPermsRes ?? []
    assignedPermissions.value = rolePermsRes ?? []
    allSkills.value = (allSkillsRes.data ?? []).filter((s: { isActive: boolean }) => s.isActive)
    assignedSkills.value = roleSkillsRes.data ?? []
  } catch (e: any) {
    toast.error(e.message ?? 'Failed to load associations')
  } finally {
    assocLoading.value = false
  }
}

function closeAssocModal() {
  assocModalRole.value = null
  toolPanelMcp.value = null
}

function hasMcp(mcpId: string): boolean {
  return assignedMcps.value.some((m) => m.id === mcpId)
}

function hasAgent(agentId: string): boolean {
  return assignedAgents.value.some((a) => a.id === agentId)
}

async function toggleMcp(mcpId: string) {
  if (!assocModalRole.value) return
  toggling.value = mcpId
  try {
    if (hasMcp(mcpId)) {
      await api.removeMcpFromRole(assocModalRole.value.id, mcpId)
      assignedMcps.value = assignedMcps.value.filter((m) => m.id !== mcpId)
      if (toolPanelMcp.value?.id === mcpId) toolPanelMcp.value = null
      toast.success('MCP removed from role')
    } else {
      await api.assignMcpToRole(assocModalRole.value.id, mcpId)
      const mcp = allMcps.value.find((m) => m.id === mcpId)
      if (mcp) assignedMcps.value.push(mcp)
      toast.success('MCP assigned to role')
    }
  } catch (e: any) {
    toast.error(e.message ?? 'Failed to update MCP')
  } finally {
    toggling.value = null
  }
}

async function toggleAgent(agentId: string) {
  if (!assocModalRole.value) return
  toggling.value = agentId
  try {
    if (hasAgent(agentId)) {
      await api.removeAgentFromRole(assocModalRole.value.id, agentId)
      assignedAgents.value = assignedAgents.value.filter((a) => a.id !== agentId)
      toast.success('Agent removed from role')
    } else {
      await api.assignAgentToRole(assocModalRole.value.id, agentId)
      const agent = allAgents.value.find((a) => a.id === agentId)
      if (agent) assignedAgents.value.push({ id: agent.id, name: agent.name, slug: agent.slug, mode: agent.mode })
      toast.success('Agent assigned to role')
    }
  } catch (e: any) {
    toast.error(e.message ?? 'Failed to update agent')
  } finally {
    toggling.value = null
  }
}

// ── Permissions tab ────────────────────────────────────────────────────────

function hasPermission(permId: string): boolean {
  return assignedPermissions.value.some((p) => p.id === permId)
}

async function togglePermission(permId: string) {
  if (!assocModalRole.value) return
  toggling.value = permId
  try {
    if (hasPermission(permId)) {
      await api.removePermission(assocModalRole.value.id, permId)
      assignedPermissions.value = assignedPermissions.value.filter((p) => p.id !== permId)
      toast.success('Permission removed from role')
    } else {
      await api.assignPermission(assocModalRole.value.id, permId)
      const perm = allPermissions.value.find((p) => p.id === permId)
      if (perm) assignedPermissions.value.push(perm)
      toast.success('Permission assigned to role')
    }
  } catch (e: any) {
    toast.error(e.message ?? 'Failed to update permission')
  } finally {
    toggling.value = null
  }
}

// ── Skills tab ─────────────────────────────────────────────────────────────

function hasSkill(skillId: string): boolean {
  return assignedSkills.value.some((s) => s.id === skillId)
}

async function toggleSkill(skillId: string) {
  if (!assocModalRole.value) return
  toggling.value = skillId
  try {
    if (hasSkill(skillId)) {
      await api.removeSkillFromRole(assocModalRole.value.id, skillId)
      assignedSkills.value = assignedSkills.value.filter((s) => s.id !== skillId)
      toast.success('Skill removed from role')
    } else {
      await api.assignSkillToRole(assocModalRole.value.id, skillId)
      const skill = allSkills.value.find((s) => s.id === skillId)
      if (skill) assignedSkills.value.push({ id: skill.id, name: skill.name, slug: skill.slug })
      toast.success('Skill assigned to role')
    }
  } catch (e: any) {
    toast.error(e.message ?? 'Failed to update skill')
  } finally {
    toggling.value = null
  }
}

// Group permissions by resource
const permissionsByResource = computed(() => {
  const groups: Record<string, typeof allPermissions.value> = {}
  for (const perm of allPermissions.value) {
    if (!groups[perm.resource]) groups[perm.resource] = []
    groups[perm.resource].push(perm)
  }
  return groups
})

// ── Tool selection panel ───────────────────────────────────────────────────

async function openToolPanel(mcp: McpServer) {
  if (!assocModalRole.value) return
  toolPanelMcp.value = mcp
  toolsLoading.value = true
  availableTools.value = []
  selectedTools.value = new Set()
  try {
    const [toolsRes, selectedRes] = await Promise.all([
      api.getMcpServerTools(mcp.id),
      api.getRoleMcpTools(assocModalRole.value.id, mcp.id),
    ])
    availableTools.value = toolsRes.data ?? []
    selectedTools.value = new Set(selectedRes.data ?? [])
  } catch (e: any) {
    toast.error(e.message ?? 'Failed to load tools')
  } finally {
    toolsLoading.value = false
  }
}

function toggleToolSelection(toolName: string) {
  if (selectedTools.value.has(toolName)) {
    selectedTools.value.delete(toolName)
  } else {
    selectedTools.value.add(toolName)
  }
}

function selectAllTools() {
  selectedTools.value = new Set(availableTools.value.map((t) => t.toolName))
}

function clearAllTools() {
  selectedTools.value = new Set()
}

async function saveToolSelection() {
  if (!assocModalRole.value || !toolPanelMcp.value) return
  toolsSaving.value = true
  try {
    await api.setRoleMcpTools(
      assocModalRole.value.id,
      toolPanelMcp.value.id,
      [...selectedTools.value],
    )
    toast.success('Tool selection saved')
    toolPanelMcp.value = null
  } catch (e: any) {
    toast.error(e.message ?? 'Failed to save tools')
  } finally {
    toolsSaving.value = false
  }
}
</script>

<template>
    <PageLayout title="Roles" description="Manage roles, MCP servers and agent assignments">
      <template #actions>
        <button
          class="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
          @click="openCreate">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Create Role
        </button>
      </template>

      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-20">
        <svg class="animate-spin h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>

      <!-- Table -->
      <div v-else class="bg-slate-900 rounded-xl shadow-sm border border-slate-800 overflow-hidden">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-slate-700 bg-slate-800">
              <th class="text-left px-6 py-3.5 font-semibold text-slate-400">Name</th>
              <th class="text-left px-6 py-3.5 font-semibold text-slate-400">Description</th>
              <th class="text-left px-6 py-3.5 font-semibold text-slate-400">Status</th>
              <th class="text-right px-6 py-3.5 font-semibold text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-700">
            <tr v-for="role in roles" :key="role.id" class="hover:bg-slate-800 transition-colors cursor-pointer"
              @click="openAssocModal(role)">
              <td class="px-6 py-4">
                <span class="font-medium text-white">{{ role.name }}</span>
              </td>
              <td class="px-6 py-4 text-slate-400">{{ role.description || '—' }}</td>
              <td class="px-6 py-4">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                  :class="role.active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'">
                  {{ role.active ? 'Active' : 'Inactive' }}
                </span>
              </td>
              <td class="px-6 py-4">
                <div class="flex items-center justify-end gap-2" @click.stop>
                  <button
                    class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                    title="Edit role" @click="openEdit(role)">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button class="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Delete role" @click="confirmDelete(role)">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!roles.length">
              <td colspan="4" class="px-6 py-12 text-center text-slate-400">No roles found</td>
            </tr>
          </tbody>
        </table>
      </div>
    </PageLayout>

    <!-- Role Create / Edit Modal -->
    <div v-if="showRoleModal" class="fixed inset-0 z-40 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closeRoleModal" />
      <div class="relative bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div class="px-6 py-5 border-b border-slate-700 flex items-center justify-between">
          <h2 class="text-lg font-semibold text-white">{{ editingRole ? 'Edit Role' : 'Create Role' }}</h2>
          <button class="p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
            @click="closeRoleModal">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form class="px-6 py-5 space-y-4" @submit.prevent="saveRole">
          <div>
            <label class="block text-sm font-medium text-slate-400 mb-1.5">Name <span
                class="text-red-500">*</span></label>
            <input v-model="roleForm.name" type="text" placeholder="Role name" required
              class="w-full px-3 py-2.5 rounded-lg border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-400 mb-1.5">Description</label>
            <textarea v-model="roleForm.description" placeholder="Optional description" rows="3"
              class="w-full px-3 py-2.5 rounded-lg border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>
          <div class="flex gap-3 pt-2">
            <button type="button"
              class="flex-1 px-4 py-2.5 rounded-lg border border-slate-700 text-sm font-medium text-slate-400 hover:bg-slate-800 transition-colors"
              @click="closeRoleModal">
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

    <!-- Associations Modal (MCPs + Agents) -->
    <div v-if="assocModalRole" class="fixed inset-0 z-40 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closeAssocModal" />

      <!-- Main panel -->
      <div
        class="relative bg-slate-900 rounded-2xl shadow-2xl mx-4 flex flex-col max-h-[85vh] overflow-hidden transition-all"
        :class="toolPanelMcp ? 'w-full max-w-4xl' : 'w-full max-w-2xl'">
        <div class="flex flex-1 min-h-0">

          <!-- Left: role associations -->
          <div class="flex flex-col flex-1 min-w-0 min-h-0">

            <!-- Header -->
            <div class="px-6 py-5 border-b border-slate-700 flex items-center justify-between shrink-0">
              <div>
                <h2 class="text-lg font-semibold text-white">{{ assocModalRole.name }}</h2>
                <p class="text-sm text-slate-500">Manage MCP servers and agents</p>
              </div>
              <button class="p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
                @click="closeAssocModal">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <!-- Tabs -->
            <div class="flex border-b border-slate-700 shrink-0 px-6">
              <button class="px-4 py-3 text-sm font-medium border-b-2 transition-colors"
                :class="assocTab === 'mcps' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'"
                @click="assocTab = 'mcps'">
                <span class="flex items-center gap-2">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                  MCP Servers
                  <span class="bg-blue-100 text-blue-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">{{
                    assignedMcps.length }}</span>
                </span>
              </button>
              <button class="px-4 py-3 text-sm font-medium border-b-2 transition-colors"
                :class="assocTab === 'agents' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'"
                @click="assocTab = 'agents'">
                <span class="flex items-center gap-2">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
                  </svg>
                  Agents
                  <span class="bg-violet-100 text-violet-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">{{
                    assignedAgents.length }}</span>
                </span>
              </button>
              <button class="px-4 py-3 text-sm font-medium border-b-2 transition-colors"
                :class="assocTab === 'permissions' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'"
                @click="assocTab = 'permissions'">
                <span class="flex items-center gap-2">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Permissions
                  <span class="bg-emerald-100 text-emerald-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">{{
                    assignedPermissions.length }}</span>
                </span>
              </button>
              <button class="px-4 py-3 text-sm font-medium border-b-2 transition-colors"
                :class="assocTab === 'skills' ? 'border-fuchsia-600 text-fuchsia-500' : 'border-transparent text-slate-500 hover:text-slate-700'"
                @click="assocTab = 'skills'">
                <span class="flex items-center gap-2">
                  <i class="mdi mdi-lightning-bolt w-4 h-4" />
                  Skills
                  <span v-if="assignedSkills.length"
                    class="bg-fuchsia-100 text-fuchsia-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                    {{ assignedSkills.length }}
                  </span>
                </span>
              </button>
            </div>

            <!-- Content -->
            <div class="flex-1 overflow-y-auto px-6 py-5">
              <div v-if="assocLoading" class="flex justify-center py-10">
                <svg class="animate-spin h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              </div>

              <!-- MCPs tab -->
              <div v-else-if="assocTab === 'mcps'" class="space-y-2">
                <div v-if="!allMcps.length" class="text-center text-slate-400 py-10 text-sm">
                  No MCP servers configured.
                  <RouterLink to="/mcps" class="text-indigo-600 hover:underline ml-1" @click="closeAssocModal">Add some
                    first.</RouterLink>
                </div>
                <div v-for="mcp in allMcps" :key="mcp.id"
                  class="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-slate-700 transition-colors border"
                  :class="hasMcp(mcp.id) ? 'border-slate-600 bg-slate-800' : 'border-transparent'">
                  <!-- Checkbox -->
                  <input type="checkbox" :checked="hasMcp(mcp.id)" :disabled="toggling === mcp.id"
                    class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer shrink-0"
                    @click.stop @change="toggleMcp(mcp.id)" />
                  <!-- Info (clickable to toggle) -->
                  <div class="flex-1 min-w-0 cursor-pointer" @click="toggleMcp(mcp.id)">
                    <div class="flex items-center gap-2">
                      <p class="text-sm font-medium text-white">{{ mcp.displayName || mcp.name }}</p>
                      <span class="px-1.5 py-0.5 rounded text-xs font-medium"
                        :class="mcp.type === 'http' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'">
                        {{ mcp.type }}
                      </span>
                      <span v-if="!mcp.active"
                        class="px-1.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-400">inactive</span>
                    </div>
                    <p v-if="mcp.description" class="text-xs text-slate-400 mt-0.5 truncate">{{ mcp.description }}</p>
                    <p v-else-if="mcp.url" class="text-xs text-slate-400 mt-0.5 font-mono truncate">{{ mcp.url }}</p>
                  </div>
                  <!-- Configure tools button (only if assigned) -->
                  <button v-if="hasMcp(mcp.id)"
                    class="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors"
                    :class="toolPanelMcp?.id === mcp.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'"
                    :title="'Configure tools for ' + (mcp.displayName || mcp.name)"
                    @click.stop="toolPanelMcp?.id === mcp.id ? (toolPanelMcp = null) : openToolPanel(mcp)">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Tools
                  </button>
                  <svg v-if="toggling === mcp.id" class="animate-spin h-4 w-4 text-indigo-400 shrink-0" fill="none"
                    viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                </div>
              </div>

              <!-- Agents tab -->
              <div v-else-if="assocTab === 'agents'" class="space-y-2">
                <div v-if="!allAgents.length" class="text-center text-slate-400 py-10 text-sm">
                  No agents configured.
                  <RouterLink to="/agents" class="text-indigo-600 hover:underline ml-1" @click="closeAssocModal">Create
                    some first.</RouterLink>
                </div>

                <template v-if="allAgents.some(a => a.mode === 'primary')">
                  <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Primary Agents</p>
                  <div v-for="agent in allAgents.filter(a => a.mode === 'primary')" :key="agent.id"
                    class="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-slate-700 transition-colors cursor-pointer border border-transparent"
                    :class="hasAgent(agent.id) ? 'border-slate-600 bg-slate-800' : 'border-transparent'"
                    @click="toggleAgent(agent.id)">
                    <input type="checkbox" :checked="hasAgent(agent.id)" :disabled="toggling === agent.id"
                      class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                      @click.stop @change="toggleAgent(agent.id)" />
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <p class="text-sm font-medium text-white">{{ agent.name }}</p>
                        <span
                          class="px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-600">primary</span>
                      </div>
                      <p class="text-xs text-slate-400 font-mono mt-0.5">agent_{{ agent.slug }}</p>
                    </div>
                    <svg v-if="toggling === agent.id" class="animate-spin h-4 w-4 text-indigo-400 shrink-0" fill="none"
                      viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  </div>
                </template>

                <template v-if="allAgents.some(a => a.mode === 'subagent')">
                  <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-4 mb-2">Subagents</p>
                  <div v-for="agent in allAgents.filter(a => a.mode === 'subagent')" :key="agent.id"
                    class="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-slate-700 transition-colors cursor-pointer border border-transparent"
                    :class="hasAgent(agent.id) ? 'border-slate-600 bg-slate-800' : 'border-transparent'"
                    @click="toggleAgent(agent.id)">
                    <input type="checkbox" :checked="hasAgent(agent.id)" :disabled="toggling === agent.id"
                      class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                      @click.stop @change="toggleAgent(agent.id)" />
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <p class="text-sm font-medium text-white">{{ agent.name }}</p>
                        <span
                          class="px-1.5 py-0.5 rounded text-xs font-medium bg-violet-100 text-violet-600">subagent</span>
                      </div>
                      <p class="text-xs text-slate-400 font-mono mt-0.5">agent_{{ agent.slug }}</p>
                    </div>
                    <svg v-if="toggling === agent.id" class="animate-spin h-4 w-4 text-indigo-400 shrink-0" fill="none"
                      viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  </div>
                </template>
              </div>

              <!-- Skills tab -->
              <div v-else-if="assocTab === 'skills'" class="space-y-2">
                <p class="text-xs text-slate-400 mb-3">
                  <span v-if="assignedSkills.length" class="text-fuchsia-400 font-medium">{{ assignedSkills.length }}
                    skill{{
                      assignedSkills.length !== 1 ? 's' : '' }} asignado{{ assignedSkills.length !== 1 ? 's' : ''
                    }}</span>
                  <span v-else>Sin skills asignados — el rol no tendrá acceso a ningún skill.</span>
                </p>
                <div v-if="!allSkills.filter(s => s.isActive).length" class="text-center text-slate-400 py-10 text-sm">
                  No hay skills configurados.
                  <RouterLink to="/skills" class="text-fuchsia-500 hover:underline ml-1" @click="closeAssocModal">Crea
                    algunos
                    primero.</RouterLink>
                </div>
                <div v-for="skill in allSkills.filter(s => s.isActive)" :key="skill.id"
                  class="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-slate-700 transition-colors cursor-pointer border"
                  :class="hasSkill(skill.id) ? 'border-slate-600 bg-slate-800' : 'border-transparent'"
                  @click="toggleSkill(skill.id)">
                  <input type="checkbox" :checked="hasSkill(skill.id)" :disabled="toggling === skill.id"
                    class="w-4 h-4 text-fuchsia-600 rounded border-slate-300 focus:ring-fuchsia-500 cursor-pointer shrink-0"
                    @click.stop @change="toggleSkill(skill.id)" />
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-white">{{ skill.name }}</p>
                    <p class="text-xs text-fuchsia-400 font-mono mt-0.5">{{ skill.slug }}</p>
                    <p v-if="skill.description" class="text-xs text-slate-400 mt-0.5 truncate">{{ skill.description }}
                    </p>
                  </div>
                  <svg v-if="toggling === skill.id" class="animate-spin h-4 w-4 text-fuchsia-400 shrink-0" fill="none"
                    viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                </div>
              </div>

              <!-- Permissions tab -->
              <div v-else class="space-y-4">
                <div v-if="!allPermissions.length" class="text-center text-slate-400 py-10 text-sm">
                  No permissions found in the system.
                </div>
                <template v-for="(perms, resource) in permissionsByResource" :key="resource">
                  <div>
                    <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{{ resource }}</p>
                    <div class="space-y-1">
                      <div v-for="perm in perms" :key="perm.id"
                        class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-700 transition-colors cursor-pointer border"
                        :class="hasPermission(perm.id) ? 'border-slate-600 bg-slate-800' : 'border-transparent'"
                        @click="togglePermission(perm.id)">
                        <input type="checkbox" :checked="hasPermission(perm.id)" :disabled="toggling === perm.id"
                          class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer shrink-0"
                          @click.stop @change="togglePermission(perm.id)" />
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2">
                            <span class="text-xs font-mono font-medium text-white">{{ perm.action }}</span>
                          </div>
                          <p v-if="perm.description" class="text-xs text-slate-400 mt-0.5">{{ perm.description }}</p>
                        </div>
                        <svg v-if="toggling === perm.id" class="animate-spin h-4 w-4 text-indigo-400 shrink-0"
                          fill="none" viewBox="0 0 24 24">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </template>
              </div>
            </div>

            <!-- Footer -->
            <div class="px-6 py-4 border-t border-slate-700 shrink-0">
              <button
                class="w-full px-4 py-2.5 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700 transition-colors"
                @click="closeAssocModal">
                Done
              </button>
            </div>
          </div>

          <!-- Right: tool selection panel -->
          <div v-if="toolPanelMcp" class="w-80 border-l border-slate-200 flex flex-col min-h-0 shrink-0">
            <!-- Panel header -->
            <div class="px-4 py-4 border-b border-slate-200 shrink-0">
              <div class="flex items-center justify-between mb-0.5">
                <p class="text-sm font-semibold text-white">Select Tools</p>
                <button class="p-1 text-slate-400 hover:text-slate-600 rounded" @click="toolPanelMcp = null">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p class="text-xs text-slate-500 truncate">{{ toolPanelMcp.displayName || toolPanelMcp.name }}</p>
              <p class="text-xs text-slate-400 mt-1">
                Empty selection = all tools exposed
              </p>
            </div>

            <!-- Tools list -->
            <div class="flex-1 overflow-y-auto py-2">
              <div v-if="toolsLoading" class="flex justify-center py-8">
                <svg class="animate-spin h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              </div>
              <div v-else-if="!availableTools.length" class="px-4 py-6 text-center text-slate-400 text-xs">
                No tools discovered.<br />Check server connectivity.
              </div>
              <div v-else class="space-y-0.5 px-2">
                <label v-for="tool in availableTools" :key="tool.toolName"
                  class="flex items-start gap-2.5 px-2 py-2 rounded-md hover:bg-slate-700 cursor-pointer">
                  <input type="checkbox" :checked="selectedTools.has(tool.toolName)"
                    class="w-3.5 h-3.5 mt-0.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer shrink-0"
                    @change="toggleToolSelection(tool.toolName)" />
                  <div class="min-w-0">
                    <p class="text-xs font-mono font-medium text-white truncate">{{ tool.toolName }}</p>
                    <p v-if="tool.description" class="text-xs text-slate-400 mt-0.5 line-clamp-2">{{ tool.description }}
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <!-- Panel footer -->
            <div class="px-4 py-3 border-t border-slate-200 shrink-0 space-y-2">
              <div class="flex gap-2">
                <button
                  class="flex-1 text-xs px-2 py-1.5 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                  @click="selectAllTools">All</button>
                <button
                  class="flex-1 text-xs px-2 py-1.5 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                  @click="clearAllTools">None</button>
              </div>
              <button :disabled="toolsSaving"
                class="w-full px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-semibold transition-colors"
                @click="saveToolSelection">
                {{ toolsSaving ? 'Saving...' : `Save (${selectedTools.size} selected)` }}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>

    <!-- Delete Confirm -->
    <ConfirmDialog v-if="deleteTarget" title="Delete Role"
      :message="`Are you sure you want to delete the role &quot;${deleteTarget.name}&quot;? This action cannot be undone.`"
      :loading="deleting" @confirm="doDelete" @cancel="deleteTarget = null" />
</template>
