import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SubjectTabs } from '@/components/nodo/subject-tabs'
import { getSubject } from '@/lib/data/queries'
import { requireUser } from '@/lib/session'

export default async function SubjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireUser()
  const subject = await getSubject(user.id, id)
  if (!subject) notFound()

  return (
    <main className="workspace">
      <div className="workspace-head">
        <Link href="/" className="back-button">
          <ChevronLeft size={16} /> Mis materias
        </Link>
        <div className="crumb-slash">/</div>
        <span>{subject.name}</span>
      </div>
      <div className="subject-title-row">
        <div>
          <div className="eyebrow">ESPACIO DE ESTUDIO</div>
          <h1>{subject.name}</h1>
        </div>
        <SubjectTabs subjectId={id} />
      </div>
      {children}
    </main>
  )
}
