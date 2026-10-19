import 'server-only'
import { extractText, getDocumentProxy } from 'unpdf'

export type ExtractedPdf = {
  pageCount: number
  // Texto limpio por página, en el mismo orden del PDF (índice 0 = página 1).
  pages: string[]
}

export class PdfError extends Error {}

function cleanPageText(raw: string) {
  return raw
    .replace(/\u0000/g, '')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function describePdfFailure(error: unknown) {
  const name = error instanceof Error ? error.name : ''
  if (name === 'PasswordException') {
    return 'El PDF está protegido con contraseña. Quitale la protección y volvé a subirlo.'
  }
  if (name === 'InvalidPDFException' || name === 'FormatError') {
    return 'El archivo está dañado o no es un PDF válido.'
  }
  return 'No pudimos leer el PDF.'
}

export async function extractPdfPages(bytes: Uint8Array, maxPages: number): Promise<ExtractedPdf> {
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>>
  try {
    pdf = await getDocumentProxy(bytes)
  } catch (error) {
    throw new PdfError(describePdfFailure(error))
  }

  if (pdf.numPages > maxPages) {
    throw new PdfError(`El PDF tiene ${pdf.numPages} páginas; el máximo admitido es ${maxPages}.`)
  }

  try {
    const { totalPages, text } = await extractText(pdf, { mergePages: false })
    return { pageCount: totalPages, pages: text.map(cleanPageText) }
  } catch (error) {
    throw new PdfError(describePdfFailure(error))
  }
}
