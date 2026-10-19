import 'server-only'
import { cache } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { isDatabaseConfigured } from '@/lib/db/config'

type SessionUser = { id: string; name: string; email: string }

// Identidad local del modo demo: solo existe cuando no hay base de datos.
const DEMO_USER: SessionUser = {
  id: 'demo-user',
  name: 'Usuario demo',
  email: 'demo@local',
}

/**
 * Las acciones que escriben en Postgres no pueden correr con la identidad demo
 * (su id no existe en la tabla de usuarios). Devuelven este error en su lugar.
 */
export function demoModeBlock(): { ok: false; error: string } | null {
  return isDatabaseConfigured
    ? null
    : { ok: false, error: 'Modo demo: conectá una base de datos para guardar datos.' }
}

export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
)

/** Para páginas: redirige a /sign-in si no hay sesión válida en el servidor. */
export async function requireUser(): Promise<SessionUser> {
  if (!isDatabaseConfigured) return DEMO_USER
  const session = await getSession()
  if (!session?.user) redirect('/sign-in')
  return session.user
}

/** Para server actions y route handlers: lanza si no hay sesión. */
export async function getUserId() {
  if (!isDatabaseConfigured) return DEMO_USER.id
  const session = await getSession()
  if (!session?.user) throw new Error('No autorizado')
  return session.user.id
}
