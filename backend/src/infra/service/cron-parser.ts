/**
 * Minimal cron expression parser — no external dependencies.
 * Supports standard 5-field cron: minute hour dom month dow
 *
 * Field ranges: minute 0-59, hour 0-23, dom 1-31, month 1-12, dow 0-6 (0=Sun)
 * Supports: * (all), N (exact), N-M (range), N/S (step from N), *\/S (step from min), a,b,c (list)
 */

type MatchFn = (n: number) => boolean

function parseCronField(field: string, min: number, max: number): MatchFn {
	if (field === '*') return () => true

	const matchers: MatchFn[] = []
	for (const part of field.split(',')) {
		if (part.includes('/')) {
			const [rangePart, stepStr] = part.split('/')
			const step = parseInt(stepStr, 10)
			if (rangePart === '*') {
				matchers.push((n) => (n - min) % step === 0)
			} else if (rangePart.includes('-')) {
				const [a, b] = rangePart.split('-').map(Number)
				matchers.push((n) => n >= a && n <= b && (n - a) % step === 0)
			} else {
				const start = parseInt(rangePart, 10)
				matchers.push((n) => n >= start && n <= max && (n - start) % step === 0)
			}
		} else if (part.includes('-')) {
			const [a, b] = part.split('-').map(Number)
			matchers.push((n) => n >= a && n <= b)
		} else {
			const v = parseInt(part, 10)
			matchers.push((n) => n === v)
		}
	}
	return (n) => matchers.some((f) => f(n))
}

/**
 * Calculate the next Date at which the given cron expression fires,
 * starting from `from` (exclusive — always returns a time strictly after `from`).
 *
 * Throws if no match is found within 1 year.
 */
export function getNextCronRun(cronExpr: string, from: Date = new Date()): Date {
	const fields = cronExpr.trim().split(/\s+/)
	if (fields.length !== 5) {
		throw new Error(`Invalid cron expression (expected 5 fields): "${cronExpr}"`)
	}

	const [minuteExpr, hourExpr, domExpr, monthExpr, dowExpr] = fields

	const matchMinute = parseCronField(minuteExpr, 0, 59)
	const matchHour = parseCronField(hourExpr, 0, 23)
	const matchDom = parseCronField(domExpr, 1, 31)
	const matchMonth = parseCronField(monthExpr, 1, 12)
	const matchDow = parseCronField(dowExpr, 0, 6)

	// Start searching from the next full minute after `from`
	const next = new Date(from)
	next.setSeconds(0, 0)
	next.setMinutes(next.getMinutes() + 1)

	const limit = new Date(from)
	limit.setFullYear(limit.getFullYear() + 1)

	while (next <= limit) {
		const month = next.getMonth() + 1 // 1-12
		const dom = next.getDate() // 1-31
		const dow = next.getDay() // 0-6
		const hour = next.getHours()
		const minute = next.getMinutes()

		if (!matchMonth(month)) {
			// Advance to the 1st of next month at 00:00
			next.setMonth(next.getMonth() + 1, 1)
			next.setHours(0, 0, 0, 0)
			continue
		}
		if (!matchDom(dom) || !matchDow(dow)) {
			// Advance to next day at 00:00
			next.setDate(next.getDate() + 1)
			next.setHours(0, 0, 0, 0)
			continue
		}
		if (!matchHour(hour)) {
			// Advance to next hour at :00
			next.setHours(next.getHours() + 1, 0, 0, 0)
			continue
		}
		if (!matchMinute(minute)) {
			next.setMinutes(next.getMinutes() + 1, 0, 0)
			continue
		}
		return new Date(next)
	}

	throw new Error(`No cron run found within 1 year for expression: "${cronExpr}"`)
}
