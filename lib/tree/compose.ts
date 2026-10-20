import {
  CONTEXT_BUDGET_CHARS,
  KEEP_RECENT_INHERITED,
} from '@/lib/tree/config'

/** Datos mínimos de un nodo para reconstruir su contexto. `anchorSeq` es el `seq` del mensaje donde se bifurcó. */
export type TreeNode = {
  id: string
  parentId: string | null
  anchorSeq: bigint | null
  alias: string
  topic: string
  contextSummary: string | null
  summaryUpToSeq: bigint | null
  inheritedSummary: string | null
}

export type BranchMessageBase = { id: string; nodeId: string | null; seq: bigint }
export type ChatMessageLike = BranchMessageBase & { role: string; content: string }

export type LabeledText = { label: string; text: string }

/** Camino raíz → nodo. Devuelve [] si el nodo no existe o el árbol tiene un ciclo. */
export function pathTo(nodes: TreeNode[], nodeId: string): TreeNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const path: TreeNode[] = []
  const seen = new Set<string>()
  let current = byId.get(nodeId)
  while (current) {
    if (seen.has(current.id)) return []
    seen.add(current.id)
    path.unshift(current)
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return path[0]?.parentId === null ? path : []
}

/**
 * Mensajes que ve una rama: los de cada ancestro hasta el mensaje donde se bifurcó el siguiente
 * (inclusive) y todos los propios. Los mensajes de ramas hermanas nunca están en `path`, así que
 * no pueden aparecer. Si falta el punto de bifurcación, el tramo del ancestro se excluye por seguridad.
 */
export function visibleMessages<T extends BranchMessageBase>(
  path: TreeNode[],
  messages: T[],
): { message: T; inherited: boolean; nodeIndex: number }[] {
  const last = path.length - 1
  const result: { message: T; inherited: boolean; nodeIndex: number }[] = []
  path.forEach((node, index) => {
    const limit = index < last ? path[index + 1].anchorSeq : null
    if (index < last && limit === null) return
    for (const message of messages) {
      if (message.nodeId !== node.id) continue
      if (limit !== null && message.seq > limit) continue
      result.push({ message, inherited: index < last, nodeIndex: index })
    }
  })
  return result.sort((a, b) => (a.message.seq < b.message.seq ? -1 : a.message.seq > b.message.seq ? 1 : 0))
}

const size = (messages: { content: string }[]) => messages.reduce((n, m) => n + m.content.length, 0)

/**
 * Contexto heredado del tramo compartido, sin usar `inheritedSummary`. El resumen de un ancestro solo
 * sirve si no cubre mensajes posteriores a la bifurcación; en ese caso se usan los mensajes completos.
 */
export function composeInherited(
  path: TreeNode[],
  visible: { message: ChatMessageLike; inherited: boolean; nodeIndex: number }[],
) {
  const summaries: LabeledText[] = []
  const covered = new Map<number, bigint>()
  path.forEach((node, index) => {
    if (index === path.length - 1) return
    const limit = path[index + 1].anchorSeq
    if (
      node.contextSummary &&
      node.summaryUpToSeq !== null &&
      limit !== null &&
      node.summaryUpToSeq <= limit
    ) {
      summaries.push({ label: `Resumen de la rama «${node.alias}»`, text: node.contextSummary })
      covered.set(index, node.summaryUpToSeq)
    }
  })
  const messages = visible
    .filter((v) => v.inherited)
    .filter((v) => {
      const upTo = covered.get(v.nodeIndex)
      return upTo === undefined || v.message.seq > upTo
    })
    .map((v) => v.message)
  return { summaries, messages }
}

export type BranchContext = {
  summaries: LabeledText[]
  messages: ChatMessageLike[]
  truncated: boolean
}

/** Resúmenes + mensajes que se le dan al modelo para continuar la rama `path[path.length - 1]`. */
export function composeContext(
  path: TreeNode[],
  visible: { message: ChatMessageLike; inherited: boolean; nodeIndex: number }[],
  budget = CONTEXT_BUDGET_CHARS,
): BranchContext {
  const target = path[path.length - 1]
  const summaries: LabeledText[] = []
  let messages: ChatMessageLike[] = []

  if (path.length > 1) {
    if (target.inheritedSummary) {
      summaries.push({
        label: 'Contexto compartido hasta la bifurcación',
        text: target.inheritedSummary,
      })
      messages.push(
        ...visible
          .filter((v) => v.inherited)
          .map((v) => v.message)
          .slice(-KEEP_RECENT_INHERITED),
      )
    } else {
      const inherited = composeInherited(path, visible)
      summaries.push(...inherited.summaries)
      messages.push(...inherited.messages)
    }
  }

  const ownUpTo = target.summaryUpToSeq
  if (target.contextSummary && ownUpTo !== null) {
    summaries.push({ label: `Resumen de esta rama («${target.alias}»)`, text: target.contextSummary })
  }
  messages.push(
    ...visible
      .filter((v) => !v.inherited)
      .map((v) => v.message)
      .filter((m) => ownUpTo === null || !target.contextSummary || m.seq > ownUpTo),
  )

  let truncated = false
  while (messages.length > 1 && size(messages) > budget) {
    messages = messages.slice(1)
    truncated = true
  }
  return { summaries, messages, truncated }
}

const OTHER_BRANCHES_MAX = 8
const OTHER_BRANCH_SUMMARY_CHARS = 300

export type BranchNote = { seq: bigint; text: string }

/**
 * Ramas que se separaron del camino actual: las hermanas de cada tramo (con sus subramas) y lo que siguió
 * en cada ancestro después de la bifurcación. Solo se describen en una línea para que el modelo sepa que
 * existen sin mezclar sus detalles con esta rama. `notes` son las dudas registradas en cada rama del árbol
 * interno (por id de rama), con el `seq` del mensaje donde nacieron.
 */
export function otherBranches(
  nodes: TreeNode[],
  path: TreeNode[],
  notes: Map<string, BranchNote[]>,
): LabeledText[] {
  const onPath = new Set(path.map((n) => n.id))
  const childrenOf = (id: string) => nodes.filter((n) => n.parentId === id)
  const subtreeNotes = (node: TreeNode): string[] => [
    ...(notes.get(node.id) ?? []).map((n) => n.text),
    ...childrenOf(node.id).flatMap(subtreeNotes),
  ]

  const result: LabeledText[] = []
  path.forEach((ancestor, index) => {
    const forkSeq = path[index + 1]?.anchorSeq
    const after = forkSeq != null ? (notes.get(ancestor.id) ?? []).filter((n) => n.seq > forkSeq) : []
    if (after.length) {
      result.push({
        label: `${ancestor.alias} (continuación)`,
        text: after.map((n) => n.text).join('; ').slice(0, OTHER_BRANCH_SUMMARY_CHARS),
      })
    }
    for (const sibling of childrenOf(ancestor.id)) {
      if (onPath.has(sibling.id)) continue
      const text = sibling.contextSummary ?? (subtreeNotes(sibling).join('; ') || sibling.topic)
      result.push({ label: sibling.alias, text: text.slice(0, OTHER_BRANCH_SUMMARY_CHARS) })
    }
  })
  return result.slice(0, OTHER_BRANCHES_MAX)
}

/** Largo del tramo heredado que se enviaría sin resumen propio (para decidir si conviene resumirlo). */
export function inheritedSize(
  path: TreeNode[],
  visible: { message: ChatMessageLike; inherited: boolean; nodeIndex: number }[],
) {
  return size(composeInherited(path, visible).messages)
}
