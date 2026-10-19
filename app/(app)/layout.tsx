import { AppSidebar } from '@/components/layout/app-sidebar'
import { Separator } from '@/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { requireUser } from '@/lib/session'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireUser()

  return (
    <TooltipProvider>
    <SidebarProvider>
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Saltar al contenido
      </a>
      <AppSidebar user={{ name: user.name, email: user.email }} />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger aria-label="Mostrar u ocultar la navegación" />
          <Separator orientation="vertical" className="h-4" />
          <span className="text-sm text-muted-foreground">
            Facultad de Ciencias Exactas, Ingeniería y Agrimensura
          </span>
        </header>
        <main id="contenido" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 md:px-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
    </TooltipProvider>
  )
}
