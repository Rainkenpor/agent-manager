import { defineStore } from 'pinia'
import { ref } from 'vue'

export type Theme = 'am-light' | 'am-dark'

const STORAGE_KEY = 'theme'

function systemPrefersDark(): boolean {
	return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function storedTheme(): Theme | null {
	const value = localStorage.getItem(STORAGE_KEY)
	return value === 'am-light' || value === 'am-dark' ? value : null
}

/** Tema inicial: preferencia guardada o, en su defecto, el del sistema. */
export function resolveInitialTheme(): Theme {
	return storedTheme() ?? (systemPrefersDark() ? 'am-dark' : 'am-light')
}

function apply(theme: Theme) {
	document.documentElement.setAttribute('data-theme', theme)
}

export const useThemeStore = defineStore('theme', () => {
	const theme = ref<Theme>(resolveInitialTheme())

	function setTheme(next: Theme, persist = true) {
		theme.value = next
		apply(next)
		if (persist) localStorage.setItem(STORAGE_KEY, next)
	}

	function toggle() {
		setTheme(theme.value === 'am-dark' ? 'am-light' : 'am-dark')
	}

	function init() {
		apply(theme.value)
		window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
			if (storedTheme() === null) setTheme(e.matches ? 'am-dark' : 'am-light', false)
		})
	}

	return { theme, setTheme, toggle, init }
})
