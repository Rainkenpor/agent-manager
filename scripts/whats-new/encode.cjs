/**
 * Convierte los frames capturados por record.cjs en un GIF liviano (sin ffmpeg).
 *
 * Uso:
 *   VERSION=2.2.0 node scripts/whats-new/encode.cjs
 */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { PNG } = require('pngjs')
const { GIFEncoder, quantize, applyPalette } = require('gifenc')

const ROOT = path.resolve(__dirname, '..', '..')
const DIR = process.env.DEMO_FRAMES_DIR || path.join(os.tmpdir(), 'agent-manager-whats-new')
const VERSION = process.env.VERSION
const OUT = process.env.OUT || (VERSION ? path.join(ROOT, 'frontend', 'public', 'whats-new', `${VERSION}.gif`) : null)
const TARGET_W = Number(process.env.TARGET_W) || 860
const MAX_FRAMES = Number(process.env.MAX_FRAMES) || 130
const MAX_DELAY = Number(process.env.MAX_DELAY) || 240

if (!OUT) throw new Error('Falta VERSION (destino frontend/public/whats-new/<VERSION>.gif) o OUT con la ruta explícita')
fs.mkdirSync(path.dirname(OUT), { recursive: true })

const meta = JSON.parse(fs.readFileSync(path.join(DIR, 'frames.json'), 'utf8'))

/**
 * Reducción por área con escala fraccionaria: cada píxel destino promedia su región exacta
 * en el origen, lo que conserva el texto mucho mejor que un factor entero o el vecino más cercano.
 */
function downscale(png, targetW) {
	if (targetW >= png.width) {
		const copy = new Uint8ClampedArray(png.data.length)
		copy.set(png.data)
		return { data: copy, width: png.width, height: png.height }
	}
	const scale = png.width / targetW
	const w = targetW
	const h = Math.round(png.height / scale)
	const out = new Uint8ClampedArray(w * h * 4)

	for (let y = 0; y < h; y++) {
		const sy0 = y * scale
		const sy1 = Math.min(png.height, (y + 1) * scale)
		const y0 = Math.floor(sy0)
		const y1 = Math.max(y0 + 1, Math.ceil(sy1))
		for (let x = 0; x < w; x++) {
			const sx0 = x * scale
			const sx1 = Math.min(png.width, (x + 1) * scale)
			const x0 = Math.floor(sx0)
			const x1 = Math.max(x0 + 1, Math.ceil(sx1))

			let r = 0
			let g = 0
			let b = 0
			let wsum = 0
			for (let sy = y0; sy < y1; sy++) {
				const cy = Math.min(sy + 1, sy1) - Math.max(sy, sy0)
				if (cy <= 0) continue
				for (let sx = x0; sx < x1; sx++) {
					const cx = Math.min(sx + 1, sx1) - Math.max(sx, sx0)
					if (cx <= 0) continue
					const a = cx * cy
					const i = (sy * png.width + sx) * 4
					r += png.data[i] * a
					g += png.data[i + 1] * a
					b += png.data[i + 2] * a
					wsum += a
				}
			}
			const o = (y * w + x) * 4
			out[o] = r / wsum
			out[o + 1] = g / wsum
			out[o + 2] = b / wsum
			out[o + 3] = 255
		}
	}
	return { data: out, width: w, height: h }
}

function signature(data) {
	let s = 0
	for (let i = 0; i < data.length; i += 401) s = (s * 31 + data[i]) >>> 0
	return s
}

const kept = []
let prevSig = null

for (const f of meta.frames) {
	const png = PNG.sync.read(fs.readFileSync(f.file))
	const small = downscale(png, TARGET_W)
	const sig = signature(small.data)
	// Los "holds" generan frames idénticos: se colapsan sumando su duración.
	if (sig === prevSig && kept.length) {
		kept[kept.length - 1].delay += f.delay
		continue
	}
	prevSig = sig
	kept.push({ ...small, delay: f.delay })
}

// Si aún hay demasiados, se descarta uno de cada dos acumulando su tiempo.
let frames = kept
while (frames.length > MAX_FRAMES) {
	const next = []
	for (let i = 0; i < frames.length; i++) {
		if (i % 2 === 0) next.push({ ...frames[i], delay: frames[i].delay + (frames[i + 1]?.delay ?? 0) })
	}
	frames = next
}

// Paleta global: pesa mucho menos que una por frame y la UI tiene pocos colores.
const sample = []
const step = Math.max(1, Math.floor(frames.length / 12))
for (let i = 0; i < frames.length; i += step) sample.push(frames[i].data)
const merged = new Uint8ClampedArray(sample.reduce((n, d) => n + d.length, 0))
let off = 0
for (const d of sample) {
	merged.set(d, off)
	off += d.length
}
const palette = quantize(merged, 256, { format: 'rgb565' })

const gif = GIFEncoder()
for (const f of frames) {
	const index = applyPalette(f.data, palette, 'rgb565')
	// Techo por frame: las pausas largas no deben alargar el clip más de lo necesario.
	gif.writeFrame(index, f.width, f.height, { palette, delay: Math.min(MAX_DELAY, Math.max(40, Math.round(f.delay))) })
}
gif.finish()

fs.writeFileSync(OUT, Buffer.from(gif.bytes()))
const totalMs = frames.reduce((n, f) => n + Math.min(MAX_DELAY, Math.max(40, f.delay)), 0)
console.log(
	`GIF: ${OUT}\n  frames=${frames.length} (de ${meta.frames.length})  ${frames[0].width}x${frames[0].height}` +
		`  duración=${(totalMs / 1000).toFixed(1)}s  peso=${(fs.statSync(OUT).size / 1024 / 1024).toFixed(2)} MB`
)
