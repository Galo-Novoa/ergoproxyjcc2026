'use client'

import { useEffect, useId, useRef, useState } from 'react'

/**
 * Vista previa de un diagrama Mermaid. El render se hace en el cliente con la
 * librería `mermaid` (importada de forma diferida). El código fuente sigue siendo
 * del modelo/persona: acá solo se muestra, nunca se ejecuta otra cosa que no sea
 * Mermaid con `securityLevel: 'strict'`.
 */
export function MermaidDiagram({ source }: { source: string }) {
  const reactId = useId()
  const containerId = `mermaid-${reactId.replace(/[^a-zA-Z0-9]/g, '')}`
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function render() {
      try {
        const mermaid = (await import('mermaid')).default
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral' })
        const { svg } = await mermaid.render(containerId, source)
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg
          setError(null)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudo dibujar el diagrama.')
      }
    }
    render()
    return () => {
      cancelled = true
    }
  }, [source, containerId])

  if (error) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
        No se pudo dibujar el diagrama: {error}
      </div>
    )
  }
  return <div ref={ref} className="overflow-x-auto rounded-md border bg-background p-3 [&_svg]:mx-auto" />
}
