'use client'

import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { createConversation } from '@/app/actions/conversations'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

export function NewConversationButton({ subjectId }: { subjectId?: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      const result = await createConversation(subjectId)
      if (!result.ok || !result.data) {
        toast.error(result.ok ? 'No pudimos crear la conversación.' : result.error)
        return
      }
      router.push(`/chat/${result.data.id}`)
    })
  }

  return (
    <Button onClick={handleClick} disabled={pending}>
      {pending ? <Spinner data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
      Nueva conversación
    </Button>
  )
}
