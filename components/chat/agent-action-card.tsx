'use client'

import { ArrowRight, Check, GitBranch, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { resolveAgentAction, setActiveNode } from '@/app/actions/agent-actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { parseProposalPayload } from '@/lib/llm/contract'

export type AgentActionView = {
  id: string
  status: string
  payload: unknown
  resultNodeId: string | null
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

  function resolve(decision: 'accept' | 'dismiss') {
    startTransition(async () => {
      const result = await resolveAgentAction(action.id, decision)
      if (!result.ok) {
        toast.error(result.error)
        router.refresh()
        return
      }
      toast.success(decision === 'accept' ? 'Rama abierta.' : 'Propuesta descartada.')
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

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-background p-3 text-sm">
      <div className="flex items-start gap-2">
        <GitBranch className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Rama propuesta</span>
          <span className="font-medium text-balance">{proposal.alias}</span>
          <span className="text-pretty text-muted-foreground">{proposal.description}</span>
        </div>
      </div>
      {action.status === 'proposed' ? (
        <div className="flex gap-2">
          <Button size="sm" disabled={pending} onClick={() => resolve('accept')}>
            {pending ? <Spinner data-icon="inline-start" /> : <Check data-icon="inline-start" />}
            Abrir rama
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => resolve('dismiss')}>
            <X data-icon="inline-start" />
            Seguir sin ramas
          </Button>
        </div>
      ) : action.status === 'accepted' && action.resultNodeId ? (
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Rama creada</Badge>
          <Button size="sm" variant="ghost" disabled={pending} onClick={openBranch}>
            <ArrowRight data-icon="inline-start" />
            Ir a la rama
          </Button>
        </div>
      ) : (
        <Badge variant="secondary" className="w-fit">
          {action.status === 'accepted' ? 'Rama creada' : 'Descartada'}
        </Badge>
      )}
    </div>
  )
}
