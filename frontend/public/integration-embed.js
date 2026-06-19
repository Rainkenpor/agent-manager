;(() => {
	// Script de embebido del asistente de chat. El sitio externo lo incluye con:
	//   <script src="https://<agent-manager>/integration-embed.js?theme=am-dark" async></script>
	// Inyecta un iframe flotante (esquina inferior derecha) que carga /integration y le
	// envía, por postMessage, el sitio que lo usa y el tema. También lo redimensiona al abrir/cerrar.
	//
	// Tema:
	//   - Estático: ?theme=am-dark en la URL del script, o atributo data-theme.
	//   - Dinámico: window.IntegrationWidget.setTheme('am-light' | 'am-dark' | '<tema-daisyui>').

	const scriptEl =
		document.currentScript ||
		(() => {
			const all = document.getElementsByTagName('script')
			return all[all.length - 1]
		})()

	const base = scriptEl.src.replace(/\/integration-embed\.js.*$/, '')
	// Sitio que usa el widget: su propio origen (permite override explícito con data-origin).
	const host = scriptEl.getAttribute('data-origin') || window.location.origin

	// Tema inicial: data-theme o ?theme= en la URL del script.
	let theme = scriptEl.getAttribute('data-theme') || ''
	try {
		theme = theme || new URL(scriptEl.src).searchParams.get('theme') || ''
	} catch {
		/* src no parseable */
	}

	const CLOSED = { width: '96px', height: '96px' }
	const OPEN = { width: 'min(420px, 100vw)', height: 'min(640px, 100vh)' }

	let iframe = null

	// Envía el sitio anfitrión y el tema actual al widget dentro del iframe.
	const postToWidget = () => {
		if (!iframe || !iframe.contentWindow) return
		iframe.contentWindow.postMessage({ source: 'integration-host', host: host, theme: theme }, '*')
	}

	const build = () => {
		if (document.getElementById('integration-widget-frame')) return

		iframe = document.createElement('iframe')
		iframe.id = 'integration-widget-frame'
		iframe.src = `${base}/integration`
		iframe.title = 'Asistente de chat'
		iframe.setAttribute('allowtransparency', 'true')
		iframe.allow = 'clipboard-write'

		const s = iframe.style
		s.position = 'fixed'
		s.bottom = '0'
		s.right = '0'
		s.border = '0'
		s.background = 'transparent'
		s.colorScheme = 'normal'
		s.zIndex = '2147483000'
		s.width = CLOSED.width
		s.height = CLOSED.height
		s.maxWidth = '100vw'
		s.maxHeight = '100vh'
		s.transition = 'width 0.2s ease, height 0.2s ease'

		document.body.appendChild(iframe)

		iframe.addEventListener('load', postToWidget)

		window.addEventListener('message', (e) => {
			if (!e.data || e.data.source !== 'integration-widget') return
			// El widget pide el origen/tema al montarse.
			if (e.data.type === 'ready') {
				postToWidget()
				return
			}
			const size = e.data.open ? OPEN : CLOSED
			iframe.style.width = size.width
			iframe.style.height = size.height
		})
	}

	// API pública para controlar el widget en runtime.
	window.IntegrationWidget = window.IntegrationWidget || {}
	window.IntegrationWidget.setTheme = (next) => {
		theme = next || ''
		postToWidget()
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', build)
	} else {
		build()
	}
})()
