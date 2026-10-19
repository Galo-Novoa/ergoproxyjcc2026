'use client'

import { Check, GitBranch, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { resolveAgentAction } from '@/app/actions/agent-actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { agentActionSchema } from '@/lib/llm/contract'

export type AgentActionView = { id: string; status: string; payload: unknown }

export function AgentActionCard({ action }: { action: AgentActionView }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const parsed = agentActionSchema.safeParse(action.payload)
  if (!parsed.success) return null
  const { title, description } = parsed.data

  function resolve(decision: 'accept' | 'dismiss') {
    startTransition(async () => {
      const result = await resolveAgentAction(action.id, decision)
      if (!result.ok) {
        toast.error(result.error)
        router.refresh()
        return
      }
      toast.success(decision === 'accept' ? 'Rama agregada al mapa de dudas.' : 'Propuesta descartada.')
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-background p-3 text-sm">
      <div className="flex items-start gap-2">
        <GitBranch className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Rama propuesta para el mapa de dudas</span>
          <span className="font-medium text-balance">{title}</span>
          <span className="text-pretty text-muted-foreground">{description}</span>
        </div>
      </div>
      {action.status === 'proposed' ? (
        <div className="flex gap-2">
          <Button size="sm" disabled={pending} onClick={() => resolve('accept')}>
            {pending ? <Spinner data-icon="inline-start" /> : <Check data-icon="inline-start" />}
            Agregar al mapa
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => resolve('dismiss')}>
            <X data-icon="inline-start" />
            Descartar
          </Button>
        </div>
      ) : (
        <Badge variant="secondary" className="w-fit">
          {action.status === 'accepted' ? 'Agregada al mapa' : 'Descartada'}
        </Badge>
      )}
    </div>
  )
}
