import 'server-only'

import { generateText, NoObjectGeneratedError, Output } from 'ai'
import { getLlmServerConfig } from '@/lib/llm/config'
import {
  agentActionSchema,
  agentResponseSchema,
  lenientResponseSchema,
  MODE_LABELS,
  type AgentActionProposal,
  type AgentResponse,
  type ConversationMode,
  type MessageMetadata,
  type RecoveryKind,
} from '@/lib/llm/contract'

export type KnownNode = { id: string; question: string }

/** Fragmento del material de la materia que el tutor puede citar. */
export type MaterialExcerpt = { title: string; text: string }

/** Apunte que ya existe en la Carpeta, para que el agente no proponga duplicados. */
export type KnownFolderNode = { id: string; title: string; type: string }

export type AgentResult = { response: AgentResponse; metadata: MessageMetadata }

const MODE_GUIDANCE: Record<ConversationMode, string> = {
  theory:
    'Modo Teoría: explicá conceptos, definiciones y demostraciones con rigor, y enlazá las ideas entre sí.',
  practice:
    'Modo Práctica: guiá la resolución de ejercicios paso a paso, pedí que el estudiante intente y corregí sin dar todo resuelto de entrada.',
  free: 'Modo Libre: respondé de forma flexible según lo que pregunte el estudiante.',
}

function buildSystemPrompt(
  mode: ConversationMode,
  nodes: KnownNode[],
  focusNode: KnownNode | null,
  material: MaterialExcerpt[],
  folderNodes: KnownFolderNode[],
) {
  const nodeList = nodes.length
    ? nodes.map((n) => `- ${n.id}: ${n.question}`).join('\n')
    : '(todavía no hay nodos)'

  const folderList = folderNodes.length
    ? folderNodes.map((n) => `- ${n.id} [${n.type}]: ${n.title}`).join('\n')
    : '(la Carpeta está vacía)'

  return [
    'Sos un tutor para estudiantes de ingeniería y ciencias exactas de la FCEIA (UNR). Respondé en español rioplatense, con claridad y paso a paso.',
    MODE_GUIDANCE[mode],
    'Tu respuesta es un objeto JSON con tres campos:',
    '- output: el texto visible para el estudiante, en Markdown (podés usar listas, tablas y bloques de código).',
    '- description: alias corto (2 a 5 palabras, máximo 80 caracteres) del concepto o problema específico tratado, por ejemplo «Sustitución en integrales». Nunca copies la pregunta completa.',
    '- actions: lista de acciones PROPUESTAS; casi siempre debe estar vacía.',
    'Tenés dos acciones disponibles. Las dos son PROPUESTAS: el estudiante ve una vista previa y decide. Nunca asumas que se aplicaron.',
    '1) Rama en el mapa de dudas, cuando la respuesta abre un subtema que merece su propio nodo:',
    '{"type":"propose_history_branch","parent_node_id":<id de la lista de dudas o null>,"title":<alias corto>,"description":<tema específico de la rama>}',
    '2) Cambio en la Carpeta, cuando aparece conocimiento que conviene guardar como apunte reutilizable:',
    '{"type":"propose_folder_change","operation":<una de create_node | append_content | replace_content | relate_nodes | create_exercise_with_solution>,"target_node_id":<id de la Carpeta o null>,"related_node_id":<id de la Carpeta o null>,"edge_kind":<relates | contains | solves o null>,"node_type":<concept | key_points | exercise | solution | note o null>,"title":<título del apunte o null>,"content_md":<contenido en Markdown o null>,"solution_md":<resolución en Markdown o null>,"reason":<por qué conviene, una frase>}',
    'Reglas de la Carpeta:',
    '- La Carpeta guarda el conocimiento de la materia, no el desarrollo de la charla. Es independiente del mapa de dudas: no propongas copiar cada duda como apunte.',
    '- Si ya existe un apunte parecido en la lista, proponé append_content para sumarle lo nuevo, o relate_nodes para conectarlo. No crees duplicados.',
    '- replace_content reescribe el apunte entero: usalo solo si el contenido viejo quedó mal, nunca para agregar.',
    '- create_node necesita title y content_md. En target_node_id podés poner el apunte que lo contiene, o null.',
    '- create_exercise_with_solution crea el ejercicio y su resolución juntos: content_md es el enunciado y solution_md la resolución.',
    '- En target_node_id y related_node_id usá solo ids de la lista de la Carpeta. Nunca inventes ids.',
    ...(material.length
      ? [
          'Material que subió el estudiante para esta materia. Respondé apoyándote en estos fragmentos y nombrá el archivo cuando los uses. Si la respuesta no está acá, decilo y respondé con tu propio conocimiento:',
          material
            .map((excerpt) => [`--- ${excerpt.title} ---`, excerpt.text].join('\n'))
            .join('\n\n'),
        ]
      : []),
    'Nodos existentes del mapa de dudas:',
    nodeList,
    'Apuntes que ya existen en la Carpeta de esta materia:',
    folderList,
    ...(focusNode ? [
      `El estudiante volvió al nodo ${focusNode.id} («${focusNode.question}») y sigue preguntando desde ahí. Si proponés una rama, usá ese id como parent_node_id.`,
    ] : []),
  ].join('\n')
}

