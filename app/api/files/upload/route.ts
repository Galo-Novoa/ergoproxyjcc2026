import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse, type NextRequest } from 'next/server'
import { writeScope } from '@/lib/authz'
import { db } from '@/lib/db'
import { FILE_PATHNAME_PATTERN, MAX_FILE_SIZE_BYTES } from '@/lib/files/constants'
import { getUserId } from '@/lib/session'

export async function POST(request: NextRequest) {
  let userId: string
  try {
    userId = await getUserId()
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = (await request.json()) as HandleUploadBody

  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // El nombre en Blob es files/<id>.pdf, con el id de un registro creado antes por createFileRecord.
        const match = FILE_PATHNAME_PATTERN.exec(pathname)
        if (!match) throw new Error('Ruta de archivo inválida.')

        const scope = await writeScope(userId)
        const file = await db.file.findFirst({
          where: { AND: [scope, { id: match[1], status: 'uploading' }] },
          select: { id: true },
        })
        if (!file) throw new Error('No encontramos el archivo a subir.')

        return {
          allowedContentTypes: ['application/pdf'],
          maximumSizeInBytes: MAX_FILE_SIZE_BYTES,
          addRandomSuffix: false,
          allowOverwrite: true,
        }
      },
    })
    return NextResponse.json(json)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo iniciar la subida.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
