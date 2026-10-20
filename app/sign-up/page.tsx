import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AuthScreen } from '@/components/nodo/auth-screen'
import { getSession } from '@/lib/session'

export const metadata: Metadata = { title: 'Crear cuenta' }

export default async function SignUpPage() {
  const session = await getSession()
  if (session?.user) redirect('/')

  return <AuthScreen mode="sign-up" />
}
