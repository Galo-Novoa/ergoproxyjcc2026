'use client'

import { ChevronDown, GitBranch, LogOut, Settings2, UserRound } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'

function initial(name: string) {
  return name.trim()[0]?.toUpperCase() ?? 'U'
}

export function Topbar({ user }: { user: { name: string; email: string } }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [, startTransition] = useTransition()
  const wrapRef = useRef<HTMLDivElement>(null)

  // El menú se cierra al tocar fuera o con Escape: es un popover a mano, no un dropdown de shadcn.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

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
    <header className="topbar">
      <Link href="/" className="brand">
        <span className="brand-mark">
          <GitBranch size={17} />
        </span>
        <span>Landscape</span>
      </Link>
      <div className="top-actions">
        <Link href="/settings" className="icon-button" aria-label="Ajustes">
          <Settings2 size={18} />
        </Link>
        <div className="profile-wrap" ref={wrapRef}>
          <button
            type="button"
            className="profile-button"
            aria-expanded={open}
            aria-haspopup="menu"
            onClick={() => setOpen((value) => !value)}
          >
            <span className="avatar">{initial(user.name)}</span>
            <span>{user.name.split(/\s+/)[0]}</span>
            <ChevronDown size={14} />
          </button>
          {open && (
            <div className="profile-menu" role="menu">
              <div className="menu-label">{user.email}</div>
              <Link href="/settings" role="menuitem" onClick={() => setOpen(false)}>
                <UserRound size={15} /> Perfil
              </Link>
              <button type="button" role="menuitem" onClick={handleSignOut}>
                <LogOut size={15} /> Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
