export interface DiffLine {
	type: 'equal' | 'added' | 'removed'
	content: string
}

function buildLCS(a: string[], b: string[]): number[][] {
	const m = a.length
	const n = b.length
	const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1
			else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
		}
	}
	return dp
}

export function computeDiff(original: string, modified: string): DiffLine[] {
	const origLines = original.split('\n')
	const modLines = modified.split('\n')
	const dp = buildLCS(origLines, modLines)

	const result: DiffLine[] = []
	let i = origLines.length
	let j = modLines.length

	while (i > 0 || j > 0) {
		if (i > 0 && j > 0 && origLines[i - 1] === modLines[j - 1]) {
			result.unshift({ type: 'equal', content: origLines[i - 1] })
			i--
			j--
		} else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
			result.unshift({ type: 'added', content: modLines[j - 1] })
			j--
		} else {
			result.unshift({ type: 'removed', content: origLines[i - 1] })
			i--
		}
	}

	return result
}

export function hasChanges(diff: DiffLine[]): boolean {
	return diff.some((l) => l.type !== 'equal')
}
