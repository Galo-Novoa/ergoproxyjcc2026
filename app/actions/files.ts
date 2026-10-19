'use server'

import { del, head } from '@vercel/blob'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { readScope, writeScope } from '@/lib/authz'
import { isUuid } from '@/lib/data/queries'
import { db } from '@/lib/db'
import { MAX_FILE_SIZE_BYTES, filePathnameFor } from '@/lib/files/constants'
import { indexFile } from '@/lib/rag/index-file'
import { demoModeBlock, getUserId } from '@/lib/session'
import type { ActionResult } from '@/lib/types'

const createSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'El archivo no tiene nombre.')
    .max(255, 'El nombre del archivo es demasiado largo.')
    .refine((value) => /\.pdf$/i.test(value), 'Solo se admiten archivos PDF.'),
  mimeType: z.literal('application/pdf', { error: 'Solo se admiten archivos PDF.' }),
  sizeBytes: z
    .number()
    .int()
    .min(1, 'El archivo está vacío.')
    .max(MAX_FILE_SIZE_BYTES, 'El archivo supera el máximo de 25 MB.'),
  subjectId: z.string(),
})

/** Paso 1: crea el registro en estado 'uploading' y devuelve la ruta donde el navegador sube a Blob. */
export async function createFileRecord(input: {
  name: string
  mimeType: string
  sizeBytes: number
  subjectId: string
}): Promise<ActionResult<{ id: string; pathname: string }>> {
  const blocked = demoModeBlock()
  if (blocked) return blocked
  const userId = await getUserId()

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return {
      ok: false,
      error: 'El almacenamiento no está configurado todavía (falta Vercel Blob).',
    }
  }

  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const { name, mimeType, sizeBytes, subjectId } = parsed.data

  let ownedSubjectId: string | null = null
  if (subjectId !== 'none') {
    if (!isUuid(subjectId)) return { ok: false, error: 'Materia inválida.' }
    const scope = await writeScope(userId)
    const subject = await db.subject.findFirst({
      where: { AND: [scope, { id: subjectId }] },
      select: { id: true },
    })
    if (!subject) return { ok: false, error: 'No encontramos la materia.' }
    ownedSubjectId = subject.id
  }

  // Los archivos nuevos son privados; compartirlos con una organización es una acción aparte.
  const file = await db.file.create({
    data: { userId, name, mimeType, sizeBytes, subjectId: ownedSubjectId, status: 'uploading' },
    select: { id: true },
  })
  return { ok: true, data: { id: file.id, pathname: filePathnameFor(file.id) } }
}

/** Paso 3: confirma que el binario llegó a Blob y deja el archivo listo para procesarse. */
export async function finalizeUpload(fileId: string): Promise<ActionResult> {
  const blocked = demoModeBlock()
  if (blocked) return blocked
  const userId = await getUserId()
  if (!isUuid(fileId)) return { ok: false, error: 'No encontramos el archivo.' }

  const scope = await writeScope(userId)
  const file = await db.file.findFirst({
    where: { AND: [scope, { id: fileId }] },
    select: { id: true, status: true },
  })
  if (!file) return { ok: false, error: 'No encontramos el archivo.' }
  if (file.status !== 'uploading') return { ok: true }

  const pathname = filePathnameFor(file.id)
  try {
    const blob = await head(pathname)
    if (blob.size > MAX_FILE_SIZE_BYTES) {
      await del(pathname)
      await db.file.update({
        where: { id: file.id },
        data: { status: 'failed', errorMessage: 'El archivo supera el máximo de 25 MB.' },
      })
      return { ok: false, error: 'El archivo supera el máximo de 25 MB.' }
    }
    await db.file.update({
      where: { id: file.id },
      data: {
        status: 'processing',
        storagePath: blob.pathname,
        storageUrl: blob.url,
        sizeBytes: blob.size,
        errorMessage: null,
      },
    })
  } catch (error) {
    console.error('[files] finalizeUpload failed', error)
    await db.file.update({
      where: { id: file.id },
      data: { status: 'failed', errorMessage: 'La carga no se completó. Volvé a intentarlo.' },
    })
    return { ok: false, error: 'La carga no se completó. Volvé a intentarlo.' }
  }

  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function setFileKind(
  fileId: string,
  kind: 'theory' | 'practice' | 'none',
): Promise<ActionResult> {
  const blocked = demoModeBlock()
  if (blocked) return blocked
  const userId = await getUserId()
  if (!isUuid(fileId)) return { ok: false, error: 'No encontramos el archivo.' }
  if (kind !== 'theory' && kind !== 'practice' && kind !== 'none') {
    return { ok: false, error: 'Tipo inválido.' }
  }

  const scope = await writeScope(userId)
  const { count } = await db.file.updateMany({
    where: { AND: [scope, { id: fileId }] },
    data:
      kind === 'none'
        ? { kind: null, kindSource: null, kindReason: null }
        : { kind, kindSource: 'manual', kindReason: null },
  })
  if (count === 0) return { ok: false, error: 'No encontramos el archivo.' }

  revalidatePath('/', 'layout')
  return { ok: true }
}

/** Indexa (o reindexa) un archivo listo para que el chat pueda recuperar fragmentos de él. */
export async function reindexFile(fileId: string): Promise<ActionResult> {
  const blocked = demoModeBlock()
  if (blocked) return blocked
  const userId = await getUserId()
  if (!isUuid(fileId)) return { ok: false, error: 'No encontramos el archivo.' }

  const scope = await writeScope(userId)
  const file = await db.file.findFirst({
    where: { AND: [scope, { id: fileId }] },
    select: { id: true, status: true },
  })
  if (!file) return { ok: false, error: 'No encontramos el archivo.' }
  if (file.status !== 'ready') {
    return { ok: false, error: 'El archivo todavía no tiene texto para indexar.' }
  }

  const result = await indexFile(file.id)
  revalidatePath('/', 'layout')
  return result.ok ? { ok: true } : { ok: false, error: result.error }
}

export async function deleteFile(fileId: string): Promise<ActionResult> {
  const blocked = demoModeBlock()
  if (blocked) return blocked
  const userId = await getUserId()
  if (!isUuid(fileId)) return { ok: false, error: 'No encontramos el archivo.' }

  const scope = await writeScope(userId)
  const file = await db.file.findFirst({
    where: { AND: [scope, { id: fileId }] },
    select: { id: true, storagePath: true },
  })
  if (!file) return { ok: false, error: 'No encontramos el archivo.' }

  try {
    await del(file.storagePath ?? filePathnameFor(file.id))
  } catch (error) {
    console.error('[files] blob delete failed', error)
    return { ok: false, error: 'No pudimos borrar el archivo del almacenamiento. Probá de nuevo.' }
  }

  // Las páginas extraídas se eliminan en cascada.
  await db.file.delete({ where: { id: file.id } })
  revalidatePath('/', 'layout')
  return { ok: true }
}

/** Páginas extraídas de un archivo, para citarlas por número. Solo lectura. */
export async function getFilePages(fileId: string) {
  const userId = await getUserId()
  if (!isUuid(fileId)) return []
  const scope = await readScope(userId)
  const file = await db.file.findFirst({
    where: { AND: [scope, { id: fileId }] },
    select: { id: true },
  })
  if (!file) return []
  return db.filePage.findMany({
    where: { fileId: file.id },
    orderBy: { pageNumber: 'asc' },
    select: { pageNumber: true, text: true },
  })
}
