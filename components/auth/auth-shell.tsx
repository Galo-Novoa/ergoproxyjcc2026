import { BookOpen, GraduationCap, MessagesSquare, Network } from 'lucide-react'
import type { ReactNode } from 'react'

const highlights = [
  { icon: BookOpen, text: 'Tus materias y apuntes, ordenados en un solo lugar.' },
  { icon: MessagesSquare, text: 'Conversaciones que parten de tus propios archivos.' },
  { icon: Network, text: 'Un mapa de tus dudas para ver qué ya entendiste.' },
]

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <section className="bg-graph-paper relative hidden flex-col justify-between border-r bg-secondary/40 p-12 lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="size-5" />
          </span>
          <span className="font-serif text-xl font-semibold">Landscape</span>
        </div>
        <div className="flex max-w-md flex-col gap-8">
          <h2 className="text-4xl leading-tight font-semibold">
            Estudiá con lo que ya tenés, no con lo que te falta.
          </h2>
          <ul className="flex flex-col gap-4">
            {highlights.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-muted-foreground">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                  <Icon className="size-4" />
                </span>
                <span className="text-pretty">{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-muted-foreground">
          Facultad de Ciencias Exactas, Ingeniería y Agrimensura · Universidad Nacional de
          Rosario
        </p>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-sm flex-col gap-8">
          <div className="flex items-center gap-3 lg:hidden">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="size-5" />
            </span>
            <span className="font-serif text-xl font-semibold">Landscape</span>
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold">{title}</h1>
            <p className="text-pretty text-muted-foreground">{description}</p>
          </div>
          {children}
        </div>
      </section>
    </main>
  )
}
