<script setup lang="ts">
defineProps<{
  title: string
  message: string
  confirmLabel?: string
  loading?: boolean
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="emit('cancel')" />
    <div class="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
      <h3 class="text-lg font-semibold text-slate-800 mb-2">{{ title }}</h3>
      <p class="text-sm text-slate-500 mb-6">{{ message }}</p>
      <div class="flex gap-3 justify-end">
        <button
          class="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
          @click="emit('cancel')"
        >
          Cancel
        </button>
        <button
          class="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
          :disabled="loading"
          @click="emit('confirm')"
        >
          <span v-if="loading">Deleting...</span>
          <span v-else>{{ confirmLabel ?? 'Delete' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
