import { Topbar } from '@/components/nodo/topbar'
import { requireUser } from '@/lib/session'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()

  return (
    <div className="app-shell">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-black focus:px-3 focus:py-2 focus:text-white"
      >
        Saltar al contenido
      </a>
      <Topbar user={{ name: user.name, email: user.email }} />
      <div id="contenido">{children}</div>
    </div>
  )
}
