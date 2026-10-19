'use client'

import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/empty-state'

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <EmptyState
      icon={TriangleAlert}
      title="Algo salió mal"
      description="No pudimos cargar esta pantalla. Probá de nuevo; si el problema sigue, volvé más tarde."
    >
      <Button onClick={reset}>Reintentar</Button>
    </EmptyState>
  )
}
