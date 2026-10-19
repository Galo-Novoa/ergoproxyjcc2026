import { FileText, Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { GROUNDING_LABEL, type Grounding, type RagMetadata, type RagSource } from '@/lib/rag/types'

const GROUNDING_VARIANT: Record<Grounding, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  documents: 'default',
  mixed: 'secondary',
  general: 'outline',
  insufficient: 'destructive',
}

function scopeLabel(rag: RagMetadata) {
  if (rag.scope === 'selected' && rag.scopeFileNames.length) {
    return `Buscado en: ${rag.scopeFileNames.join(', ')}`
  }
  if (rag.scope === 'mention' && rag.scopeFileNames.length) {
    return `Buscado en el archivo que nombraste: ${rag.scopeFileNames.join(', ')}`
  }
  return rag.workspaceName ? `Buscado en: ${rag.workspaceName}` : 'Buscado en todos tus documentos'
}

function statusNotes(rag: RagMetadata) {
  const notes: string[] = []
  if (rag.status === 'no_sources') notes.push('No hay documentos indexados para consultar.')
  if (rag.status === 'no_match') {
    notes.push('Había documentos, pero ningún fragmento resultó relevante para esta pregunta.')
  }
  if (rag.status === 'unavailable') {
    notes.push(rag.note ?? 'La búsqueda en tus documentos no está disponible ahora.')
  }
  if (rag.unindexedFiles > 0) {
    notes.push(
      `${rag.unindexedFiles} ${rag.unindexedFiles === 1 ? 'archivo todavía no está indexado' : 'archivos todavía no están indexados'} y no se consultaron.`,
    )
  }
  if (rag.invalidCitations > 0) {
    notes.push(
      `Se descartaron ${rag.invalidCitations} ${rag.invalidCitations === 1 ? 'cita' : 'citas'} que no coincidían con ningún fragmento recuperado.`,
    )
  }
  return notes
}

function SourceItem({ source, anchorId }: { source: RagSource; anchorId: string }) {
  return (
    <li id={anchorId} className="scroll-mt-24 rounded-lg border bg-background p-2 text-xs target:ring-2 target:ring-primary">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Badge variant="secondary">F{source.ref}</Badge>
        <a
          href={`/api/files/${source.fileId}/download#page=${source.pageNumber}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-w-0 items-center gap-1 font-medium text-primary underline underline-offset-2"
        >
          <FileText className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{source.fileName}</span>
        </a>
        <span className="text-muted-foreground">página {source.pageNumber}</span>
      </div>
      <details className="mt-1.5">
        <summary className="cursor-pointer text-muted-foreground">Ver fragmento</summary>
        <p className="mt-1 whitespace-pre-wrap text-pretty text-muted-foreground">{source.text}</p>
      </details>
    </li>
  )
}

export function MessageSources({ rag, anchorPrefix }: { rag: RagMetadata; anchorPrefix: string }) {
  const cited = rag.sources.filter((s) => s.cited)
  const others = rag.sources.filter((s) => !s.cited)
  const notes = statusNotes(rag)

  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Badge variant={GROUNDING_VARIANT[rag.grounding]}>{GROUNDING_LABEL[rag.grounding]}</Badge>
        <span className="text-muted-foreground">{scopeLabel(rag)}</span>
      </div>

      {notes.length ? (
        <ul className="flex flex-col gap-1 text-muted-foreground">
          {notes.map((note) => (
            <li key={note} className="flex items-start gap-1.5">
              <Info className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
              <span className="text-pretty">{note}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {cited.length ? (
        <section aria-label="Fuentes citadas" className="flex flex-col gap-1.5">
          <h4 className="font-medium">Fuentes citadas</h4>
          <ul className="flex flex-col gap-1.5">
            {cited.map((s) => (
              <SourceItem key={s.ref} source={s} anchorId={`${anchorPrefix}-${s.ref}`} />
            ))}
          </ul>
        </section>
      ) : null}

      {others.length ? (
        <details>
          <summary className="cursor-pointer text-muted-foreground">
            Otros fragmentos consultados ({others.length})
          </summary>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {others.map((s) => (
              <SourceItem key={s.ref} source={s} anchorId={`${anchorPrefix}-${s.ref}`} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}
