import { NextResponse, type NextRequest } from 'next/server'
import { isUuid } from '@/lib/data/queries'
import { processFile } from '@/lib/files/process'
import { getUserId } from '@/lib/session'

export const maxDuration = 60

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let userId: string
  try {
    userId = await getUserId()
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Archivo inválido.' }, { status: 400 })

  const result = await processFile(id, userId)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 })
  return NextResponse.json({ status: result.status })
}
