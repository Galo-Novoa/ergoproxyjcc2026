import type { Metadata, Viewport } from 'next'
import { Geist, Source_Serif_4 } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const sans = Geist({
  subsets: ['latin'],
  variable: '--font-sans-family',
  display: 'swap',
})

const serif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-serif-family',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Landscape — Estudio activo para la FCEIA',
    template: '%s · Landscape',
  },
  description:
    'Convertí tus materiales de estudio en una experiencia activa: materias, archivos, conversaciones, mapa de dudas y documentos en un solo lugar. Para estudiantes de la FCEIA (UNR).',
}

export const viewport: Viewport = {
  themeColor: '#f6f8fb',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={`${sans.variable} ${serif.variable} bg-background`}>
      <body>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
