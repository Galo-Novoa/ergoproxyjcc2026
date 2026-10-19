import { FlaskConical } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export function DemoBadge({ label = 'Modo demo' }: { label?: string }) {
  return (
    <Badge variant="outline" className="border-accent bg-accent/40 text-accent-foreground">
      <FlaskConical data-icon="inline-start" />
      {label}
    </Badge>
  )
}
