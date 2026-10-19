import 'server-only'
import { cache } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
)

/** Para páginas: redirige a /sign-in si no hay sesión válida en el servidor. */
export async function requireUser() {
  const session = await getSession()
  if (!session?.user) redirect('/sign-in')
  return session.user
}

/** Para server actions y route handlers: lanza si no hay sesión. */
export async function getUserId() {
  const session = await getSession()
  if (!session?.user) throw new Error('No autorizado')
  return session.user.id
}
