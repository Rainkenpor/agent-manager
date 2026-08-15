/**
 * Graba un demo del cambio visible de la versión y deja los frames listos para encode.cjs.
 *
 * Requisitos: la app corriendo en local y las dependencias de grabación instaladas sin guardar:
 *   npm i --no-save playwright gifenc pngjs && npx playwright install chromium
 *
 * Uso:
 *   DEMO_USER_ID=<uuid> DEMO_PATH=/chat DEMO_MESSAGE="..." node scripts/whats-new/record.cjs
 */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { chromium } = require('playwright')
const jwt = require('jsonwebtoken')

const UI = process.env.DEMO_UI || 'http://localhost:5173'
const OUT_DIR = process.env.DEMO_FRAMES_DIR || path.join(os.tmpdir(), 'agent-manager-whats-new')
const FRAMES_DIR = path.join(OUT_DIR, 'frames')
const VIEWPORT = { width: 1180, height: 720 }

// Mismo valor por defecto que passport.service.ts cuando no hay JWT_SECRET en el entorno.
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

async function main() {
	if (!process.env.DEMO_USER_ID) throw new Error('Falta DEMO_USER_ID (id del usuario con el que se graba)')

	const token = jwt.sign({ sub: process.env.DEMO_USER_ID, username: process.env.DEMO_USERNAME || 'demo' }, JWT_SECRET, {
		expiresIn: '1h'
	})

	fs.rmSync(FRAMES_DIR, { recursive: true, force: true })
	fs.mkdirSync(FRAMES_DIR, { recursive: true })

	const browser = await chromium.launch({ headless: true })
	const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 })
	const page = await context.newPage()

	await page.addInitScript((t) => localStorage.setItem('token', t), token)
	page.on('console', (m) => {
		if (m.type() === 'error') console.log('  [browser error]', m.text().slice(0, 160))
	})

	await page.goto(`${UI}${process.env.DEMO_PATH || '/chat'}`, { waitUntil: 'domcontentloaded' })
	await page.waitForSelector('button:has-text("Nuevo Chat")', { timeout: 30000 })
	await page.waitForTimeout(1200)

	// ── Cursor virtual: sin esto el GIF no explica dónde ocurre cada interacción ──
	await page.evaluate(() => {
		const c = document.createElement('div')
		c.id = '__vcursor'
		c.style.cssText = `position:fixed;left:0;top:0;width:22px;height:22px;z-index:2147483647;pointer-events:none;
			transition:transform .06s linear;transform:translate(60px,60px)`
		c.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22">
			<path d="M5 2l14 8.5-6.2 1.3L9.6 19z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/>
		</svg>
		<span id="__vclick" style="position:absolute;left:-9px;top:-9px;width:40px;height:40px;border-radius:50%;
			border:2px solid #6366f1;opacity:0;transform:scale(.3)"></span>`
		document.body.appendChild(c)
	})

	const state = { x: 60, y: 60 }
	const frames = []

	const shot = async (delay = 80) => {
		const file = path.join(FRAMES_DIR, `f${String(frames.length).padStart(4, '0')}.png`)
		fs.writeFileSync(file, await page.screenshot({ type: 'png' }))
		frames.push({ file, delay })
	}

	const setCursor = (x, y) =>
		page.evaluate(([x, y]) => {
			const c = document.getElementById('__vcursor')
			if (c) c.style.transform = `translate(${x}px,${y}px)`
		}, [x, y])

	/** Mueve el cursor con easing, capturando un frame por paso. */
	const moveTo = async (x, y, steps = 8) => {
		const x0 = state.x
		const y0 = state.y
		for (let i = 1; i <= steps; i++) {
			const t = i / steps
			const e = 1 - (1 - t) ** 3
			const nx = Math.round(x0 + (x - x0) * e)
			const ny = Math.round(y0 + (y - y0) * e)
			await setCursor(nx, ny)
			await page.mouse.move(nx, ny)
			await shot(60)
		}
		state.x = x
		state.y = y
	}

	const clickPulse = async () => {
		await page.evaluate(() => {
			document
				.getElementById('__vclick')
				?.animate([{ opacity: 0.9, transform: 'scale(.3)' }, { opacity: 0, transform: 'scale(1.1)' }], { duration: 420 })
		})
		await shot(70)
		await shot(70)
	}

	const moveToEl = async (selector, steps = 8) => {
		const el = page.locator(selector).first()
		await el.waitFor({ state: 'visible', timeout: 15000 })
		const box = await el.boundingBox()
		await moveTo(Math.round(box.x + box.width / 2), Math.round(box.y + box.height / 2), steps)
		return el
	}

	const hold = async (ms, fps = 6) => {
		const n = Math.max(1, Math.round((ms / 1000) * fps))
		for (let i = 0; i < n; i++) await shot(Math.round(1000 / fps))
	}

	await hold(700)

	const newChat = await moveToEl('button:has-text("Nuevo Chat")', 10)
	await clickPulse()
	await newChat.click()
	await page.waitForTimeout(900)
	await hold(1100)

	const textarea = await moveToEl('textarea[placeholder^="Escribe un mensaje"]', 8)
	await clickPulse()
	await textarea.click()

	const MESSAGE = process.env.DEMO_MESSAGE || 'Consulta la documentacion del proyecto y resume su objetivo en 3 lineas'
	for (let i = 0; i < MESSAGE.length; i++) {
		await textarea.type(MESSAGE[i], { delay: 0 })
		if (i % 3 === 0) await shot(45)
	}
	await hold(500)

	const send = await moveToEl('button[title^="Enviar"]', 8)
	await clickPulse()
	await send.click()

	// Streaming: capturar mientras llega la respuesta
	const deadline = Date.now() + (Number(process.env.DEMO_TIMEOUT_MS) || 120000)
	let sawDelegation = false
	while (Date.now() < deadline) {
		await shot(90)
		if (!sawDelegation && (await page.locator('.mdi-robot-outline').count()) > 0) sawDelegation = true
		if ((await page.locator('button[title="Cancelar"]').count()) === 0) break
		await page.waitForTimeout(180)
	}
	await hold(1200)

	// Abrir el chat anidado del agente delegado
	if (sawDelegation) {
		const block = page.locator('.mdi-robot-outline').first()
		const box = await block.boundingBox()
		if (box) {
			await moveTo(Math.round(box.x + 60), Math.round(box.y + box.height / 2), 8)
			await clickPulse()
			await block.click()
			await page.waitForTimeout(500)
			await hold(2200)
		}
	}

	// Título autogenerado en la barra lateral
	await moveTo(150, 220, 8)
	await hold(1800)

	fs.writeFileSync(path.join(OUT_DIR, 'frames.json'), JSON.stringify({ frames, viewport: VIEWPORT, sawDelegation }, null, 1))
	console.log(`frames=${frames.length} sawDelegation=${sawDelegation}\ndir=${OUT_DIR}`)

	await browser.close()
}

main().catch((e) => {
	console.error('FALLO:', e.message)
	process.exit(1)
})
