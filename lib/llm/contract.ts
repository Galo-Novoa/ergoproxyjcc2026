import { z } from 'zod'
import { GROUNDING_VALUES, type Grounding, type RagMetadata } from '@/lib/rag/types'
import { proposeFolderChangeSchema } from '@/lib/folder/schema'
import { ALIAS_MAX } from '@/lib/tree/config'

export const CONVERSATION_MODES = ['theory', 'practice', 'free'] as const
export type ConversationMode = (typeof CONVERSATION_MODES)[number]

export const MODE_LABELS: Record<ConversationMode, string> = {
  theory: 'Teoría',
  practice: 'Práctica',
  free: 'Libre',
}

export const isConversationMode = (value: string): value is ConversationMode =>
  (CONVERSATION_MODES as readonly string[]).includes(value)

/**
 * Acciones que el agente puede PROPONER. Para sumar una nueva, agregarla acá y en `resolveAgentAction`.
 * El padre de la rama no lo elige el modelo: es la rama donde se hizo la propuesta (lo decide el servidor).
 */
export const proposeHistoryBranchSchema = z.object({
  type: z.literal('propose_history_branch'),
  alias: z.string().trim().min(1).max(ALIAS_MAX),
  description: z.string().trim().min(1).max(200),
})

export const agentActionSchema = z.discriminatedUnion('type', [
  proposeHistoryBranchSchema,
  proposeFolderChangeSchema,
])
export type BranchProposal = z.infer<typeof proposeHistoryBranchSchema>
export type AgentActionProposal = z.infer<typeof agentActionSchema>

/** Lee el payload guardado de una propuesta, incluidas las anteriores al árbol (`title` en lugar de `alias`). */
export function parseProposalPayload(payload: unknown): AgentActionProposal | null {
  const current = agentActionSchema.safeParse(payload)
  if (current.success) return current.data
  if (!payload || typeof payload !== 'object') return null
  const legacy = payload as { type?: unknown; title?: unknown; description?: unknown }
  if (legacy.type !== 'propose_history_branch' || typeof legacy.title !== 'string') return null
  const migrated = agentActionSchema.safeParse({
    type: legacy.type,
    alias: legacy.title.trim().slice(0, ALIAS_MAX),
    description: legacy.description,
  })
  return migrated.success ? migrated.data : null
}

/**
 * Contrato estricto que se le exige al proveedor. Usa el objeto de la acción y no la unión discriminada:
 * esta genera `oneOf` en el JSON Schema, que OpenAI rechaza en `response_format` (HTTP 400).
 * Con varias acciones se usa `z.union` (genera `anyOf`, que sí se acepta).
 */
export const agentResponseSchema = z.object({
  output: z.string().trim().min(1),
  description: z.string().trim().min(1).max(80),
  grounding: z.enum(GROUNDING_VALUES),
  actions: z.array(z.union([proposeHistoryBranchSchema, proposeFolderChangeSchema])),
})

/** Validación tolerante para recuperar JSON del texto crudo: las acciones se validan una por una. */
export const lenientResponseSchema = z.object({
  output: z.string().trim().min(1),
  description: z.string().trim().min(1).max(80).nullish(),
  grounding: z.enum(GROUNDING_VALUES).nullish(),
  actions: z.array(z.unknown()).nullish(),
})

export type AgentResponse = {
  output: string
  description: string | null
  /** Lo que declara el modelo; el servidor lo corrige contra las citas verificadas (ver `applyGrounding`). */
  grounding: Grounding
  actions: AgentActionProposal[]
}

/** Estrategia de recuperación aplicada a la respuesta del proveedor. */
export type RecoveryKind = 'none' | 'extracted_json' | 'plain_text'

export type MessageMetadata = {
  model: string
  recovery: RecoveryKind
  droppedActions: number
  rag?: RagMetadata
}
