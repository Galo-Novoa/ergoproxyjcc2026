import {
  GENERATED_FILE_FORMATS,
  GENERATED_FILE_MAX_BYTES,
  GENERATED_FILE_MIME,
  GENERATED_FILE_NAME_MAX,
  type GeneratedFileFormat,
} from '@/lib/tools/config'

/**
 * Prepara el contenido de un archivo generado. Módulo PURO: normaliza el nombre,
 * garantiza la extensión correcta, controla el tamaño y devuelve el MIME y el
 * contenido final que se subirá tal cual (nunca un enlace ficticio).
 */

const BAD_NAME = /[\\/:*?"<>|\u0000-\u001f]/g

export type PreparedFile =
  | { ok: true; name: string; format: GeneratedFileFormat; mime: string; content: string; bytes: number }
  | { ok: false; error: string }

function extensionFor(format: GeneratedFileFormat) {
  return `.${format}`
}

/** Quita cualquier extensión propia o ajena para reponer la correcta. */
function baseName(name: string) {
  const cleaned = name.trim().replace(BAD_NAME, '-').replace(/\s+/g, ' ').trim()
  for (const format of GENERATED_FILE_FORMATS) {
    const suffix = extensionFor(format)
    if (cleaned.toLowerCase().endsWith(suffix)) {
      return cleaned.slice(0, cleaned.length - suffix.length).trim()
    }
  }
  return cleaned
}

function normalizeNewlines(content: string) {
  return content.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trimEnd()
}

export function prepareGeneratedFile(
  rawName: string,
  format: GeneratedFileFormat,
  rawContent: string,
): PreparedFile {
  const content = normalizeNewlines(rawContent)
  if (!content.trim()) return { ok: false, error: 'El archivo no tiene contenido.' }

  const base = baseName(rawName) || 'apunte'
  const name = `${base.slice(0, GENERATED_FILE_NAME_MAX - 4).trim()}${extensionFor(format)}`

  const bytes = new TextEncoder().encode(content).length
  if (bytes > GENERATED_FILE_MAX_BYTES) {
    return { ok: false, error: 'El archivo generado es demasiado grande.' }
  }

  return { ok: true, name, format, mime: GENERATED_FILE_MIME[format], content, bytes }
}

/** Nombre seguro para la ruta del blob (sin separadores ni espacios problemáticos). */
export function storageKeyFor(fileName: string) {
  const safe = fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
  return safe || 'archivo.txt'
}
