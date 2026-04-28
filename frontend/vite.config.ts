import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig((env) => {
	const envars = loadEnv(env.mode, '../')

	const base = envars.VITE_BASE_URL || '/agent-manager/'
	const baseUrl = base + (base.endsWith('/') ? '' : '/')

	return {
		plugins: [tailwindcss(), vue()],
		resolve: {
			alias: {
				'@': fileURLToPath(new URL('./src', import.meta.url))
			}
		},
		base: envars.VITE_BASE_URL,
		define: {
			__BASE_URL__: JSON.stringify(baseUrl),
			__API_BASE__: JSON.stringify(`${baseUrl}api`),
			__AZURE_LOGIN_URL__: JSON.stringify(`${baseUrl}api/auth/azure`)
		},
		server: {
			proxy: {
				'/api': {
					target: envars.VITE_SERVER_URL,
					changeOrigin: true
				}
			}
		}
	}
})
