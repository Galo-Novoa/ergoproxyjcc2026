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

/** Tipos de apunte de la Carpeta. */
export const FOLDER_NODE_TYPES = ['concept', 'key_points', 'exercise', 'solution', 'note'] as const
export type FolderNodeType = (typeof FOLDER_NODE_TYPES)[number]

export const FOLDER_NODE_LABELS: Record<FolderNodeType, string> = {
  concept: 'Concepto',
  key_points: 'Para recordar',
  exercise: 'Ejercicio',
  solution: 'Resolución',
  note: 'Apunte',
}

/** Tipos de relación entre apuntes. */
export const FOLDER_EDGE_KINDS = ['relates', 'contains', 'solves'] as const
export type FolderEdgeKind = (typeof FOLDER_EDGE_KINDS)[number]

export const FOLDER_EDGE_LABELS: Record<FolderEdgeKind, string> = {
  relates: 'se relaciona con',
  contains: 'contiene',
  solves: 'resuelve',
}

export const isFolderNodeType = (value: string): value is FolderNodeType =>
  (FOLDER_NODE_TYPES as readonly string[]).includes(value)

/** Operaciones que el agente puede proponer sobre la Carpeta. */
export const FOLDER_OPERATIONS = [
  'create_node',
  'append_content',
  'replace_content',
  'relate_nodes',
  'create_exercise_with_solution',
] as const
export type FolderOperation = (typeof FOLDER_OPERATIONS)[number]

/**
 * Propuesta de cambio en la Carpeta. Nunca se aplica sola: queda como
 * AgentAction en estado 'proposed' hasta que la persona la acepta, y recién
 * entonces el backend revalida los permisos y la ejecuta.
 */
export const proposeFolderChangeSchema = z
  .object({
    type: z.literal('propose_folder_change'),
    operation: z.enum(FOLDER_OPERATIONS),
    /** Nodo sobre el que se opera (actualizar, colgar un hijo, relacionar). */
    target_node_id: z.string().nullable().default(null),
    /** Segundo nodo, solo para relate_nodes. */
    related_node_id: z.string().nullable().default(null),
    edge_kind: z.enum(FOLDER_EDGE_KINDS).nullable().default(null),
    node_type: z.enum(FOLDER_NODE_TYPES).nullable().default(null),
    title: z.string().trim().min(1).max(80).nullable().default(null),
    content_md: z.string().trim().min(1).max(4000).nullable().default(null),
    /** Resolución, solo para create_exercise_with_solution. */
    solution_md: z.string().trim().min(1).max(4000).nullable().default(null),
    /** Por qué vale la pena: se le muestra a la persona en la vista previa. */
    reason: z.string().trim().min(1).max(200),
  })
  .superRefine((value, ctx) => {
    const require = (field: keyof typeof value, message: string) => {
      if (value[field] === null || value[field] === undefined) {
        ctx.addIssue({ code: 'custom', message, path: [field] })
      }
    }
    if (value.operation === 'create_node' || value.operation === 'create_exercise_with_solution') {
      require('title', 'Un nodo nuevo necesita título.')
      require('content_md', 'Un nodo nuevo necesita contenido.')
    }
    if (value.operation === 'create_exercise_with_solution') {
      require('solution_md', 'Falta la resolución del ejercicio.')
    }
    if (value.operation === 'append_content' || value.operation === 'replace_content') {
      require('target_node_id', 'Falta el apunte a actualizar.')
      require('content_md', 'Falta el contenido a escribir.')
    }
    if (value.operation === 'relate_nodes') {
      require('target_node_id', 'Falta el primer apunte a relacionar.')
      require('related_node_id', 'Falta el segundo apunte a relacionar.')
      if (value.target_node_id && value.target_node_id === value.related_node_id) {
        ctx.addIssue({
          code: 'custom',
          message: 'Un apunte no se relaciona consigo mismo.',
          path: ['related_node_id'],
        })
      }
    }
  })

export const agentActionSchema = z.discriminatedUnion('type', [
  proposeHistoryBranchSchema,
  proposeFolderChangeSchema,
])
export type AgentActionProposal = z.infer<typeof agentActionSchema>

/** Contrato estricto que se le exige al proveedor. */
export const agentResponseSchema = z.object({
  output: z.string().trim().min(1),
  description: z.string().trim().min(1).max(80),
  actions: z.array(agentActionSchema),
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

export const FOLDER_OPERATION_LABELS: Record<FolderOperation, string> = {
  create_node: 'Apunte nuevo',
  append_content: 'Agregar al apunte',
  replace_content: 'Reescribir el apunte',
  relate_nodes: 'Relacionar apuntes',
  create_exercise_with_solution: 'Ejercicio con resolución',
}
