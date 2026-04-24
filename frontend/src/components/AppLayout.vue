<script setup lang="ts">
import { RouterView } from 'vue-router'
import SidebarNav from './SidebarNav.vue'
import AgentLogsPanel from './AgentLogsPanel.vue'
</script>

<template>
  <div class="flex flex-col h-screen p-4 gap-2 bg-base-300">
    <div class="flex flex-1 gap-4 overflow-hidden min-h-0">
      <SidebarNav />
      <main class="flex-1 overflow-auto flex flex-col gap-2  bg-base-200 rounded-xl shadow-2xl">
        <div class="flex-1 overflow-auto">
          <RouterView />
        </div>
        <AgentLogsPanel />
      </main>
    </div>
  </div>
</template>
