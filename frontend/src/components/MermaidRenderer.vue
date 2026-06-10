<script setup lang="ts">
import elkLayouts from '@mermaid-js/layout-elk'
import mermaid from 'mermaid'
import { nextTick, ref, watch } from 'vue'
import { useThemeStore } from '@/store/useTheme'

// Registra el motor de layout ELK para que todos los diagramas usen su algoritmo
// (distribución más limpia en grafos densos que el layout dagre por defecto).
mermaid.registerLayoutLoaders(elkLayouts)

const props = defineProps<{
	/** Contenedor donde se buscan los placeholders `.mermaid-block` a renderizar. */
	container: HTMLElement | null
}>()

const themeStore = useThemeStore()

function mermaidThemeFor(theme: string): 'dark' | 'default' {
	return theme === 'am-dark' ? 'dark' : 'default'
}

// htmlLabels: false fuerza etiquetas como <text> SVG (no <foreignObject>), evitando que el canvas
// quede "tainted" al exportar a PNG.
function initMermaid() {
	mermaid.initialize({
		startOnLoad: false,
		securityLevel: 'strict',
		htmlLabels: false,
		flowchart: { htmlLabels: false },
		layout: 'elk',
		theme: mermaidThemeFor(themeStore.theme)
	})
}

initMermaid()

let mermaidCounter = 0
// Cache por (tema + fuente): el SVG generado depende del tema activo.
const mermaidCache = new Map<string, string>()

// El contrato con el padre es el placeholder `<div class="mermaid-block" data-mermaid="...">`
// que `renderMarkdown` emite; aquí se busca y se reemplaza por el SVG tras el montaje.
async function renderDiagrams() {
	await nextTick()
	const container = props.container
	if (!container) return
	const themeId = themeStore.theme
	const blocks = container.querySelectorAll<HTMLElement>('.mermaid-block:not([data-rendered])')
	for (const node of Array.from(blocks)) {
		node.setAttribute('data-rendered', '1')
		const source = decodeURIComponent(node.getAttribute('data-mermaid') || '')
		if (!source.trim()) continue
		const cacheKey = `${themeId}::${source}`
		let svg = mermaidCache.get(cacheKey)
		if (!svg) {
			try {
				const rendered = await mermaid.render(`mermaid-svg-${mermaidCounter++}`, source)
				svg = rendered.svg
				mermaidCache.set(cacheKey, svg)
			} catch {
				node.innerHTML = `<pre class="text-xs text-error whitespace-pre-wrap p-2">${source.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`
				continue
			}
		}
		node.innerHTML = svg
		node.classList.add('cursor-zoom-in')
		node.title = 'Ampliar diagrama'
		node.onclick = () => openMermaidModal(svg as string)
	}
}

/** Re-renderiza todos los diagramas al cambiar el tema claro/oscuro. */
async function rerenderForTheme() {
	initMermaid()
	const container = props.container
	if (container) {
		for (const node of Array.from(container.querySelectorAll<HTMLElement>('.mermaid-block'))) {
			node.removeAttribute('data-rendered')
		}
	}
	await renderDiagrams()
}

watch(() => themeStore.theme, rerenderForTheme)

// ── Modal de diagrama (zoom + descarga) ───────────────────────────────────────
const mermaidModalSvg = ref<string | null>(null)
const mermaidZoom = ref(1)
const mermaidCanvas = ref<HTMLElement | null>(null)
let mermaidBaseWidth = 800
let mermaidBaseHeight = 600

/** Dimensiones intrínsecas del SVG (desde viewBox o atributos width/height). */
function svgBaseSize(svg: string): { width: number; height: number } {
	const holder = document.createElement('div')
	holder.innerHTML = svg
	const el = holder.querySelector('svg')
	let width = 800
	let height = 600
	const viewBox = el?.getAttribute('viewBox')
	if (viewBox) {
		const p = viewBox.split(/[\s,]+/).map(Number)
		if (p.length === 4 && p[2] > 0 && p[3] > 0) {
			width = p[2]
			height = p[3]
		}
	} else {
		const w = Number.parseFloat(el?.getAttribute('width') || '')
		const h = Number.parseFloat(el?.getAttribute('height') || '')
		if (Number.isFinite(w) && w > 0) width = w
		if (Number.isFinite(h) && h > 0) height = h
	}
	return { width, height }
}

/** Fija el tamaño en píxeles del SVG montado para que el layout refleje el zoom y el scroll alcance todo. */
function applyMermaidZoom() {
	const svg = mermaidCanvas.value?.querySelector('svg')
	if (!svg) return
	svg.style.maxWidth = 'none'
	svg.style.width = `${mermaidBaseWidth * mermaidZoom.value}px`
	svg.style.height = `${mermaidBaseHeight * mermaidZoom.value}px`
}

