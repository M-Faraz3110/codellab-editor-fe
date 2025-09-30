// Minimal diff util that returns an array of tuples like ['=', text] | ['+', text] | ['-', text]
// Uses a simple dynamic programming LCS approach. Good enough for small documents in a personal project.

export type DiffOp = ['=' | '+' | '-', string]

export function simpleDiff(a: string, b: string): DiffOp[] {
  // compute LCS table for characters (can be optimized to words)
  const n = a.length
  const m = b.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; --i) {
    for (let j = m - 1; j >= 0; --j) {
      if (a[i] === b[j]) dp[i][j] = dp[i + 1][j + 1] + 1
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const ops: DiffOp[] = []
  let i = 0, j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      let start = i
      while (i < n && j < m && a[i] === b[j]) { i++; j++ }
      ops.push(['=', a.slice(start, i)])
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      // delete a[i]
      let start = i
      i++
      while (i < n && dp[i + 1][j] >= dp[i][j + 1]) i++
      ops.push(['-', a.slice(start, i)])
    } else {
      // insert b[j]
      let start = j
      j++
      while (j < m && dp[i][j + 1] > dp[i + 1][j]) j++
      ops.push(['+', b.slice(start, j)])
    }
  }
  if (i < n) ops.push(['-', a.slice(i)])
  if (j < m) ops.push(['+', b.slice(j)])
  return ops
}
