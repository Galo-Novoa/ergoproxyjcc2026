import { describe, expect, it } from 'vitest'
import { otherBranches, pathTo, type BranchNote, type TreeNode } from '@/lib/tree/compose'

const node = (id: string, parentId: string | null, extra: Partial<TreeNode> = {}): TreeNode => ({
  id,
  parentId,
  anchorSeq: parentId ? BigInt(10) : null,
  alias: id,
  topic: `tema ${id}`,
  contextSummary: null,
  summaryUpToSeq: null,
  inheritedSummary: null,
  ...extra,
})

const notes = (entries: Record<string, [number, string][]>) =>
  new Map<string, BranchNote[]>(
    Object.entries(entries).map(([id, list]) => [id, list.map(([seq, text]) => ({ seq: BigInt(seq), text }))]),
  )

//   raiz ─┬─ a ─── a1      (a y b se bifurcan de raiz en el mensaje 10)
//         └─ b ─── b1
const tree = [node('raiz', null), node('a', 'raiz'), node('a1', 'a'), node('b', 'raiz'), node('b1', 'b')]

describe('otherBranches', () => {
  it('describe las hermanas de cada tramo del camino, con las dudas de sus subramas', () => {
    const branchNotes = notes({ b: [[20, 'Regla de la cadena']], b1: [[30, 'Derivada implícita']] })
    expect(otherBranches(tree, pathTo(tree, 'a1'), branchNotes)).toEqual([
      { label: 'b', text: 'Regla de la cadena; Derivada implícita' },
    ])
  })

  it('no incluye ramas del propio camino', () => {
    const labels = otherBranches(tree, pathTo(tree, 'b1'), new Map()).map((b) => b.label)
    expect(labels).toEqual(['a'])
  })

  it('describe lo que siguió en un ancestro después del punto de bifurcación', () => {
    const branchNotes = notes({ raiz: [[4, 'Definición de derivada'], [14, 'Derivada de x^2']] })
    expect(otherBranches(tree, pathTo(tree, 'a1'), branchNotes)).toEqual([
      { label: 'raiz (continuación)', text: 'Derivada de x^2' },
      { label: 'b', text: 'tema b' },
    ])
  })

  it('incluye las ramas que salen de la actual', () => {
    const labels = otherBranches(tree, pathTo(tree, 'a'), new Map()).map((b) => b.label)
    expect(labels).toEqual(['b', 'a1'])
  })

  it('prefiere el resumen de la rama y, si no hay dudas registradas, usa su tema', () => {
    const withSummary = tree.map((n) => (n.id === 'a' ? { ...n, contextSummary: 'resumen de a' } : n))
    expect(otherBranches(withSummary, pathTo(withSummary, 'b1'), new Map())).toEqual([
      { label: 'a', text: 'resumen de a' },
    ])
    expect(otherBranches(tree, pathTo(tree, 'b1'), new Map())).toEqual([{ label: 'a', text: 'tema a' }])
  })

  it('sin bifurcaciones no hay otras ramas', () => {
    const line = [node('raiz', null), node('x', 'raiz')]
    expect(otherBranches(line, pathTo(line, 'x'), notes({ raiz: [[4, 'antes del ancla']] }))).toEqual([])
  })
})
