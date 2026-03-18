<script setup lang="ts">
import SidebarNav from './SidebarNav.vue'
</script>

<template>
  <div class="flex min-h-screen bg-slate-50">
    <SidebarNav />
    <main class="flex-1 overflow-auto">
      <slot />
    </main>
  </div>
</template>
