import { z } from 'zod'
import {
  FOLDER_QUERY_MAX,
  GENERATED_FILE_FORMATS,
  GENERATED_FILE_NAME_MAX,
  MERMAID_DIAGRAM_TYPES,
  MERMAID_SOURCE_MAX,
  webSearchSchema,
} from '@/lib/tools/config'

/**
 * Contratos explícitos de cada herramienta. Los `*ArgsSchema` validan lo que el
 * backend recibe antes de tocar nada; los `*ProposalSchema` son las propuestas que
 * quedan guardadas en `AgentAction` y que la persona confirma.
 */

/** Consulta RAG: la usa el propio flujo (no el modelo) para armar el contexto. */
export const ragSearchSchema = z.object({
  query: z.string().trim().min(2).max(1000),
  fileIds: z.array(z.string().uuid()).max(8).default([]),
})
export type RagSearchArgs = z.infer<typeof ragSearchSchema>

/** Lectura de la Carpeta: el modelo pide apuntes por texto; el servidor filtra por dueño. */
export const folderReadSchema = z.object({
  query: z.string().trim().max(FOLDER_QUERY_MAX).default(''),
})
export type FolderReadArgs = z.infer<typeof folderReadSchema>

/** Propuesta de diagrama Mermaid (editable, con vista previa). */
export const proposeDiagramSchema = z.object({
  type: z.literal('propose_diagram'),
  /** Tipo de diagrama Mermaid (se valida contra los permitidos). */
  diagram_type: z.enum(MERMAID_DIAGRAM_TYPES),
  title: z.string().trim().min(1).max(120),
  /** Código Mermaid (fuente editable). */
  source: z.string().trim().min(1).max(MERMAID_SOURCE_MAX),
  /** Descripción corta para la tarjeta de la propuesta. */
  reason: z.string().trim().min(1).max(200),
})
export type DiagramProposal = z.infer<typeof proposeDiagramSchema>

/** Propuesta de archivo generado desde apuntes o la respuesta. */
export const generateFileSchema = z.object({
  type: z.literal('generate_file'),
  format: z.enum(GENERATED_FILE_FORMATS),
  file_name: z.string().trim().min(1).max(GENERATED_FILE_NAME_MAX),
  /** Contenido textual del archivo. El backend lo valida y lo sube a Blob al confirmar. */
  content: z.string().min(1),
  reason: z.string().trim().min(1).max(200),
})
export type GenerateFileProposal = z.infer<typeof generateFileSchema>

export { webSearchSchema }
export type WebSearchArgs = z.infer<typeof webSearchSchema>
