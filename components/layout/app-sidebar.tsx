'use client'

import {
  BookOpen,
  FileText,
  Files,
  GraduationCap,
  LayoutDashboard,
  MessagesSquare,
  Network,
  Search,
  Settings,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserMenu } from '@/components/layout/user-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'

const study = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/subjects', label: 'Materias', icon: BookOpen },
  { href: '/search', label: 'Búsqueda', icon: Search },
  { href: '/settings', label: 'Configuración', icon: Settings },
]

const tools = [
  { href: '/files', label: 'Archivos', icon: Files },
  { href: '/chat', label: 'Conversaciones', icon: MessagesSquare },
  { href: '/map', label: 'Mapa de dudas', icon: Network },
  { href: '/documents', label: 'Documentos', icon: FileText },
]

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}

function NavGroup({
  label,
  items,
}: {
  label: string
  items: typeof study
}) {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map(({ href, label: itemLabel, icon: Icon }) => (
            <SidebarMenuItem key={href}>
              <SidebarMenuButton
                asChild
                isActive={isActive(pathname, href)}
                tooltip={itemLabel}
              >
                <Link
                  href={href}
                  onClick={() => setOpenMobile(false)}
                  aria-current={isActive(pathname, href) ? 'page' : undefined}
                >
                  <Icon />
                  <span>{itemLabel}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

export function AppSidebar({
  user,
}: {
  user: { name: string; email: string }
}) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <GraduationCap className="size-4" />
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="font-serif text-base font-semibold">Ergoproxy</span>
                  <span className="text-xs text-muted-foreground">FCEIA · UNR</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavGroup label="Navegación" items={study} />
        <NavGroup label="Herramientas" items={tools} />
      </SidebarContent>
      <SidebarFooter>
        <UserMenu user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
