import { z } from 'zod'

export const CONVERSATION_MODES = ['theory', 'practice', 'free'] as const
export type ConversationMode = (typeof CONVERSATION_MODES)[number]

export const MODE_LABELS: Record<ConversationMode, string> = {
  theory: 'Teoría',
  practice: 'Práctica',
  free: 'Libre',
}

export const isConversationMode = (value: string): value is ConversationMode =>
  (CONVERSATION_MODES as readonly string[]).includes(value)

/** Acciones que el agente puede PROPONER. Para sumar una nueva, agregarla acá y en `resolveAgentAction`. */
export const proposeHistoryBranchSchema = z.object({
  type: z.literal('propose_history_branch'),
  parent_node_id: z.string().nullable(),
  title: z.string().trim().min(1).max(60),
  description: z.string().trim().min(1).max(200),
})

export const agentActionSchema = z.discriminatedUnion('type', [proposeHistoryBranchSchema])
export type AgentActionProposal = z.infer<typeof agentActionSchema>

/**
 * Contrato estricto que se le exige al proveedor. Usa el objeto de la acción y no la unión discriminada:
 * esta genera `oneOf` en el JSON Schema, que OpenAI rechaza en `response_format` (HTTP 400).
 * Al sumar una segunda acción, armar la unión con `z.union` (genera `anyOf`, que sí se acepta).
 */
export const agentResponseSchema = z.object({
  output: z.string().trim().min(1),
  description: z.string().trim().min(1).max(80),
  actions: z.array(proposeHistoryBranchSchema),
})

/** Validación tolerante para recuperar JSON del texto crudo: las acciones se validan una por una. */
export const lenientResponseSchema = z.object({
  output: z.string().trim().min(1),
  description: z.string().trim().min(1).max(80).nullish(),
  actions: z.array(z.unknown()).nullish(),
})

export type AgentResponse = {
  output: string
  description: string | null
  actions: AgentActionProposal[]
}

/** Estrategia de recuperación aplicada a la respuesta del proveedor. */
export type RecoveryKind = 'none' | 'extracted_json' | 'plain_text'

export type MessageMetadata = {
  model: string
  recovery: RecoveryKind
  droppedActions: number
}
