/**
 * Formatos y límites del material de estudio.
 *
 * Este módulo es compartido: lo usan el cliente (para el input y los carteles) y
 * el servidor. La extracción de texto, que sí es solo de servidor, vive en
 * lib/files/extract.ts.
 */

export const MAX_FILE_BYTES = 10 * 1024 * 1024

export const SUPPORTED_TYPES = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'text/plain': 'TXT',
  'text/markdown': 'MD',
} as const

export type SupportedMime = keyof typeof SUPPORTED_TYPES

/** El navegador no siempre manda un mime útil, así que la extensión decide en ese caso. */
export function resolveMime(name: string, reported: string): SupportedMime | null {
  if (reported in SUPPORTED_TYPES) return reported as SupportedMime
  const extension = name.toLowerCase().split('.').pop() ?? ''
  if (extension === 'pdf') return 'application/pdf'
  if (extension === 'docx') {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }
  if (extension === 'txt') return 'text/plain'
  if (extension === 'md' || extension === 'markdown') return 'text/markdown'
  return null
}

/** Tope de texto por archivo, para no llenar la base con un PDF gigante. */
export const MAX_TEXT_CHARS = 400_000

/**
 * Saca lo que Postgres no puede guardar en una columna `text`.
 *
 * pdf.js y mammoth devuelven texto con bytes NUL y otros controles, y una
 * columna text los rechaza con «invalid byte sequence for encoding UTF8: 0x00».
 * Los surrogates sueltos rompen igual la codificación al guardar.
 */
export function sanitizeText(text: string) {
  return text
    .replace(/\u0000/g, '')
    // Resto de los controles C0 y el DEL. Se conservan \n y \t.
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
    .replace(/(^|[^\uD800-\uDBFF])([\uDC00-\uDFFF])/g, '$1')
}

/** Espacios de más y saltos repetidos: el texto crudo de un PDF viene muy sucio. */
export function normalizeText(text: string) {
  return sanitizeText(text)
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_TEXT_CHARS)
}
