import 'server-only'
import { get } from '@vercel/blob'
import { writeScope } from '@/lib/authz'
import { db } from '@/lib/db'
import { indexFile } from '@/lib/rag/index-file'
import { classifyDocument } from './classify'
import {
  MAX_FILE_SIZE_BYTES,
  MAX_PDF_PAGES,
  MIN_PAGE_TEXT_CHARS,
  filePathnameFor,
} from './constants'
import { PdfError, extractPdfPages } from './extract'

export type ProcessResult =
  | { ok: true; status: 'ready' | 'needs_ocr' }
  | { ok: false; error: string }

async function readBlobBytes(pathname: string): Promise<Uint8Array> {
  const result = await get(pathname, { access: 'private', useCache: false })
  if (!result || result.statusCode !== 200) {
    throw new PdfError('No encontramos el archivo subido. Volvé a subirlo.')
  }

  const chunks: Uint8Array[] = []
  let received = 0
  const reader = result.stream.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    received += value.byteLength
    if (received > MAX_FILE_SIZE_BYTES) {
      await reader.cancel()
      throw new PdfError('El archivo supera el tamaño máximo permitido.')
    }
    chunks.push(value)
  }

  const bytes = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

function hasPdfHeader(bytes: Uint8Array) {
  // La firma puede estar precedida por algo de basura dentro del primer KB.
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 1024))
  return head.includes('%PDF-')
}

/**
 * Lee el PDF desde Blob, guarda el texto por página y sugiere teoría/práctica.
 * Es idempotente: reprocesar reemplaza las páginas anteriores. Nunca inventa
 * contenido: un PDF sin capa de texto queda como `needs_ocr`.
 */
export async function processFile(fileId: string, userId: string): Promise<ProcessResult> {
  const scope = await writeScope(userId)
  const file = await db.file.findFirst({
    where: { AND: [scope, { id: fileId }] },
    select: { id: true, name: true, status: true, storagePath: true, kindSource: true },
  })
  if (!file) return { ok: false, error: 'No encontramos el archivo.' }
  if (file.status === 'uploading') {
    return { ok: false, error: 'La carga del archivo todavía no terminó.' }
  }
  if (file.status === 'ready' || file.status === 'needs_ocr') {
    return { ok: true, status: file.status }
  }

  await db.file.updateMany({
    where: { id: file.id },
    data: { status: 'processing', errorMessage: null },
  })

  try {
    const bytes = await readBlobBytes(file.storagePath ?? filePathnameFor(file.id))
    if (!hasPdfHeader(bytes)) {
      throw new PdfError('El archivo no es un PDF válido.')
    }

    const { pageCount, pages } = await extractPdfPages(bytes, MAX_PDF_PAGES)
    const pagesWithText = pages
      .map((text, index) => ({ text, pageNumber: index + 1 }))
      .filter((page) => page.text.length >= MIN_PAGE_TEXT_CHARS)

    if (pagesWithText.length === 0) {
      await db.$transaction([
        db.filePage.deleteMany({ where: { fileId: file.id } }),
        db.file.update({
          where: { id: file.id },
          data: {
            status: 'needs_ocr',
            pageCount,
            textPageCount: 0,
            errorMessage: null,
            processedAt: new Date(),
          },
        }),
      ])
      return { ok: true, status: 'needs_ocr' }
    }

    // Si la persona ya eligió el tipo a mano, no se pisa con la sugerencia.
    const suggestion =
      file.kindSource === 'manual'
        ? null
        : classifyDocument(
            file.name,
            pagesWithText.map((page) => page.text),
          )

    await db.$transaction([
      db.filePage.deleteMany({ where: { fileId: file.id } }),
      db.filePage.createMany({
        data: pagesWithText.map((page) => ({
          fileId: file.id,
          userId,
          pageNumber: page.pageNumber,
          text: page.text,
        })),
      }),
      db.file.update({
        where: { id: file.id },
        data: {
          status: 'ready',
          pageCount,
          textPageCount: pagesWithText.length,
          errorMessage: null,
          processedAt: new Date(),
          ...(suggestion
            ? {
                kind: suggestion.kind,
                kindSource: suggestion.kind ? 'auto' : null,
                kindReason: suggestion.reason,
              }
            : {}),
        },
      }),
    ])
    // Un fallo al indexar no invalida el archivo: queda registrado en indexStatus y se reintenta a mano.
    await indexFile(file.id)
    return { ok: true, status: 'ready' }
  } catch (error) {
    const message =
      error instanceof PdfError ? error.message : 'Ocurrió un error al procesar el archivo.'
    if (!(error instanceof PdfError)) console.error('[files] processFile failed', error)
    // Solo marca error si nadie más terminó el procesamiento mientras tanto.
    await db.file.updateMany({
      where: { id: file.id, status: 'processing' },
      data: { status: 'failed', errorMessage: message },
    })
    return { ok: false, error: message }
  }
}
