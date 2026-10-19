import { z } from 'zod'
import { CONTENT_MAX, FOLDER_KINDS, REASON_MAX, TITLE_MAX } from '@/lib/folder/config'

export const FOLDER_OPERATIONS = ['create', 'append', 'link'] as const
export type FolderOperation = (typeof FOLDER_OPERATIONS)[number]

/**
 * Propuesta del agente sobre la Carpeta (herramienta conceptual `propose_folder_change`).
 * Es plana y con campos anulables porque el proveedor exige un JSON Schema estricto:
 * - create: nuevo apunte (`kind`, `title`, `content`; opcional `parentNodeId`, `relatedNodeId` y, para un ejercicio, `solution`).
 * - append: agrega `content` al apunte existente `targetNodeId` (sirve también para actualizar un resumen).
 * - link: relaciona `targetNodeId` con `relatedNodeId` (`relation` = "related" o "child": el primero contiene al segundo).
 * Los ids de nodos los valida el servidor contra el workspace: el modelo solo puede referirse a apuntes que ya existen.
 */
export const proposeFolderChangeSchema = z.object({
  type: z.literal('propose_folder_change'),
  operation: z.enum(FOLDER_OPERATIONS),
  kind: z.enum(FOLDER_KINDS).nullable(),
  title: z.string().trim().max(TITLE_MAX).nullable(),
  content: z.string().trim().max(CONTENT_MAX).nullable(),
  targetNodeId: z.string().trim().max(64).nullable(),
  parentNodeId: z.string().trim().max(64).nullable(),
  relatedNodeId: z.string().trim().max(64).nullable(),
  relation: z.enum(['related', 'child']).nullable(),
  solution: z.string().trim().max(CONTENT_MAX).nullable(),
  reason: z.string().trim().min(1).max(REASON_MAX),
})

export type FolderProposal = z.infer<typeof proposeFolderChangeSchema>
