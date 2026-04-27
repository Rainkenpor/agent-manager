import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { env } from 'node:process'
import { BASE_URL } from './src/constants'

export default defineConfig((env) => {
	const envars = loadEnv(env.mode, '../')
	return {
		plugins: [tailwindcss(), vue()],
		resolve: {
			alias: {
				'@': fileURLToPath(new URL('./src', import.meta.url))
			}
		},
		base: BASE_URL,
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
