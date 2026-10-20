'use client'

import { ArrowRight, Check, Download, FolderOpen, GitBranch, HelpCircle, Workflow, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { resolveAgentAction, setActiveNode } from '@/app/actions/agent-actions'
import { MermaidDiagram } from '@/components/chat/mermaid-diagram'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { FOLDER_OPERATION_LABELS, parseProposalPayload } from '@/lib/llm/contract'

export type AgentActionView = {
  id: string
  status: string
  payload: unknown
  resultNodeId: string | null
  /** Id del archivo generado, si la acción lo produjo (lo setea el servidor al aceptar). */
  resultFileId?: string | null
}

export function AgentActionCard({
  action,
  conversationId,
}: {
  action: AgentActionView
  conversationId: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [showSource, setShowSource] = useState(false)
  const proposal = parseProposalPayload(action.payload)
  if (!proposal) return null

  const isFolder = proposal.type === 'propose_folder_change'
  const isQuestion = proposal.type === 'propose_question_node'
  const isDiagram = proposal.type === 'propose_diagram'
  const isFile = proposal.type === 'generate_file'

  function resolve(decision: 'accept' | 'dismiss') {
    startTransition(async () => {
      const result = await resolveAgentAction(action.id, decision)
      if (!result.ok) {
        toast.error(result.error)
        router.refresh()
        return
      }
      toast.success(decision === 'accept' ? 'Propuesta aplicada.' : 'Propuesta descartada.')
      router.refresh()
    })
  }

  function openBranch() {
    if (!action.resultNodeId) return
    const nodeId = action.resultNodeId
    startTransition(async () => {
      const result = await setActiveNode(conversationId, nodeId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      router.refresh()
    })
  }

  const Icon = isFolder ? FolderOpen : isQuestion ? HelpCircle : isDiagram ? Workflow : isFile ? Download : GitBranch
  const heading = isFolder
    ? FOLDER_OPERATION_LABELS[proposal.operation]
    : isQuestion
      ? 'Duda propuesta para el mapa'
      : isDiagram
        ? 'Diagrama propuesto'
        : isFile
          ? `Archivo ${proposal.format.toUpperCase()}`
          : 'Rama propuesta'
  const title = isFolder
    ? (proposal.title ?? null)
    : isQuestion
      ? proposal.title
      : isDiagram
        ? proposal.title
        : isFile
          ? proposal.file_name
          : proposal.alias
  const detail = isFolder
    ? proposal.reason
    : isDiagram || isFile
      ? proposal.reason
      : proposal.description
  const acceptLabel = isFolder
    ? 'Aplicar'
    : isQuestion
      ? 'Agregar al mapa'
      : isDiagram
        ? 'Guardar en la Carpeta'
        : isFile
          ? 'Generar archivo'
          : 'Abrir rama'
  const dismissLabel = isFolder || isDiagram || isFile ? 'No aplicar' : 'Descartar'
  const doneLabel = isFolder
    ? 'Aplicado'
    : isQuestion
      ? 'Duda agregada'
      : isDiagram
        ? 'Guardado en la Carpeta'
        : isFile
          ? 'Archivo generado'
          : 'Rama creada'
  const canOpenBranch = !isFolder && !isQuestion && !isDiagram && !isFile

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-background p-3 text-sm">
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">{heading}</span>
          {title ? <span className="font-medium text-balance">{title}</span> : null}
          {detail ? <span className="text-pretty text-muted-foreground">{detail}</span> : null}
        </div>
      </div>

      {isDiagram ? (
        <div className="flex flex-col gap-2">
          <MermaidDiagram source={proposal.source} />
          <button
            type="button"
            className="w-fit text-xs text-muted-foreground underline underline-offset-2"
            onClick={() => setShowSource((v) => !v)}
          >
            {showSource ? 'Ocultar código' : 'Ver/editar código'}
          </button>
          {showSource ? (
            <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">{proposal.source}</pre>
          ) : null}
        </div>
      ) : null}

      {isFile ? (
        <div className="rounded-md bg-muted/50 p-2 font-mono text-xs text-muted-foreground">
          {proposal.content.length} caracteres · {proposal.format.toUpperCase()}
        </div>
      ) : null}

      {action.status === 'proposed' ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={pending} onClick={() => resolve('accept')}>
            {pending ? <Spinner data-icon="inline-start" /> : <Check data-icon="inline-start" />}
            {acceptLabel}
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => resolve('dismiss')}>
            <X data-icon="inline-start" />
            {dismissLabel}
          </Button>
        </div>
      ) : action.status === 'accepted' && isFile && action.resultFileId ? (
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{doneLabel}</Badge>
          <Button size="sm" variant="ghost" asChild>
            <a href={`/api/generated-files/${action.resultFileId}/download?download=1`}>
              <Download data-icon="inline-start" />
              Descargar
            </a>
          </Button>
        </div>
      ) : action.status === 'accepted' && canOpenBranch && action.resultNodeId ? (
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{doneLabel}</Badge>
          <Button size="sm" variant="ghost" disabled={pending} onClick={openBranch}>
            <ArrowRight data-icon="inline-start" />
            Ir a la rama
          </Button>
        </div>
      ) : (
        <Badge variant="secondary" className="w-fit">
          {action.status === 'accepted' ? doneLabel : 'Descartada'}
        </Badge>
      )}
    </div>
  )
}
