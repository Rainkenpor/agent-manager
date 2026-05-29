import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './assets/base.css'
import '@mdi/font/css/materialdesignicons.min.css'
import { resolveInitialTheme, useThemeStore } from './store/useTheme'

// Aplicar el tema antes del mount para evitar parpadeo.
document.documentElement.setAttribute('data-theme', resolveInitialTheme())

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

useThemeStore().init()

app.mount('#app')
