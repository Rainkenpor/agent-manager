<script setup lang="ts">
defineProps<{
  title?: string
  description?: string
  /** Clase extra para el contenedor del body (ej. 'max-w-4xl mx-auto') */
  bodyClass?: string
}>()
</script>

<template>
  <div class="flex flex-col h-full min-h-0">

    <!-- Header -->
    <div class="flex items-center justify-between px-8 py-5 border-b border-slate-800 shrink-0">
      <slot name="header">
        <div>
          <h1 v-if="title" class="text-2xl font-bold text-white">{{ title }}</h1>
          <p v-if="description" class="text-slate-500 text-sm mt-0.5">{{ description }}</p>
        </div>
      </slot>

      <div v-if="$slots.actions" class="flex items-center gap-3 shrink-0 ml-6">
        <slot name="actions" />
      </div>
    </div>

    <!-- Body -->
    <div class="flex-1 overflow-auto p-4" :class="bodyClass">
      <slot />
    </div>

  </div>
</template>
