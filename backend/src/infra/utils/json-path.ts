/**
 * Rutas dentro de un valor JSON, en notación punto/corchete: `componentes[2].nombre`,
 * `0.criteriosAceptacion`, `metadatos.owner`. Un segmento numérico indexa arreglos.
 */

export type PathSegment = string | number

export function parsePath(path: string | undefined): PathSegment[] {
	if (!path) return []
	const segments: PathSegment[] = []
	for (const raw of path.replace(/\[(\d+)\]/g, '.$1').split('.')) {
		if (raw === '') continue
		segments.push(/^\d+$/.test(raw) ? Number(raw) : raw)
	}
	return segments
}

function isContainer(value: unknown): value is Record<string, unknown> | unknown[] {
	return typeof value === 'object' && value !== null
}

function get(container: Record<string, unknown> | unknown[], segment: PathSegment): unknown {
	return Array.isArray(container) ? container[Number(segment)] : container[String(segment)]
}

function has(container: Record<string, unknown> | unknown[], segment: PathSegment): boolean {
	return Array.isArray(container) ? Number(segment) < container.length : String(segment) in container
}

/** Resuelve el contenedor padre del último segmento. */
function resolveParent(root: unknown, segments: PathSegment[]): { parent: Record<string, unknown> | unknown[]; last: PathSegment } | null {
	if (segments.length === 0) return null
	let current = root
	for (const segment of segments.slice(0, -1)) {
		if (!isContainer(current) || !has(current, segment)) return null
		current = get(current, segment)
	}
	if (!isContainer(current)) return null
	return { parent: current, last: segments[segments.length - 1] }
}

export function readAt(root: unknown, segments: PathSegment[]): { found: boolean; value: unknown } {
	let current = root
	for (const segment of segments) {
		if (!isContainer(current) || !has(current, segment)) return { found: false, value: undefined }
		current = get(current, segment)
	}
	return { found: true, value: current }
}

export function existsAt(root: unknown, segments: PathSegment[]): boolean {
	return readAt(root, segments).found
}

/** Escribe en la ruta indicada. El contenedor padre debe existir. */
export function writeAt(root: unknown, segments: PathSegment[], value: unknown): boolean {
	const resolved = resolveParent(root, segments)
	if (!resolved) return false
	const { parent, last } = resolved
	if (Array.isArray(parent)) {
		const index = Number(last)
		if (!Number.isInteger(index) || index < 0 || index > parent.length) return false
		parent[index] = value
		return true
	}
	parent[String(last)] = value
	return true
}

/** Elimina la ruta indicada. En arreglos hace splice, por lo que los índices posteriores se recorren. */
export function deleteAt(root: unknown, segments: PathSegment[]): boolean {
	const resolved = resolveParent(root, segments)
	if (!resolved) return false
	const { parent, last } = resolved
	if (!has(parent, last)) return false
	if (Array.isArray(parent)) {
		parent.splice(Number(last), 1)
		return true
	}
	delete parent[String(last)]
	return true
}

export function formatPath(segments: PathSegment[]): string {
	return segments.map((segment) => (typeof segment === 'number' ? `[${segment}]` : segment)).join('.')
}
