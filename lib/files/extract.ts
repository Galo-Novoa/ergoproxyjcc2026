import 'server-only'

import { normalizeText, type SupportedMime } from '@/lib/files/types'

/**
 * Extracción de texto del material de estudio.
 *
 * No se guarda el archivo original: lo que persiste es el texto, que es lo que
 * necesita el tutor para responder sobre el material (ver app/actions/files.ts).
 * Los formatos y límites están en lib/files/types.ts, que también usa el cliente.
 */

export class ExtractionError extends Error {}

export async function extractText(
  bytes: ArrayBuffer,
  mime: SupportedMime,
): Promise<{ text: string; pages: number | null }> {
  try {
    if (mime === 'application/pdf') {
      // unpdf trae su propio build de pdf.js, sin binarios del sistema.
      const { extractText: extractPdfText, getDocumentProxy } = await import('unpdf')
      const pdf = await getDocumentProxy(new Uint8Array(bytes))
      const { text, totalPages } = await extractPdfText(pdf, { mergePages: true })
      return { text: normalizeText(text), pages: totalPages }
    }

    if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const mammoth = await import('mammoth')
      const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) })
      return { text: normalizeText(value), pages: null }
    }

    return { text: normalizeText(new TextDecoder().decode(bytes)), pages: null }
  } catch {
    throw new ExtractionError(
      'No pudimos leer el texto de este archivo. Puede estar dañado o ser un PDF escaneado sin texto.',
    )
  }
}
