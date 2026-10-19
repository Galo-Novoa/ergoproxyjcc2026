'use client'

import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { GitBranch, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { MapNode } from '@/lib/tree/branch'

const COLUMN_WIDTH = 220
const ROW_HEIGHT = 84
const MAX_RESULTS = 12

type BranchNodeData = {
  alias: string
  messageCount: number
  active: boolean
  onPath: boolean
  isRoot: boolean
}
type BranchFlowNode = Node<BranchNodeData, 'branch'>

function BranchNodeView({ data }: NodeProps<BranchFlowNode>) {
  return (
    <div
      className={cn(
        'flex w-44 flex-col gap-0.5 rounded-lg border bg-card px-3 py-2 text-left text-sm shadow-xs',
        data.onPath && 'border-primary/60',
        data.active && 'border-primary bg-primary/10 ring-2 ring-primary/30',
      )}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} isConnectable={false} />
      <span className="truncate font-medium">{data.alias}</span>
      <span className="text-xs text-muted-foreground">
        {data.isRoot ? 'Pregunta inicial · ' : ''}
        {data.messageCount} {data.messageCount === 1 ? 'mensaje' : 'mensajes'}
      </span>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} isConnectable={false} />
    </div>
  )
}

const nodeTypes = { branch: BranchNodeView }

/** Árbol horizontal: la profundidad fija la columna y cada hoja ocupa una fila; el padre queda centrado. */
function layout(nodes: MapNode[]) {
  const children = new Map<string | null, MapNode[]>()
  for (const node of nodes) {
    const siblings = children.get(node.parentId) ?? []
    siblings.push(node)
    children.set(node.parentId, siblings)
  }
  const positions = new Map<string, { x: number; y: number }>()
  let nextRow = 0
  const place = (node: MapNode, depth: number, seen: Set<string>): number => {
    if (seen.has(node.id)) return nextRow
    seen.add(node.id)
    const kids = children.get(node.id) ?? []
    let y: number
    if (kids.length === 0) {
      y = nextRow * ROW_HEIGHT
      nextRow += 1
    } else {
      const ys = kids.map((kid) => place(kid, depth + 1, seen))
      y = (ys[0] + ys[ys.length - 1]) / 2
    }
    positions.set(node.id, { x: depth * COLUMN_WIDTH, y })
    return y
  }
  const seen = new Set<string>()
  for (const root of children.get(null) ?? []) place(root, 0, seen)
  return positions
}

function ancestorsOf(nodes: MapNode[], id: string) {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const ids = new Set<string>()
  let current = byId.get(id)
  while (current && !ids.has(current.id)) {
    ids.add(current.id)
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return ids
}

function matches(node: MapNode, query: string) {
  const alias = node.alias.toLocaleLowerCase('es')
  const topic = node.topic.toLocaleLowerCase('es')
  const question = node.questions.find((q) => q.text.toLocaleLowerCase('es').includes(query))
  if (alias.includes(query) || topic.includes(query) || question) {
    return { node, question: question?.text ?? null }
  }
  return null
}

export function ConversationMap({
  nodes,
  activeNodeId,
  disabled,
  onSelect,
}: {
  nodes: MapNode[]
  activeNodeId: string
  disabled?: boolean
  onSelect: (nodeId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const { flowNodes, flowEdges } = useMemo(() => {
    const positions = layout(nodes)
    const onPath = ancestorsOf(nodes, activeNodeId)
    const flowNodes: BranchFlowNode[] = nodes.map((n) => ({
      id: n.id,
      type: 'branch',
      position: positions.get(n.id) ?? { x: 0, y: 0 },
      draggable: false,
      data: {
        alias: n.alias,
        messageCount: n.messageCount,
        active: n.id === activeNodeId,
        onPath: onPath.has(n.id),
        isRoot: n.parentId === null,
      },
    }))
    const flowEdges: Edge[] = nodes
      .filter((n) => n.parentId)
      .map((n) => ({
        id: `${n.parentId}-${n.id}`,
        source: n.parentId as string,
        target: n.id,
        animated: onPath.has(n.id) && onPath.has(n.parentId as string),
      }))
    return { flowNodes, flowEdges }
  }, [nodes, activeNodeId])

  const normalized = query.trim().toLocaleLowerCase('es')
  const results = useMemo(() => {
    const list = normalized
      ? nodes.map((n) => matches(n, normalized)).filter((r) => r !== null)
      : nodes.map((node) => ({ node, question: null as string | null }))
    return list.slice(0, MAX_RESULTS)
  }, [nodes, normalized])

  function select(nodeId: string) {
    setOpen(false)
    setQuery('')
    if (nodeId !== activeNodeId) onSelect(nodeId)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={disabled}>
          <GitBranch data-icon="inline-start" />
          Mapa
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90svh] flex-col gap-3 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Mapa de la conversación</DialogTitle>
          <DialogDescription>
            Cada rama es un chat aparte que hereda lo hablado hasta donde se bifurcó. Elegí una para continuar ahí.
          </DialogDescription>
        </DialogHeader>

        <div className="h-72 shrink-0 overflow-hidden rounded-lg border bg-background">
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => select(node.id)}
            nodesConnectable={false}
            nodesDraggable={false}
            fitView
            fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
            minZoom={0.3}
            maxZoom={1.5}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar una pregunta o una rama"
            aria-label="Buscar una pregunta o una rama"
            className="pl-9"
          />
        </div>

        <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto" aria-label="Ramas">
          {results.length === 0 ? (
            <li className="px-2 py-3 text-sm text-muted-foreground">No encontramos ninguna pregunta con ese texto.</li>
          ) : (
            results.map(({ node, question }) => (
              <li key={node.id}>
                <button
                  type="button"
                  onClick={() => select(node.id)}
                  aria-current={node.id === activeNodeId ? 'true' : undefined}
                  className={cn(
                    'flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                    node.id === activeNodeId && 'bg-primary/10',
                  )}
                >
                  <span className="flex items-center gap-2 font-medium">
                    {node.alias}
                    {node.id === activeNodeId ? (
                      <span className="text-xs font-normal text-primary">Rama activa</span>
                    ) : null}
                  </span>
                  <span className="line-clamp-2 text-muted-foreground">{question ?? node.topic}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
