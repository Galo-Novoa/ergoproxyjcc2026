'use client'

import { ChevronsUpDown, LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { authClient } from '@/lib/auth-client'

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export function UserMenu({ user }: { user: { name: string; email: string } }) {
  const router = useRouter()
  const { isMobile } = useSidebar()
  const [, startTransition] = useTransition()

  function handleSignOut() {
    startTransition(async () => {
      const { error } = await authClient.signOut()
      if (error) {
        toast.error('No pudimos cerrar la sesión. Intentá de nuevo.')
        return
      }
      router.push('/sign-in')
      router.refresh()
    })
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
              <Avatar className="size-8">
                <AvatarFallback className="bg-accent text-accent-foreground">
                  {initials(user.name) || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="flex min-w-0 flex-col text-left leading-tight">
                <span className="truncate text-sm font-medium">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              </span>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            className="min-w-56"
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex flex-col">
                <span className="text-sm font-medium">{user.name}</span>
                <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={handleSignOut}>
                <LogOut />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
