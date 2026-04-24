<script setup lang="ts">
const props = withDefaults(defineProps<{
  title?: string
  description?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '5xl'
  persistent?: boolean
  scrollBody?: boolean
  fullHeight?: boolean
}>(), {
  size: 'lg',
  scrollBody: true,
  fullHeight: false,
  persistent: false,
})

const emit = defineEmits<{ close: [] }>()

const sizeMap: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '5xl': 'max-w-5xl',
}

function handleBackdropClick() {
  if (!props.persistent) emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="handleBackdropClick" />
      <div class="relative bg-base-200 rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden"
        :class="[sizeMap[size], fullHeight ? 'h-[92vh]' : 'max-h-[90vh]']">

        <!-- Header -->
        <div v-if="title || $slots.title"
          class="px-6 py-4 border-b border-slate-700/60 flex items-center justify-between shrink-0">
          <slot name="title">
            <div>
              <h2 class="text-base font-semibold text-white">{{ title }}</h2>
              {{ description }}
            </div>
          </slot>
          <button class="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            @click="emit('close')">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 min-h-0 px-6 py-5 space-y-4"
          :class="scrollBody ? 'overflow-y-auto' : 'overflow-hidden flex flex-col'">
          <slot />
        </div>

        <!-- Footer -->
        <div v-if="$slots.footer" class="px-6 py-4 border-t border-slate-700/60 shrink-0">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
