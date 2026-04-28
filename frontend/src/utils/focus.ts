import type { Ref } from 'vue'

const handleClickOutside = (containerRef: Ref<HTMLElement>, show: Ref<boolean>, event: any) => {
	if (containerRef.value && !containerRef.value.contains(event.target)) {
		show.value = false
	}
}

export const focusOn = (containerRef: Ref<HTMLElement>, show: any) => {
	document.addEventListener('click', (event) => handleClickOutside(containerRef, show, event))
}

export const blurOn = (containerRef: Ref<HTMLElement>, show: Ref<boolean>) => {
	document.removeEventListener('click', (event) => handleClickOutside(containerRef, show, event))
}
