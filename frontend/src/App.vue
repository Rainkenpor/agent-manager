<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from '@/store/useAuth'
import { useToastStore } from '@/store/useToast'
import ToastContainer from '@/components/ToastContainer.vue'

const auth = useAuthStore()
const toast = useToastStore()

onMounted(async () => {
  if (auth.token && !auth.user) {
    await auth.fetchCurrentUser()
  }
})
</script>

<template>
  <RouterView />
  <ToastContainer :toasts="toast.toasts" @remove="toast.remove" />
</template>
