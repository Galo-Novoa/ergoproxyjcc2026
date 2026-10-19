import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/auth/auth-form'
import { AuthShell } from '@/components/auth/auth-shell'
import { getSession } from '@/lib/session'

export const metadata: Metadata = { title: 'Crear cuenta' }

export default async function SignUpPage() {
  const session = await getSession()
  if (session?.user) redirect('/')

  return (
    <AuthShell
      title="Creá tu cuenta"
      description="Es gratis y tus materiales quedan visibles solo para vos."
    >
      <AuthForm mode="sign-up" />
    </AuthShell>
  )
}
