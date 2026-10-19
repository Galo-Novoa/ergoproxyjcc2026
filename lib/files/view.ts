import { formatRelative } from '@/lib/format'
import {
  STALE_PROCESSING_MS,
  STALE_UPLOAD_MS,
  isFileKind,
  type FileKind,
  type FileStatus,
} from './constants'

export type FileItem = {
  id: string
  name: string
  sizeBytes: number
  status: FileStatus
  kind: FileKind | null
  kindIsAuto: boolean
  kindReason: string | null
  pageCount: number | null
  textPageCount: number | null
  errorMessage: string | null
  indexStatus: string
  indexError: string | null
  chunkCount: number
  subjectName: string | null
  createdLabel: string
  // Carga o procesamiento colgados: se ofrece reintentar o borrar.
  stale: boolean
}

type FileRow = {
  id: string
  name: string
  sizeBytes: number
  status: string
  kind: string | null
  kindSource: string | null
  kindReason: string | null
  pageCount: number | null
  textPageCount: number | null
  errorMessage: string | null
  indexStatus: string
  indexError: string | null
  chunkCount: number
  createdAt: Date
  processedAt: Date | null
  subjectName?: string | null
}

function asStatus(value: string): FileStatus {
  switch (value) {
    case 'uploading':
    case 'processing':
    case 'ready':
    case 'needs_ocr':
    case 'failed':
      return value
    default:
      return 'failed'
  }
}

export function toFileItem(row: FileRow, now: Date): FileItem {
  const status = asStatus(row.status)
  const age = now.getTime() - row.createdAt.getTime()
  const stale =
    (status === 'uploading' && age > STALE_UPLOAD_MS) ||
    (status === 'processing' && age > STALE_PROCESSING_MS)

  return {
    id: row.id,
    name: row.name,
    sizeBytes: row.sizeBytes,
    status,
    kind: isFileKind(row.kind) ? row.kind : null,
    kindIsAuto: row.kindSource === 'auto',
    kindReason: row.kindReason,
    pageCount: row.pageCount,
    textPageCount: row.textPageCount,
    errorMessage: row.errorMessage,
    indexStatus: row.indexStatus,
    indexError: row.indexError,
    chunkCount: row.chunkCount,
    subjectName: row.subjectName ?? null,
    createdLabel: formatRelative(row.createdAt, now),
    stale,
  }
}
