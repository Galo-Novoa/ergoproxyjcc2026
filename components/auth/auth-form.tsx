'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { authClient } from '@/lib/auth-client'

const MIN_PASSWORD = 8

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const isSignUp = mode === 'sign-up'

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')
    const name = String(form.get('name') ?? '').trim()

    if (isSignUp && password.length < MIN_PASSWORD) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`)
      return
    }

    startTransition(async () => {
      const result = isSignUp
        ? await authClient.signUp.email({ email, password, name })
        : await authClient.signIn.email({ email, password })

      if (result.error) {
        setError(
          isSignUp
            ? 'No pudimos crear la cuenta. Revisá los datos o probá con otro correo.'
            : 'Correo o contraseña incorrectos.',
        )
        return
      }
      router.push('/')
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} noValidate={false} className="flex flex-col gap-6">
      <FieldGroup>
        {isSignUp ? (
          <Field>
            <FieldLabel htmlFor="name">Nombre y apellido</FieldLabel>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              required
              disabled={pending}
            />
          </Field>
        ) : null}
        <Field>
          <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="nombre@fceia.unr.edu.ar"
            required
            disabled={pending}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Contraseña</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            minLength={isSignUp ? MIN_PASSWORD : undefined}
            required
            disabled={pending}
          />
          {isSignUp ? (
            <FieldDescription>Mínimo {MIN_PASSWORD} caracteres.</FieldDescription>
          ) : null}
        </Field>
      </FieldGroup>

      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? <Spinner data-icon="inline-start" /> : null}
        {isSignUp ? 'Crear cuenta' : 'Ingresar'}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {isSignUp ? '¿Ya tenés cuenta? ' : '¿Todavía no tenés cuenta? '}
        <Link
          href={isSignUp ? '/sign-in' : '/sign-up'}
          className="font-medium text-primary underline underline-offset-4"
        >
          {isSignUp ? 'Ingresá' : 'Registrate'}
        </Link>
      </p>
    </form>
  )
}
