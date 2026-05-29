import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'))

export default defineConfig((env) => {
	const envars = loadEnv(env.mode, '../')

	const base = envars.VITE_BASE_URL || '/'
	const baseUrl = base + (base.endsWith('/') ? '' : '/')

	return {
		plugins: [tailwindcss(), vue()],
		resolve: {
			alias: {
				'@': fileURLToPath(new URL('./src', import.meta.url))
			}
		},
		base,
		define: {
			__BASE_URL__: JSON.stringify(baseUrl),
			__API_BASE__: JSON.stringify(`${baseUrl}api`),
			__AZURE_LOGIN_URL__: JSON.stringify(`${baseUrl}api/auth/azure`),
			__APP_VERSION__: JSON.stringify(version)
		},
		build: {
			outDir: '../dist/frontend',
			emptyOutDir: true
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
