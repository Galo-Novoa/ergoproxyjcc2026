import 'server-only'
import { cache } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { isDatabaseConfigured, isDemoMode } from '@/lib/db/config'

type SessionUser = { id: string; name: string; email: string }

// Identidad local del modo demo: solo existe cuando no hay base y NO estamos en producción.
const DEMO_USER: SessionUser = {
  id: 'demo-user',
  name: 'Usuario demo',
  email: 'demo@local',
}

/**
 * Las acciones que escriben en Postgres no pueden correr sin base de datos (la
 * identidad demo no existe en la tabla de usuarios). Devuelven este error.
 */
export function demoModeBlock(): { ok: false; error: string } | null {
  if (isDatabaseConfigured) return null
  return {
    ok: false,
    error: isDemoMode
      ? 'Modo demo: conectá una base de datos para guardar datos.'
      : 'La aplicación no tiene base de datos configurada.',
  }
}

export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
)

/** Para páginas: redirige a /sign-in si no hay sesión válida en el servidor. */
export async function requireUser(): Promise<SessionUser> {
  if (isDemoMode) return DEMO_USER
  const session = await getSession()
  if (!session?.user) redirect('/sign-in')
  return session.user
}

/** Para server actions y route handlers: lanza si no hay sesión. */
export async function getUserId() {
  if (isDemoMode) return DEMO_USER.id
  const session = await getSession()
  if (!session?.user) throw new Error('No autorizado')
  return session.user.id
}
