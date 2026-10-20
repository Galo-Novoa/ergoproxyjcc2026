import { z } from 'zod'

/**
 * Arquitectura de herramientas del agente.
 *
 * El modelo NUNCA ejecuta nada por su cuenta: propone una llamada y el backend
 * la valida (esquema, permisos y argumentos) antes de hacer cualquier cosa. Cada
 * herramienta declara su contrato acá y así se puede ampliar la superficie sin
 * habilitar ejecución arbitraria.
 */

/**
 * Naturaleza de la herramienta:
 * - `read`: solo lee datos del propio usuario. Se puede ejecutar en el servidor sin
 *   confirmación (p. ej. buscar en los documentos o en la web).
 * - `write`: crea, modifica o elimina datos persistentes. SIEMPRE pasa por el flujo
 *   de confirmación del usuario; el modelo solo deja una propuesta.
 * - `propose`: produce una propuesta editable (diagrama, archivo) que recién se
 *   materializa cuando la persona la aprueba.
 */
export const TOOL_KINDS = ['read', 'write', 'propose'] as const
export type ToolKind = (typeof TOOL_KINDS)[number]

export const TOOL_KIND_LABELS: Record<ToolKind, string> = {
  read: 'Consulta',
  write: 'Cambio persistente',
  propose: 'Propuesta',
}

/**
 * Herramientas del registro. Una por capacidad del prompt:
 * - `rag_search`: consulta los documentos autorizados del workspace (RAG).
 * - `folder_read`: lee las notas existentes de la Carpeta.
 * - `propose_folder_change`: propone cambios en la Carpeta (write, con confirmación).
 * - `propose_history_branch`: propone una bifurcación del historial (write).
 * - `propose_diagram`: propone un diagrama Mermaid (propose).
 * - `generate_file`: genera un archivo descargable (propose).
 * - `web_search`: busca en la web con un proveedor configurado (read, opt-in).
 */
export const TOOL_NAMES = [
  'rag_search',
  'folder_read',
  'propose_folder_change',
  'propose_history_branch',
  'propose_diagram',
  'generate_file',
  'web_search',
] as const
export type ToolName = (typeof TOOL_NAMES)[number]

export const TOOL_LABELS: Record<ToolName, string> = {
  rag_search: 'Buscar en los documentos',
  folder_read: 'Leer los apuntes',
  propose_folder_change: 'Propuesta de Carpeta',
  propose_history_branch: 'Propuesta de rama',
  propose_diagram: 'Diagrama',
  generate_file: 'Archivo generado',
  web_search: 'Búsqueda web',
}

export const TOOL_KIND_BY_NAME: Record<ToolName, ToolKind> = {
  rag_search: 'read',
  folder_read: 'read',
  web_search: 'read',
  propose_folder_change: 'write',
  propose_history_branch: 'write',
  propose_diagram: 'propose',
  generate_file: 'propose',
}

export const isToolName = (value: string): value is ToolName =>
  (TOOL_NAMES as readonly string[]).includes(value)

/** Límites de la generación de archivos. */
export const GENERATED_FILE_FORMATS = ['md', 'csv', 'txt'] as const
export type GeneratedFileFormat = (typeof GENERATED_FILE_FORMATS)[number]

export const GENERATED_FILE_MIME: Record<GeneratedFileFormat, string> = {
  md: 'text/markdown',
  csv: 'text/csv',
  txt: 'text/plain',
}

export const GENERATED_FILE_MAX_BYTES = 1_000_000
export const GENERATED_FILE_NAME_MAX = 80

/** Diagramas: tipos de Mermaid que aceptamos (subconjunto seguro y previsible). */
export const MERMAID_DIAGRAM_TYPES = [
  'flowchart',
  'sequenceDiagram',
  'classDiagram',
  'stateDiagram',
  'erDiagram',
  'mindmap',
  'journey',
  'gantt',
  'pie',
] as const
export type MermaidDiagramType = (typeof MERMAID_DIAGRAM_TYPES)[number]

export const MERMAID_SOURCE_MAX = 8_000

/** Consulta de la propia Carpeta para `folder_read`. */
export const FOLDER_QUERY_MAX = 200

export const webSearchSchema = z.object({
  query: z.string().trim().min(2).max(300),
  /** Máximo de resultados deseados; el backend lo acota. */
  limit: z.number().int().min(1).max(8).default(5),
})
export type WebSearchArgs = z.infer<typeof webSearchSchema>
