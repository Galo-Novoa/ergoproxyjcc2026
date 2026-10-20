import { get } from '@vercel/blob'
import { NextResponse, type NextRequest } from 'next/server'
import { isUuid } from '@/lib/data/queries'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/session'

/**
 * Descarga de un archivo generado. Es siempre privado: solo lo ve su dueño. Si el
 * blob existe se sirve el stream real; si no (sin Blob configurado) se sirve el
 * contenido guardado en la base. Nunca se devuelve un enlace ficticio.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let userId: string
  try {
    userId = await getUserId()
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params
  if (!isUuid(id)) return new NextResponse('No encontrado', { status: 404 })

  const file = await db.generatedFile.findFirst({
    where: { id, userId },
    select: { name: true, mimeType: true, storagePath: true, content: true },
  })
  if (!file) return new NextResponse('No encontrado', { status: 404 })

  const download = request.nextUrl.searchParams.get('download') === '1'
  const disposition = download ? 'attachment' : 'inline'
  const headers = {
    'Content-Type': file.mimeType,
    'Content-Disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    'Cache-Control': 'private, no-cache',
    'X-Content-Type-Options': 'nosniff',
  }

  if (file.storagePath) {
    try {
      const result = await get(file.storagePath, {
        access: 'private',
        ifNoneMatch: request.headers.get('if-none-match') ?? undefined,
      })
      if (result) {
        if (result.statusCode === 304) {
          return new NextResponse(null, {
            status: 304,
            headers: { ETag: result.blob.etag, 'Cache-Control': 'private, no-cache' },
          })
        }
        return new NextResponse(result.stream, {
          headers: { ...headers, ETag: result.blob.etag },
        })
      }
    } catch (error) {
      console.error('[generated-files] falló la lectura del blob, se sirve desde la base', error)
    }
  }

  if (file.content === null) return new NextResponse('No encontrado', { status: 404 })
  return new NextResponse(file.content, { headers })
}
