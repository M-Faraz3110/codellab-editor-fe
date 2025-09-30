declare module 'diff-match-patch' {
  class DiffMatchPatch {
    static DIFF_DELETE: number
    static DIFF_INSERT: number
    static DIFF_EQUAL: number
    diff_main(text1: string, text2: string): Array<[number, string]>
    diff_cleanupEfficiency(diffs: Array<[number, string]>): void
  }
  export default DiffMatchPatch
}
