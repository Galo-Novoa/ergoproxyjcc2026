'use client'

import { ArrowUpRight, LayoutGrid, X, ZoomIn, ZoomOut } from 'lucide-react'
import { moveQuestionNode } from '@/app/actions/questions'
import { toPixels, useNodeCanvas } from '@/hooks/use-node-canvas'

export type HistoryNode = {
  id: string
  question: string
  answerSummary: string | null
  parentId: string | null
  /** Sesión donde nació el nodo; continuar desde él abre esa sesión. */
  conversationId: string | null
  posX: number
  posY: number
  status: string
}

/** Alias corto para el nodo: la pregunta completa va en el panel de detalle. */
const labelOf = (node: HistoryNode) =>
  node.question.length > 32 ? `${node.question.slice(0, 32)}…` : node.question

export function HistoryOverlay({
  nodes,
  selected,
  setSelected,
  onClose,
  onContinue,
}: {
  nodes: HistoryNode[]
  selected: string | null
  setSelected: (id: string | null) => void
  onClose: () => void
  onContinue: (id: string | null) => void
}) {
  const canvas = useNodeCanvas({
    nodes,
    onMoveEnd: (id, posX, posY) => void moveQuestionNode(id, posX, posY),
    onEscape: onClose,
  })

  const selectedNode = nodes.find((node) => node.id === selected) ?? null

  return (
    <div className="overlay">
      <div className="overlay-top">
        <div>
          <span className="eyebrow">EXPLORACIÓN VISUAL</span>
          <h2>Historial de dudas</h2>
          <p>
            {nodes.length
              ? `${nodes.length} ${nodes.length === 1 ? 'nodo' : 'nodos'} · se arma mientras chateás`
              : 'Sin nodos todavía · se van creando a medida que preguntás'}
          </p>
        </div>
        <button
          type="button"
          className="close-overlay"
          onClick={onClose}
          aria-label="Cerrar historial"
        >
          <X size={18} />
        </button>
      </div>
      <div
        ref={canvas.stageRef}
        className={`tree-stage infinite-canvas ${canvas.isPanning ? 'is-panning' : ''}`}
        tabIndex={0}
        role="application"
        aria-label="Canvas del historial. Flechas para mover la vista, más y menos para zoom, 0 para centrar."
        onPointerDown={canvas.startPan}
        onKeyDown={canvas.handleKeyDown}
        style={canvas.stageStyle}
      >
        <div className="tree-world" style={canvas.worldStyle}>
          <svg className="tree-lines" width="1" height="1" aria-hidden="true">
            {nodes
              .filter((node) => node.parentId)
              .map((node) => {
                const parentNode = nodes.find((candidate) => candidate.id === node.parentId)
                if (!parentNode) return null
                const parent = toPixels(canvas.getPosition(parentNode))
                const child = toPixels(canvas.getPosition(node))
                return (
                  <path
                    key={node.id}
                    d={`M${parent.x} ${parent.y + 22} C${parent.x} ${parent.y + 80} ${child.x} ${child.y - 80} ${child.x} ${child.y - 22}`}
                  />
                )
              })}
          </svg>
          {nodes.map((node) => {
            const position = toPixels(canvas.getPosition(node))
            return (
              <button
                key={node.id}
                type="button"
                className={`tree-node ${selected === node.id ? 'selected' : ''}`}
                style={{
                  left: `${position.x}px`,
                  top: `${position.y}px`,
                  cursor: canvas.draggingId === node.id ? 'grabbing' : 'grab',
                  touchAction: 'none',
                }}
                onPointerDown={(event) => canvas.startNodeDrag(event, node)}
                onClick={() => setSelected(node.id)}
              >
                <span className="node-dot" />
                <span>{labelOf(node)}</span>
                {selected === node.id && <small>seleccionado</small>}
              </button>
            )
          })}
        </div>
        <div className="tree-controls">
          <button type="button" onClick={() => canvas.zoomAt(1.2)} aria-label="Acercar">
            <ZoomIn size={15} />
          </button>
          <span className="zoom-value">{Math.round(canvas.camera.zoom * 100)}%</span>
          <button type="button" onClick={() => canvas.zoomAt(1 / 1.2)} aria-label="Alejar">
            <ZoomOut size={15} />
          </button>
          <button type="button" onClick={canvas.fitView} aria-label="Centrar árbol">
            <LayoutGrid size={15} />
          </button>
        </div>
        <div className="canvas-hint">
          Arrastrá el fondo para mover la vista · Ctrl + rueda para zoom
        </div>
      </div>
      <div className="node-detail">
        <div>
          <span className="detail-label">
            {selectedNode ? 'PREGUNTA SELECCIONADA' : 'NINGÚN NODO SELECCIONADO'}
          </span>
          <h3>{selectedNode ? selectedNode.question : 'Tocá un nodo para verlo'}</h3>
          <p>
            {selectedNode
              ? (selectedNode.answerSummary ?? 'Todavía sin resumen de respuesta.')
              : 'Desde acá podés volver a cualquier duda y seguir preguntando a partir de ella.'}
          </p>
        </div>
        <button
          type="button"
          className="button primary"
          onClick={() => onContinue(selected)}
          disabled={!selectedNode}
        >
          Continuar desde aquí <ArrowUpRight size={15} />
        </button>
      </div>
    </div>
  )
}
