import { Sparkles } from 'lucide-react'
import type { Metadata } from 'next'
import { SubjectGrid, type SubjectCard } from '@/components/nodo/subject-grid'
import { listSubjects } from '@/lib/data/queries'
import { isDatabaseConfigured } from '@/lib/db/config'
import { requireUser } from '@/lib/session'

export const metadata: Metadata = { title: 'Mis materias' }

const dateFormat = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

export default async function SubjectsDashboardPage() {
  const user = await requireUser()
  const subjects = await listSubjects(user.id)

  const cards: SubjectCard[] = subjects.map((subject) => ({
    id: subject.id,
    name: subject.name,
    color: subject.color,
    fileCount: subject.fileCount,
    conversationCount: subject.conversationCount,
    lastActivityAt: subject.lastActivityAt.toISOString(),
  }))

  return (
    <main className="dashboard">
      <div className="dashboard-intro">
        <div>
          <div className="eyebrow">{dateFormat.format(new Date()).toUpperCase()}</div>
          <h1>
            Mis materias <span className="wave">⌁</span>
          </h1>
          <p>Continuá donde lo dejaste o empezá algo nuevo.</p>
        </div>
      </div>

      <section>
        <div className="section-heading">
          <h2>Tu espacio de estudio</h2>
        </div>
        <SubjectGrid subjects={cards} />
      </section>

      {!isDatabaseConfigured && (
        <div className="tip-card">
          <div className="tip-symbol">
            <Sparkles size={18} />
          </div>
          <div>
            <strong>Modo demo: todavía no se guarda nada</strong>
            <p>
              Conectá una base de datos para que tus materias, sesiones y árboles persistan entre
              visitas.
            </p>
          </div>
        </div>
      )}
    </main>
  )
}
