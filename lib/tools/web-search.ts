import 'server-only'

import { webSearchSchema, type WebSearchArgs } from '@/lib/tools/schema'

/**
 * Búsqueda web con proveedor configurable (opt-in).
 *
 * Si no hay proveedor configurado, la herramienta NO se ejecuta: devuelve
 * `configured: false` y quien llama debe decirle al modelo que no busque y NO
 * afirmar que se buscó. Nunca inventamos resultados ni URLs.
 */

export type WebSearchResult = {
  title: string
  url: string
  snippet: string
}

export type WebSearchOutcome =
  | { configured: false; results: []; error: null }
  | { configured: true; results: WebSearchResult[]; error: string | null }

type Provider = 'tavily' | 'brave' | 'none'

export function webSearchProvider(): Provider {
  if (process.env.TAVILY_API_KEY?.trim()) return 'tavily'
  if (process.env.BRAVE_SEARCH_API_KEY?.trim()) return 'brave'
  return 'none'
}

export function isWebSearchConfigured() {
  return webSearchProvider() !== 'none'
}

/** Solo aceptamos URLs http(s) públicas: descartamos esquemas internos o peligrosos. */
function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}

function clip(text: unknown, max = 400): string {
  if (typeof text !== 'string') return ''
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max)}…` : clean
}

async function tavily(args: WebSearchArgs): Promise<WebSearchResult[]> {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
    },
    body: JSON.stringify({
      query: args.query,
      max_results: args.limit,
      search_depth: 'basic',
      include_answer: false,
    }),
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) throw new Error(`Tavily HTTP ${response.status}`)
  const data = (await response.json()) as { results?: unknown }
  const rows = Array.isArray(data.results) ? data.results : []
  return rows.flatMap((row): WebSearchResult[] => {
    if (!row || typeof row !== 'object') return []
    const r = row as Record<string, unknown>
    const url = safeUrl(r.url)
    if (!url) return []
    return [{ title: clip(r.title, 160) || url, url, snippet: clip(r.content) }]
  })
}

async function brave(args: WebSearchArgs): Promise<WebSearchResult[]> {
  const url = new URL('https://api.search.brave.com/res/v1/web/search')
  url.searchParams.set('q', args.query)
  url.searchParams.set('count', String(args.limit))
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY ?? '',
    },
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) throw new Error(`Brave HTTP ${response.status}`)
  const data = (await response.json()) as { web?: { results?: unknown } }
  const rows = Array.isArray(data.web?.results) ? data.web!.results! : []
  return rows.flatMap((row): WebSearchResult[] => {
    if (!row || typeof row !== 'object') return []
    const r = row as Record<string, unknown>
    const safe = safeUrl(r.url)
    if (!safe) return []
    return [{ title: clip(r.title, 160) || safe, url: safe, snippet: clip(r.description) }]
  })
}

/**
 * Ejecuta una búsqueda web. Valida los argumentos con zod antes de llamar al
 * proveedor. Nunca lanza: los errores se devuelven en `error`.
 */
export async function runWebSearch(rawArgs: unknown): Promise<WebSearchOutcome> {
  const parsed = webSearchSchema.safeParse(rawArgs)
  if (!parsed.success) {
    return { configured: true, results: [], error: 'Argumentos de búsqueda inválidos.' }
  }
  const args: WebSearchArgs = parsed.data
  const provider = webSearchProvider()
  if (provider === 'none') return { configured: false, results: [], error: null }
  try {
    const results = provider === 'tavily' ? await tavily(args) : await brave(args)
    return { configured: true, results: results.slice(0, args.limit), error: null }
  } catch (error) {
    return {
      configured: true,
      results: [],
      error: error instanceof Error ? error.message : 'Falló la búsqueda web.',
    }
  }
}
