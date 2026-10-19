import { get } from '@vercel/blob'
import { NextResponse, type NextRequest } from 'next/server'
import { readScope } from '@/lib/authz'
import { isUuid } from '@/lib/data/queries'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/session'

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

  const scope = await readScope(userId)
  const file = await db.file.findFirst({
    where: { AND: [scope, { id }] },
    select: { name: true, storagePath: true },
  })
  if (!file?.storagePath) return new NextResponse('No encontrado', { status: 404 })

  try {
    const result = await get(file.storagePath, {
      access: 'private',
      ifNoneMatch: request.headers.get('if-none-match') ?? undefined,
    })
    if (!result) return new NextResponse('No encontrado', { status: 404 })

    if (result.statusCode === 304) {
      return new NextResponse(null, {
        status: 304,
        headers: { ETag: result.blob.etag, 'Cache-Control': 'private, no-cache' },
      })
    }

    const download = request.nextUrl.searchParams.get('download') === '1'
    const disposition = download ? 'attachment' : 'inline'
    return new NextResponse(result.stream, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        ETag: result.blob.etag,
        'Cache-Control': 'private, no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('[files] download failed', error)
    return NextResponse.json({ error: 'No se pudo leer el archivo.' }, { status: 500 })
  }
}
