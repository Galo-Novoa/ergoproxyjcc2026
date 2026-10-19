import type { Metadata } from 'next'
import { DemoBadge } from '@/components/shared/demo-badge'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { isDatabaseConfigured } from '@/lib/db/config'
import { requireUser } from '@/lib/session'

export const metadata: Metadata = { title: 'Configuración' }

export default async function SettingsPage() {
  const user = await requireUser()

  const rows = [
    { label: 'Nombre', value: user.name },
    { label: 'Correo electrónico', value: user.email },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Configuración" description="Tu cuenta y el estado de los servicios." />

      <Card>
        <CardHeader>
          <CardTitle>Cuenta</CardTitle>
          <CardDescription>Los datos con los que iniciaste sesión.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col divide-y text-sm">
            {rows.map((row) => (
              <div key={row.label} className="flex flex-col gap-1 py-3 sm:flex-row sm:justify-between">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="font-medium">{row.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Almacenamiento de datos</CardTitle>
          <CardDescription>Dónde se guardan tus materias y documentos.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3 text-sm">
          {isDatabaseConfigured ? (
            <Badge variant="secondary">Base de datos conectada</Badge>
          ) : (
            <DemoBadge label="Modo demo: sin base de datos" />
          )}
          <span className="text-muted-foreground">
            {isDatabaseConfigured
              ? 'Tus materias se guardan en tu cuenta.'
              : 'Los cambios viven solo en memoria y se pierden al reiniciar.'}
          </span>
        </CardContent>
      </Card>
    </div>
  )
}
