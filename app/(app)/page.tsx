import {
  ArrowRight,
  BookOpen,
  FileText,
  Files,
  MessagesSquare,
  Network,
} from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { getOverview } from '@/lib/data/queries'
import { requireUser } from '@/lib/session'

export default async function HomePage() {
  const user = await requireUser()
  const overview = await getOverview(user.id)
  const firstName = user.name.split(/\s+/)[0]
  const isNew =
    overview.subjects + overview.files + overview.conversations + overview.documents === 0

  const tiles = [
    {
      href: '/subjects',
      icon: BookOpen,
      title: 'Materias',
      count: overview.subjects,
      text: 'Organizá tu cursada por materia.',
    },
    {
      href: '/files',
      icon: Files,
      title: 'Archivos',
      count: overview.files,
      text: 'Apuntes, guías y parciales.',
    },
    {
      href: '/chat',
      icon: MessagesSquare,
      title: 'Conversaciones',
      count: overview.conversations,
      text: 'Preguntá sobre tu material.',
    },
    {
      href: '/map',
      icon: Network,
      title: 'Mapa de dudas',
      count: overview.openQuestions,
      text: 'Dudas abiertas por resolver.',
    },
    {
      href: '/documents',
      icon: FileText,
      title: 'Documentos',
      count: overview.documents,
      text: 'Resúmenes y notas propias.',
    },
  ]

  return (
    <div className="flex flex-col">
      <PageHeader
        title={`Hola, ${firstName}`}
        description={
          isNew
            ? 'Empecemos por lo básico: creá tu primera materia y a partir de ahí sumá archivos, conversaciones y notas.'
            : 'Esto es lo que tenés en Ergoproxy hoy.'
        }
        actions={
          isNew ? (
            <Button asChild>
              <Link href="/subjects">
                Crear mi primera materia
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map(({ href, icon: Icon, title, count, text }) => (
          <Link
            key={href}
            href={href}
            className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Card className="h-full transition-colors hover:bg-muted/60">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                    <Icon className="size-5" />
                  </span>
                  <Badge variant="secondary">{count}</Badge>
                </div>
                <CardTitle className="pt-2">{title}</CardTitle>
                <CardDescription>{text}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Cómo se usa</CardTitle>
          <CardDescription>
            Un recorrido corto para sacarle provecho desde el primer día.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-muted-foreground">
            <li>Creá una materia por cada cursada.</li>
            <li>Iniciá una conversación y asociala a la materia.</li>
            <li>Anotá lo que no entendés en el mapa de dudas y marcalo como resuelto cuando lo domines.</li>
            <li>Guardá tus conclusiones como documentos para repasar antes del parcial.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
