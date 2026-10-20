'use server'

import { revalidatePath } from 'next/cache'
import { readScope, writeScope } from '@/lib/authz'
import { isUuid } from '@/lib/data/queries'
import { db } from '@/lib/db'
import { isDatabaseConfigured } from '@/lib/db/config'
import { ExtractionError, extractText } from '@/lib/files/extract'
import { MAX_FILE_BYTES, resolveMime, SUPPORTED_TYPES } from '@/lib/files/types'
import { getUserId } from '@/lib/session'
import type { ActionResult } from '@/lib/types'

const DEMO_ERROR = 'Para subir material hace falta una base de datos conectada.'

/**
 * Sube material de estudio.
 *
 * No se guarda el archivo original: se extrae el texto y se guarda como Document
 * con kind 'source', apuntando a la fila de File con los metadatos. Eso es lo que
 * después lee el tutor para responder sobre el material, y evita depender de un
 * servicio de almacenamiento.
 */
export async function uploadFile(
  subjectId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string; chars: number }>> {
  if (!isDatabaseConfigured) return { ok: false, error: DEMO_ERROR }
  const userId = await getUserId()

  if (!isUuid(subjectId)) return { ok: false, error: 'Materia inválida.' }
  const scope = await writeScope(userId)
  const subject = await db.subject.findFirst({
    where: { AND: [scope, { id: subjectId }] },
    select: { id: true },
  })
  if (!subject) return { ok: false, error: 'No encontramos la materia.' }

  const entry = formData.get('file')
  if (!(entry instanceof File) || entry.size === 0) {
    return { ok: false, error: 'Elegí un archivo.' }
  }
  if (entry.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      error: `El archivo supera los ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB.`,
    }
  }

  const mime = resolveMime(entry.name, entry.type)
  if (!mime) {
    return {
      ok: false,
      error: `Formato no soportado. Por ahora: ${Object.values(SUPPORTED_TYPES).join(', ')}.`,
    }
  }

  let text: string
  try {
    const extracted = await extractText(await entry.arrayBuffer(), mime)
    text = extracted.text
  } catch (error) {
    if (error instanceof ExtractionError) return { ok: false, error: error.message }
    return { ok: false, error: 'No pudimos procesar el archivo. Probá de nuevo.' }
  }

  if (!text) {
    return {
      ok: false,
      error: 'El archivo no tiene texto que podamos leer (puede ser un PDF escaneado).',
    }
  }

  // El archivo y su texto se guardan juntos o no se guarda nada.
  let fileId: string
  try {
    fileId = await db.$transaction(async (tx) => {
      const file = await tx.file.create({
        data: {
          userId,
          subjectId: subject.id,
          name: entry.name,
          mimeType: mime,
          sizeBytes: entry.size,
          status: 'ready',
        },
        select: { id: true },
      })
      await tx.document.create({
        data: {
          userId,
          subjectId: subject.id,
          sourceFileId: file.id,
          title: entry.name,
          kind: 'source',
          contentMd: text,
        },
      })
      return file.id
    })
  } catch {
    return { ok: false, error: 'No pudimos guardar el archivo. Probá de nuevo.' }
  }

  revalidatePath('/', 'layout')
  return { ok: true, data: { id: fileId, chars: text.length } }
}

export async function deleteFile(id: string): Promise<ActionResult> {
  if (!isDatabaseConfigured) return { ok: false, error: DEMO_ERROR }
  const userId = await getUserId()
  if (!isUuid(id)) return { ok: false, error: 'No encontramos el archivo.' }

  const scope = await writeScope(userId)
  const file = await db.file.findFirst({
    where: { AND: [scope, { id }] },
    select: { id: true },
  })
  if (!file) return { ok: false, error: 'No encontramos el archivo.' }

  // El texto extraído se va con el archivo: no tiene sentido sin su origen.
  await db.$transaction(async (tx) => {
    await tx.document.deleteMany({ where: { userId, sourceFileId: file.id, kind: 'source' } })
    await tx.file.deleteMany({ where: { id: file.id, userId } })
  })

  revalidatePath('/', 'layout')
  return { ok: true }
}

/** Texto extraído de un archivo, para leerlo en la pestaña Archivos. */
export async function getFileText(
  id: string,
): Promise<ActionResult<{ title: string; text: string }>> {
  if (!isDatabaseConfigured) return { ok: false, error: DEMO_ERROR }
  const userId = await getUserId()
  if (!isUuid(id)) return { ok: false, error: 'No encontramos el archivo.' }

  const scope = await readScope(userId)
  const document = await db.document.findFirst({
    where: { AND: [scope, { sourceFileId: id, kind: 'source' }] },
    select: { title: true, contentMd: true },
  })
  if (!document) return { ok: false, error: 'No encontramos el texto de este archivo.' }

  return { ok: true, data: { title: document.title, text: document.contentMd } }
}
