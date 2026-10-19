import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/auth/auth-form'
import { AuthShell } from '@/components/auth/auth-shell'
import { getSession } from '@/lib/session'

export const metadata: Metadata = { title: 'Ingresar' }

export default async function SignInPage() {
  const session = await getSession()
  if (session?.user) redirect('/')

  return (
    <AuthShell
      title="Ingresá a tu cuenta"
      description="Retomá tus materias y conversaciones donde las dejaste."
    >
      <AuthForm mode="sign-in" />
    </AuthShell>
  )
}
