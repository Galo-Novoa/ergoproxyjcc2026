import { createHash } from 'node:crypto'
import type { ToolName } from '@/lib/tools/config'

/**
 * Firma estable de una llamada a herramienta (tool + args canónicos). Módulo PURO:
 * sirve para no repetir la misma llamada por reintentos y para auditar en `ToolCall`.
 */

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`
}

/** Firma estable de una llamada: mismo tool + mismos args ⇒ misma firma. */
export function callSignature(tool: ToolName, args: unknown): string {
  const canonical = stableStringify(args)
  return createHash('sha1').update(`${tool}:${canonical}`).digest('hex')
}
