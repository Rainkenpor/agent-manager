<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAuthStore } from '@/store/useAuth'
import McpCredentialsView from './McpCredentialsView.vue'
import McpServersView from './McpServersView.vue'

const auth = useAuthStore()

const allTabs = [
	{ key: 'servers', label: 'MCP Servers', icon: 'mdi-server', resource: 'mcp_servers', component: McpServersView },
	{ key: 'credentials', label: 'My Credentials', icon: 'mdi-key', resource: 'mcp_credentials', component: McpCredentialsView }
]

const tabs = computed(() => allTabs.filter((t) => auth.hasResourceManageAccess(t.resource)))
const activeTab = ref(tabs.value[0]?.key ?? allTabs[0].key)
const activeComponent = computed(() => allTabs.find((t) => t.key === activeTab.value)?.component)
</script>

<template>
  <div class="flex flex-col h-full min-h-0">
    <div class="flex items-center gap-1 px-6 pt-1 border-b border-base-300 shrink-0">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors"
        :class="
          activeTab === tab.key
            ? 'border-indigo-500 text-base-content'
            : 'border-transparent text-base-content/60 hover:text-base-content hover:border-base-content/20'
        "
        @click="activeTab = tab.key"
      >
        <i class="mdi" :class="tab.icon" />
        {{ tab.label }}
      </button>
    </div>
    <div class="flex-1 min-h-0">
      <keep-alive>
        <component :is="activeComponent" />
      </keep-alive>
    </div>
  </div>
</template>
