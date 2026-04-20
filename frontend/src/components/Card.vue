<template>
  <div class="card bg-base-100 flex flex-col">
    <div class="card-body">
      <div class="card-title flex items-start">
        <div class="flex-1 flex justify-between">
          <slot name="header"></slot>
          <template v-if="!$slots.header">
            <div>
              <h1 class="text-xl">{{ $props.header?.title }}</h1>
              <small class="text-sm">{{ $props.header?.description }}</small>
            </div>
          </template>
        </div>

        <div v-if="$slots.options" ref="containerRef" class="relative z-10" @click.prevent.stop="">
          <div class=" text-xl text-white cursor-pointer hover:bg-neutral-800 rounded-2xl px-2 -mt-1"
            @click.prevent.stop="showOption = !showOption">
            <span class="mdi mdi-dots-vertical"></span>
          </div>
          <div v-if="showOption" class="absolute bg-hola w-40 right-0 p-2  rounded-xl bg-base-300">
            <slot name="options"></slot>
          </div>
        </div>
      </div>

      <div class="flex-1">
        <slot></slot>
      </div>

      <div v-if="$slots.footer" class="card-actions">
        <slot name="footer"></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
const props = defineProps<{
  header?: {
    title?: string,
    description?: string
  }
}>()

const showOption = ref<boolean>(false)
const containerRef = ref(null);


const handleClickOutside = (event) => {
  if (containerRef.value && !containerRef.value.contains(event.target)) {
    showOption.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>