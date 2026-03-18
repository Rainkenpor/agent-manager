<script setup lang="ts">
import type { Toast } from '@/store/useToast'

defineProps<{ toasts: Toast[] }>()
const emit = defineEmits<{ remove: [id: number] }>()
</script>

<template>
  <div class="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="pointer-events-auto flex items-center gap-3 rounded-lg px-4 py-3 shadow-xl text-sm font-medium max-w-sm"
        :class="{
          'bg-emerald-600 text-white': toast.type === 'success',
          'bg-red-600 text-white': toast.type === 'error',
          'bg-slate-700 text-white': toast.type === 'info',
        }"
      >
        <span v-if="toast.type === 'success'" class="text-base shrink-0">✓</span>
        <span v-else-if="toast.type === 'error'" class="text-base shrink-0">✕</span>
        <span v-else class="text-base shrink-0">ℹ</span>
        <span class="flex-1">{{ toast.message }}</span>
        <button
          class="shrink-0 opacity-70 hover:opacity-100 transition-opacity ml-1"
          @click="emit('remove', toast.id)"
        >
          ✕
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
</style>
