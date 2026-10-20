import {
  MERMAID_DIAGRAM_TYPES,
  MERMAID_SOURCE_MAX,
  type MermaidDiagramType,
} from '@/lib/tools/config'

/**
 * Validación defensiva del código Mermaid. NO pretendemos un parser completo: nos
 * alcanza con asegurar que (a) el diagrama empieza con un tipo conocido, (b) no
 * contiene construcciones peligrosas (etiquetas HTML, directivas `%%{}`, links con
 * `javascript:`) y (c) tiene un tamaño razonable. Módulo PURO.
 */

const FIRST_TOKEN = /^\s*([A-Za-z][A-Za-z-]*)/
const DANGEROUS = [
  /<script/i,
  /<iframe/i,
  /javascript:/i,
  /data:text\/html/i,
  /%%\{/i, // directivas de configuración de Mermaid (init)
  /click\s+\w+\s+(href|call)/i, // interacciones con click
  /securityLevel/i,
]

export type MermaidValidation =
  | { ok: true; type: MermaidDiagramType; source: string }
  | { ok: false; error: string }

const TYPE_ALIASES: Record<string, MermaidDiagramType> = {
  graph: 'flowchart',
  flowcharts: 'flowchart',
  'sequence': 'sequenceDiagram',
}

export function validateMermaid(source: string): MermaidValidation {
  const trimmed = source.trim()
  if (!trimmed) return { ok: false, error: 'El diagrama está vacío.' }
  if (trimmed.length > MERMAID_SOURCE_MAX) {
    return { ok: false, error: 'El diagrama es demasiado largo.' }
  }
  const match = FIRST_TOKEN.exec(trimmed)
  if (!match) return { ok: false, error: 'El diagrama no empieza con un tipo válido.' }
  const head = match[1]
  const resolved = TYPE_ALIASES[head] ?? (head as MermaidDiagramType)
  if (!(MERMAID_DIAGRAM_TYPES as readonly string[]).includes(resolved)) {
    return {
      ok: false,
      error: `Tipo de diagrama no soportado: ${head}.`,
    }
  }
  for (const pattern of DANGEROUS) {
    if (pattern.test(trimmed)) {
      return { ok: false, error: 'El diagrama contiene una instrucción no permitida.' }
    }
  }
  return { ok: true, type: resolved, source: trimmed }
}
