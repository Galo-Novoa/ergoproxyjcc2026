'use client'

import { ArrowUpRight, GitBranch } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { authClient } from '@/lib/auth-client'

const MIN_PASSWORD = 8

export function AuthScreen({ mode }: { mode: 'sign-in' | 'sign-up' }) {
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
    <main className="login">
      <div className="login-card">
        <div className="login-logo">
          <span className="brand-mark">
            <GitBranch size={19} />
          </span>
          <span>Landscape</span>
        </div>
        <div className="login-copy">
          <div className="eyebrow">TU ESPACIO PARA APRENDER</div>
          <h1>
            Entendé más.
            <br />
            <em>Acordate mejor.</em>
          </h1>
          <p>Explorá tus dudas y mirá cómo evoluciona tu aprendizaje.</p>
        </div>

        <form className="form" onSubmit={handleSubmit}>
          {isSignUp && (
            <>
              <label htmlFor="name">Nombre y apellido</label>
              <input id="name" name="name" autoComplete="name" required disabled={pending} />
            </>
          )}
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="nombre@fceia.unr.edu.ar"
            required
            disabled={pending}
          />
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            minLength={isSignUp ? MIN_PASSWORD : undefined}
            required
            disabled={pending}
          />

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="button primary login-button" disabled={pending}>
            {pending
              ? 'Un momento…'
              : isSignUp
                ? 'Crear cuenta'
                : 'Iniciar sesión'}{' '}
            <ArrowUpRight size={16} />
          </button>

          <p className="form-switch">
            {isSignUp ? '¿Ya tenés cuenta? ' : '¿Todavía no tenés cuenta? '}
            <Link href={isSignUp ? '/sign-in' : '/sign-up'}>
              {isSignUp ? 'Ingresá' : 'Registrate'}
            </Link>
          </p>
        </form>

        <div className="login-foot">
          <span>FCEIA · UNR</span>
          <span>Tus materias, tus dudas, tu mapa</span>
        </div>
      </div>

      <div className="login-aside">
        <div className="aside-orbit orbit-one" />
        <div className="aside-orbit orbit-two" />
        <div className="aside-note note-one">
          ¿Cómo se relacionan
          <br />
          estos conceptos?
        </div>
        <div className="aside-note note-two">idea → conexión → comprensión</div>
        <div className="aside-center">
          <GitBranch size={37} />
          <p>
            Tu aprendizaje
            <br />
            <strong>toma forma</strong>
          </p>
        </div>
      </div>
    </main>
  )
}
