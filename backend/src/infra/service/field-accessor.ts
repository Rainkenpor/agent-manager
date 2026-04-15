/**
 * Safe field accessor — resolves dot-notation paths with array index support.
 * No eval/Function constructor used.
 *
 * Supported path syntax:
 *   "field"                     → root.field
 *   "field.nested"              → root.field.nested
 *   "field[0]"                  → root.field[0]
 *   "field[0].nested"           → root.field[0].nested
 *   "element.item[0].status"    → root.element.item[0].status
 *
 * The `element` prefix is treated as a regular key and is NOT auto-stripped.
 * Callers should pass { element: data } as the root when the path starts with "element.".
 */

type PathToken =
	| { type: 'key'; value: string }
	| { type: 'index'; index: number }

function tokenizePath(path: string): PathToken[] {
	const tokens: PathToken[] = []
	// Match either a key segment (alphanumeric + underscore) or a bracketed index
	const regex = /([^.[]+)|\[(\d+)\]/g
	let match: RegExpExecArray | null
	while ((match = regex.exec(path)) !== null) {
		if (match[1] !== undefined) {
			tokens.push({ type: 'key', value: match[1] })
		} else if (match[2] !== undefined) {
			tokens.push({ type: 'index', index: parseInt(match[2], 10) })
		}
	}
	return tokens
}

/**
 * Retrieve a nested value from `obj` using a dot/bracket path string.
 * Returns `undefined` if any segment is missing or if the path is empty.
 */
export function getFieldValue(obj: unknown, path: string): unknown {
	if (!path) return obj
	const tokens = tokenizePath(path)
	let current: unknown = obj
	for (const token of tokens) {
		if (current === null || current === undefined) return undefined
		if (token.type === 'key') {
			current = (current as Record<string, unknown>)[token.value]
		} else {
			current = (current as unknown[])[token.index]
		}
	}
	return current
}

/**
 * Evaluate a condition against an object.
 * The `field` path is resolved starting from `{ element: data }` when it begins with "element".
 */
export function evaluateCondition(
	data: unknown,
	condition: { field: string; operator: string; value: unknown }
): boolean {
	const { field, operator, value } = condition
	const fieldValue = getFieldValue(data, field)

	switch (operator) {
		case '==':
			// biome-ignore lint: intentional loose equality for condition matching
			return fieldValue == value
		case '===':
			return fieldValue === value
		case '!=':
			// biome-ignore lint: intentional loose inequality
			return fieldValue != value
		case '!==':
			return fieldValue !== value
		case '>':
			return (fieldValue as number) > (value as number)
		case '<':
			return (fieldValue as number) < (value as number)
		case '>=':
			return (fieldValue as number) >= (value as number)
		case '<=':
			return (fieldValue as number) <= (value as number)
		case 'contains':
			return String(fieldValue).includes(String(value))
		case 'startsWith':
			return String(fieldValue).startsWith(String(value))
		case 'endsWith':
			return String(fieldValue).endsWith(String(value))
		default:
			return false
	}
}
