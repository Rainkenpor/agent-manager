<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '@/store/useAuth'
import HookServersView from './HookServersView.vue'
import EventListenerView from './EventListenerView.vue'

const auth = useAuthStore()

const allTabs = [
  { key: 'hooks', label: 'Hook Servers', icon: 'mdi-webhook', resource: 'hook_servers', component: HookServersView },
  { key: 'listeners', label: 'Event Listeners', icon: 'mdi-broadcast', resource: 'event_listeners', component: EventListenerView },
]

const tabs = computed(() => allTabs.filter((t) => auth.hasResourceAccess(t.resource)))
const activeTab = ref(tabs.value[0]?.key ?? allTabs[0].key)
const activeComponent = computed(() => allTabs.find((t) => t.key === activeTab.value)?.component)
</script>

<template>
  <div class="flex flex-col h-full min-h-0">
    <div class="flex items-center gap-1 px-6 pt-1 border-b border-slate-800 shrink-0">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors"
        :class="
          activeTab === tab.key
            ? 'border-indigo-500 text-white'
            : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
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