function stripFences(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return (fenced ? fenced[1] : text).trim()
}

function extractJson(text: string): unknown {
  const candidate = stripFences(text)
  try {
    return JSON.parse(candidate)
  } catch {
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start === -1 || end <= start) return undefined
    try {
      return JSON.parse(candidate.slice(start, end + 1))
    } catch {
      return undefined
    }
  }
}

/** Valida cada acción por separado: las inválidas se descartan, nunca se ejecutan. */
function validateActions(raw: unknown[]) {
  const valid: AgentActionProposal[] = []
  let dropped = 0
  for (const item of raw) {
    const parsed = agentActionSchema.safeParse(item)
    if (parsed.success) valid.push(parsed.data)
    else dropped += 1
  }
  return { valid, dropped }
}

/** Recupera una respuesta cuando el proveedor no cumplió el esquema. Devuelve null si no hay texto utilizable. */
function recover(
  rawText: string | undefined,
): { response: AgentResponse; dropped: number; kind: RecoveryKind } | null {
  const text = rawText?.trim()
  if (!text) return null

  const json = extractJson(text)
  const lenient = lenientResponseSchema.safeParse(json)
  if (lenient.success) {
    const { valid, dropped } = validateActions(lenient.data.actions ?? [])
    return {
      response: {
        output: lenient.data.output,
        description: lenient.data.description ?? null,
        actions: valid,
      },
      dropped,
      kind: 'extracted_json',
    }
  }

  // Si el texto parece un JSON roto, no se lo muestra tal cual al estudiante.
  if (json !== undefined || /^\s*[{[]/.test(stripFences(text))) return null

  return { response: { output: text, description: null, actions: [] }, dropped: 0, kind: 'plain_text' }
}

export class AgentError extends Error {}

export async function runAgent({
  mode,
  nodes,
  history,
  focusNode = null,
  material = [],
  folderNodes = [],
}: {
  mode: ConversationMode
  nodes: KnownNode[]
  history: { role: 'user' | 'assistant'; content: string }[]
  /** Nodo del historial desde el que el estudiante decidió continuar, si eligió uno. */
  focusNode?: KnownNode | null
  /** Fragmentos del material subido que vienen al caso para esta pregunta. */
  material?: MaterialExcerpt[]
  /** Apuntes ya existentes en la Carpeta de la materia. */
  folderNodes?: KnownFolderNode[]
}): Promise<AgentResult> {
  const { model, modelId } = getLlmServerConfig()

  try {
    const result = await generateText({
      model,
      system: buildSystemPrompt(mode, nodes, focusNode, material, folderNodes),
      messages: history,
      output: Output.object({ schema: agentResponseSchema }),
      timeout: 60_000,
    })
    const { output, description, actions } = result.output
    return {
      response: { output, description, actions },
      metadata: { model: modelId, recovery: 'none', droppedActions: 0 },
    }
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      const recovered = recover(error.text)
      if (recovered) {
        return {
          response: recovered.response,
          metadata: { model: modelId, recovery: recovered.kind, droppedActions: recovered.dropped },
        }
      }
      throw new AgentError('El modelo devolvió una respuesta que no pudimos interpretar. Probá de nuevo.')
    }
    throw new AgentError('No pudimos comunicarnos con el modelo de lenguaje. Probá de nuevo en unos minutos.')
  }
}

export { MODE_LABELS }
