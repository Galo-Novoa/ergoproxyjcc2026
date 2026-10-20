'use client'

import { FileText, Folder, GitBranch } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { slug: '', label: 'Chat', icon: GitBranch },
  { slug: '/carpeta', label: 'Carpeta', icon: Folder },
  { slug: '/archivos', label: 'Archivos', icon: FileText },
] as const

export function SubjectTabs({ subjectId }: { subjectId: string }) {
  const pathname = usePathname()
  const base = `/subjects/${subjectId}`

  return (
    <div className="tabs">
      {TABS.map(({ slug, label, icon: Icon }) => {
        const href = `${base}${slug}`
        const active = slug === '' ? pathname === base : pathname.startsWith(href)
        return (
          <Link key={label} href={href} className={active ? 'tab active' : 'tab'}>
            <Icon size={16} /> {label}
          </Link>
        )
      })}
    </div>
  )
}
