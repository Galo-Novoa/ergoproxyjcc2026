import type { EdgeRef } from '@/lib/folder/logic'

export const COLUMN_WIDTH = 260
export const ROW_HEIGHT = 92

/**
 * Capas de izquierda a derecha según las relaciones "contiene": la capa de un apunte es la ruta más larga
 * desde una raíz. Dentro de cada capa se ordena por la posición media de sus padres para reducir cruces.
 */
export function layoutFolder(nodes: { id: string; title: string }[], edges: EdgeRef[]) {
  const ids = new Set(nodes.map((n) => n.id))
  const childEdges = edges.filter((e) => e.kind === 'child' && ids.has(e.fromId) && ids.has(e.toId))
  const parents = new Map<string, string[]>()
  const kids = new Map<string, string[]>()
  for (const e of childEdges) {
    parents.set(e.toId, [...(parents.get(e.toId) ?? []), e.fromId])
    kids.set(e.fromId, [...(kids.get(e.fromId) ?? []), e.toId])
  }

  const layer = new Map<string, number>()
  const pending = new Map(nodes.map((n) => [n.id, parents.get(n.id)?.length ?? 0]))
  const queue = nodes.filter((n) => pending.get(n.id) === 0).map((n) => n.id)
  for (const id of queue) layer.set(id, 0)
  while (queue.length) {
    const id = queue.shift() as string
    for (const child of kids.get(id) ?? []) {
      layer.set(child, Math.max(layer.get(child) ?? 0, (layer.get(id) ?? 0) + 1))
      pending.set(child, (pending.get(child) ?? 1) - 1)
      if (pending.get(child) === 0) queue.push(child)
    }
  }
  // Si hubiera un ciclo (datos corruptos), esos nodos caen en la primera capa en lugar de perderse.
  for (const n of nodes) if (!layer.has(n.id)) layer.set(n.id, 0)

  const byLayer = new Map<number, { id: string; title: string }[]>()
  for (const n of nodes) byLayer.set(layer.get(n.id) as number, [...(byLayer.get(layer.get(n.id) as number) ?? []), n])

  const positions = new Map<string, { x: number; y: number }>()
  const rowOf = new Map<string, number>()
  for (const depth of [...byLayer.keys()].sort((a, b) => a - b)) {
    const list = byLayer.get(depth) as { id: string; title: string }[]
    const score = (id: string) => {
      const rows = (parents.get(id) ?? []).map((p) => rowOf.get(p)).filter((r): r is number => r !== undefined)
      return rows.length ? rows.reduce((s, r) => s + r, 0) / rows.length : Number.POSITIVE_INFINITY
    }
    list.sort((a, b) => score(a.id) - score(b.id) || a.title.localeCompare(b.title, 'es'))
    list.forEach((n, i) => {
      rowOf.set(n.id, i)
      positions.set(n.id, { x: depth * COLUMN_WIDTH, y: i * ROW_HEIGHT })
    })
  }
  return positions
}