function openMermaidModal(svg: string) {
	const { width, height } = svgBaseSize(svg)
	mermaidBaseWidth = width
	mermaidBaseHeight = height
	mermaidZoom.value = 1
	mermaidModalSvg.value = svg
}

function closeMermaidModal() {
	mermaidModalSvg.value = null
}

function zoomMermaid(delta: number) {
	mermaidZoom.value = Math.min(5, Math.max(0.25, +(mermaidZoom.value + delta).toFixed(2)))
}

function resetMermaidZoom() {
	mermaidZoom.value = 1
}

/** Ctrl/⌘ + rueda = zoom; rueda sola = scroll nativo del lienzo. */
function onMermaidWheel(e: WheelEvent) {
	if (!e.ctrlKey && !e.metaKey) return
	e.preventDefault()
	zoomMermaid(e.deltaY < 0 ? 0.15 : -0.15)
}

watch([mermaidModalSvg, mermaidZoom], async () => {
	if (!mermaidModalSvg.value) return
	await nextTick()
	applyMermaidZoom()
})

function downloadMermaidPng() {
	const svg = mermaidModalSvg.value
	if (!svg) return
	const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
	const img = new Image()
	img.onload = () => {
		const scale = 2
		const width = img.width || 1200
		const height = img.height || 800
		const canvas = document.createElement('canvas')
		canvas.width = width * scale
		canvas.height = height * scale
		const ctx = canvas.getContext('2d')
		if (!ctx) {
			URL.revokeObjectURL(url)
			return
		}
		ctx.scale(scale, scale)
		ctx.drawImage(img, 0, 0, width, height)
		URL.revokeObjectURL(url)
		canvas.toBlob((png) => {
			if (!png) return
			const a = document.createElement('a')
			a.href = URL.createObjectURL(png)
			a.download = 'diagrama.png'
			a.click()
			URL.revokeObjectURL(a.href)
		}, 'image/png')
	}
	img.onerror = () => URL.revokeObjectURL(url)
	img.src = url
}

defineExpose({ renderDiagrams })
</script>

<template>
  <!-- Modal de diagrama Mermaid: zoom + descarga -->
  <div v-if="mermaidModalSvg" @click="closeMermaidModal" @wheel="onMermaidWheel"
    class="fixed inset-0 z-[100] flex overflow-auto bg-black/80 p-6">
    <!-- Lienzo del diagrama: el SVG recibe su tamaño en px (applyMermaidZoom), así el layout refleja el
         zoom y el scroll alcanza todo el diagrama. m-auto centra y permite desplazarse sin recortes. -->
    <div ref="mermaidCanvas" class="m-auto bg-base-100 rounded-lg p-4 shadow-2xl" @click.stop
      v-html="mermaidModalSvg" />

    <!-- Barra de herramientas fija respecto a la pantalla -->
    <div class="fixed top-4 right-4 flex items-center gap-2 bg-base-100 px-2 py-1 rounded-xl shadow-lg" @click.stop>
      <button type="button" @click="zoomMermaid(-0.2)" title="Alejar"
        class="w-9 h-9 flex items-center justify-center rounded-full bg-base-content/40 hover:bg-base-content/60 text-white text-lg leading-none">
        <span class="mdi mdi-minus"></span>
      </button>
      <span class="px-2 text-base-content/80 text-sm tabular-nums select-none">{{ Math.round(mermaidZoom * 100)
      }}%</span>
      <button type="button" @click="zoomMermaid(0.2)" title="Acercar"
        class="w-9 h-9 flex items-center justify-center rounded-full bg-base-content/40 hover:bg-base-content/60 text-white text-lg leading-none">
        <span class="mdi mdi-plus"></span>
      </button>
      <button type="button" @click="resetMermaidZoom" title="Restablecer zoom"
        class="w-9 h-9 flex items-center justify-center rounded-full bg-base-content/40 hover:bg-base-content/60 text-white text-lg leading-none">
        <span class="mdi mdi-magnify-scan"></span>
      </button>
      <button type="button" @click="downloadMermaidPng" title="Descargar PNG"
        class="w-9 h-9 flex items-center justify-center rounded-full bg-base-content/40 hover:bg-base-content/60 text-white text-lg leading-none">
        <span class="mdi mdi-download"></span>
      </button>
      <button type="button" @click="closeMermaidModal" title="Cerrar"
        class="w-9 h-9 flex items-center justify-center rounded-full bg-base-content/40 hover:bg-base-content/60 text-white text-xl leading-none">
        ✕
      </button>
    </div>
  </div>
</template>
