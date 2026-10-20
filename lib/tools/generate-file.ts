import 'server-only'

import { put } from '@vercel/blob'
import { db } from '@/lib/db'
import {
  GENERATED_FILE_MAX_BYTES,
  type GeneratedFileFormat,
} from '@/lib/tools/config'
import { prepareGeneratedFile, storageKeyFor } from '@/lib/tools/file-builder'

/**
 * Materializa un archivo generado: valida el contenido, lo sube a Vercel Blob como
 * privado y registra el `GeneratedFile`. Devuelve el registro real (con su id), no un
 * enlace ficticio. Si Blob no está configurado, el archivo se guarda con su contenido
 * en la base y se marca el error para que la UI lo informe.
 */

export type MaterializeInput = {
  userId: string
  conversationId: string | null
  messageId: string | null
  name: string
  format: GeneratedFileFormat
  content: string
}

export type MaterializeResult =
  | { ok: true; file: { id: string; name: string; format: string; sizeBytes: number; stored: boolean } }
  | { ok: false; error: string }

export async function materializeGeneratedFile(input: MaterializeInput): Promise<MaterializeResult> {
  const prepared = prepareGeneratedFile(input.name, input.format, input.content)
  if (!prepared.ok) return { ok: false, error: prepared.error }

  const record = await db.generatedFile.create({
    data: {
      userId: input.userId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      name: prepared.name,
      format: prepared.format,
      mimeType: prepared.mime,
      sizeBytes: prepared.bytes,
      content: prepared.content,
      status: 'ready',
    },
    select: { id: true },
  })

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    // Sin Blob igual existe el archivo real (en la base): la descarga lo sirve desde ahí.
    await db.generatedFile.update({
      where: { id: record.id },
      data: { status: 'ready', errorMessage: 'Sin almacenamiento externo: el archivo se sirve desde la base.' },
    })
    return {
      ok: true,
      file: { id: record.id, name: prepared.name, format: prepared.format, sizeBytes: prepared.bytes, stored: false },
    }
  }

  try {
    const pathname = `generated/${input.userId}/${record.id}-${storageKeyFor(prepared.name)}`
    const blob = await put(pathname, prepared.content, {
      access: 'private',
      contentType: prepared.mime,
      addRandomSuffix: false,
      allowOverwrite: true,
    })
    await db.generatedFile.update({
      where: { id: record.id },
      data: { storagePath: blob.pathname, storageUrl: blob.url, errorMessage: null },
    })
    return {
      ok: true,
      file: { id: record.id, name: prepared.name, format: prepared.format, sizeBytes: prepared.bytes, stored: true },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo guardar el archivo.'
    console.error('[tools] no se pudo subir el archivo generado:', message)
    await db.generatedFile.update({
      where: { id: record.id },
      data: { status: 'ready', errorMessage: 'El archivo se generó, pero no se pudo subir al almacenamiento; se sirve desde la base.' },
    })
    return {
      ok: true,
      file: { id: record.id, name: prepared.name, format: prepared.format, sizeBytes: prepared.bytes, stored: false },
    }
  }
}

/** Cuenta cuánto ocupa el usuario en archivos generados (por si hace falta límite). */
export async function generatedFilesBytes(userId: string): Promise<number> {
  const rows = await db.generatedFile.findMany({ where: { userId }, select: { sizeBytes: true } })
  return rows.reduce((sum, row) => sum + row.sizeBytes, 0)
}

export { GENERATED_FILE_MAX_BYTES }
