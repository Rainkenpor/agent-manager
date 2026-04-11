<script setup lang="ts">
import { RouterView } from 'vue-router'
import SidebarNav from './SidebarNav.vue'
import AgentLogsPanel from './AgentLogsPanel.vue'
</script>

<template>
  <div class="flex flex-col h-screen p-2 gap-2 bg-slate-950">
    <div class="flex flex-1 gap-2 overflow-hidden min-h-0">
      <SidebarNav />
      <main class="flex-1 overflow-auto flex flex-col gap-4  bg-slate-900 rounded-xl border border-slate-800">
        <div class="flex-1 overflow-auto">
          <RouterView />
        </div>
        <AgentLogsPanel />
      </main>
    </div>
  </div>
</template>
