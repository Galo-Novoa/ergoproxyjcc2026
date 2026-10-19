'use client'

import { ArrowRight, Check, FolderOpen, GitBranch, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { resolveAgentAction, setActiveNode } from '@/app/actions/agent-actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { FOLDER_KIND_LABELS, type FolderKind } from '@/lib/folder/config'
import type { FolderProposal } from '@/lib/folder/schema'
import { parseProposalPayload } from '@/lib/llm/contract'

export type AgentActionView = {
  id: string
  status: string
  payload: unknown
  resultNodeId: string | null
}

const OPERATION_TITLES: Record<FolderProposal['operation'], string> = {
  create: 'Guardar en la Carpeta',
  append: 'Ampliar un apunte de la Carpeta',
  link: 'Relacionar apuntes de la Carpeta',
}

const OPERATION_ACCEPT: Record<FolderProposal['operation'], string> = {
  create: 'Guardar',
  append: 'Ampliar apunte',
  link: 'Relacionar',
}

function folderSummary(proposal: FolderProposal) {
  if (proposal.operation === 'link') {
    return proposal.relation === 'child' ? 'Se agregaría como subtema.' : 'Se vincularían como apuntes relacionados.'
  }
  const kind = proposal.kind ? FOLDER_KIND_LABELS[proposal.kind as FolderKind] : null
  return [kind, proposal.title].filter(Boolean).join(' · ')
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
  const proposal = parseProposalPayload(action.payload)
  if (!proposal) return null

  const isFolder = proposal.type === 'propose_folder_change'

  function resolve(decision: 'accept' | 'dismiss') {
    startTransition(async () => {
      const result = await resolveAgentAction(action.id, decision)
      if (!result.ok) {
        toast.error(result.error)
        router.refresh()
        return
      }
      if (decision === 'dismiss') toast.success('Propuesta descartada.')
      else toast.success(isFolder ? 'Guardado en la Carpeta.' : 'Rama abierta.')
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

  const Icon = isFolder ? FolderOpen : GitBranch
  const heading = isFolder ? OPERATION_TITLES[proposal.operation] : 'Rama propuesta'
  const title = isFolder ? folderSummary(proposal) : proposal.alias
  const detail = isFolder ? proposal.reason : proposal.description
  const acceptLabel = isFolder ? OPERATION_ACCEPT[proposal.operation] : 'Abrir rama'
  const dismissLabel = isFolder ? 'No guardar' : 'Seguir sin ramas'
  const doneLabel = isFolder ? 'Guardado' : 'Rama creada'

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
      ) : action.status === 'accepted' && isFolder ? (
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{doneLabel}</Badge>
          <Button size="sm" variant="ghost" asChild>
            <Link href="/folder">
              <ArrowRight data-icon="inline-start" />
              Ver en la Carpeta
            </Link>
          </Button>
        </div>
      ) : action.status === 'accepted' && action.resultNodeId ? (
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
