<script setup lang="ts">
import SidebarNav from './SidebarNav.vue'
</script>

<template>
  <div class="flex h-screen overflow-auto p-2 gap-2 bg-slate-950">
    <SidebarNav />
    <main class="flex-1 overflow-auto">
      <slot />
    </main>
  </div>
</template>
