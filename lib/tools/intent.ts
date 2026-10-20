import { FOLDER_QUERY_MAX } from '@/lib/tools/config'

/**
 * Detección de necesidades de herramientas a partir del texto del usuario. Módulo
 * PURO y explicable: no reemplaza la decisión del modelo, evita ejecutar de más.
 * - Búsqueda web: solo si la persona la pide explícitamente.
 * - Archivo: solo si pide exportar/descargar/guardar un archivo.
 * - Diagrama: pista blanda; el modelo decide si aporta.
 */

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

const WEB_PATTERNS = [
  /\bbusc(a|á|ame|ar)\b.*\b(en )?(la )?(web|internet|google|online)\b/,
  /\b(en )?(la )?(web|internet|google|online)\b.*\bbusc(a|á|ame|ar)\b/,
  /\bgoogle(a|á|ame|ar)\b/,
  /\bmir(a|á) en internet\b/,
  /\bque dicen en internet\b/,
  /\bsearch the web\b/,
  /\bbusca fuentes\b/,
]

const FILE_PATTERNS = [
  /\b(descarga|descargar|export(a|á|ar)|gener(a|á|ar)|cre(a|á|ar)|hac(e|é|eme|er))\b.*\b(archivo|pdf|csv|markdown|md|txt|planilla|documento)\b/,
  /\b(archivo|pdf|csv|markdown|planilla)\b.*\b(descargable|para descargar|para guardar|exportable)\b/,
  /\bpas(a|á|ame|ar)(lo|melo|melo)? a (un )?(archivo|pdf|csv|markdown)\b/,
  /\bexport(a|á|ar)\b/,
]

const DIAGRAM_PATTERNS = [
  /\bdiagram(a|á|ame|ar|ita)\b/,
  /\bmermaid\b/,
  /\bflowchart\b/,
  /\bgrafo\b/,
  /\bmapa (conceptual|mental)\b/,
]

function matches(patterns: RegExp[], text: string) {
  return patterns.some((p) => p.test(text))
}

export type ToolNeeds = {
  web: boolean
  file: boolean
  diagram: boolean
  /** Consulta de búsqueda web, si aplica (se limpia el ruido de la petición). */
  webQuery: string | null
}

export function detectToolNeeds(text: string): ToolNeeds {
  const normalized = normalize(text)
  const web = matches(WEB_PATTERNS, normalized)
  return {
    web,
    file: matches(FILE_PATTERNS, normalized),
    diagram: matches(DIAGRAM_PATTERNS, normalized),
    webQuery: web ? text.trim().slice(0, FOLDER_QUERY_MAX) : null,
  }
}
