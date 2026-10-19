export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024
export const MAX_PDF_PAGES = 800
// Un PDF "con texto" necesita al menos esto en alguna página; por debajo se considera escaneado.
export const MIN_PAGE_TEXT_CHARS = 20
// Una carga que lleva más de esto en 'uploading' se muestra como incompleta.
export const STALE_UPLOAD_MS = 15 * 60 * 1000
// Un procesamiento que lleva más de esto se puede reintentar a mano.
export const STALE_PROCESSING_MS = 2 * 60 * 1000

export type FileStatus = 'uploading' | 'processing' | 'ready' | 'needs_ocr' | 'failed'
export type FileKind = 'theory' | 'practice'

export const FILE_STATUS_LABEL: Record<FileStatus, string> = {
  uploading: 'Subiendo',
  processing: 'Procesando',
  ready: 'Listo',
  needs_ocr: 'Sin texto (escaneado)',
  failed: 'Error',
}

export const FILE_KIND_LABEL: Record<FileKind, string> = {
  theory: 'Teoría',
  practice: 'Práctica',
}

export function isFileKind(value: unknown): value is FileKind {
  return value === 'theory' || value === 'practice'
}

export function filePathnameFor(fileId: string) {
  return `files/${fileId}.pdf`
}

export const FILE_PATHNAME_PATTERN =
  /^files\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.pdf$/i

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
