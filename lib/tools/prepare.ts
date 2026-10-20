import 'server-only'

import { generateFileSchema, proposeDiagramSchema } from '@/lib/tools/schema'
import { validateMermaid } from '@/lib/tools/mermaid'
import { prepareGeneratedFile } from '@/lib/tools/file-builder'
import type { AgentActionProposal } from '@/lib/llm/contract'

/**
 * Revalida del lado del servidor las propuestas de herramientas antes de guardarlas.
 * El modelo puede proponer `propose_diagram` o `generate_file`; acá se comprueba que
 * el esquema y el contenido sean válidos. Las inválidas se descartan (nunca llegan a
 * la persona como algo roto). Módulo server-only.
 */

export type PreparedToolProposals = {
  valid: AgentActionProposal[]
  dropped: number
}

/** Valida un diagrama Mermaid: el tipo y el contenido deben ser seguros y válidos. */
export function prepareDiagramProposal(raw: unknown) {
  const parsed = proposeDiagramSchema.safeParse(raw)
  if (!parsed.success) return null
  const check = validateMermaid(parsed.data.source)
  if (!check.ok) return null
  // Si el modelo declaró un tipo distinto al real, corregimos; si no coincide, lo descartamos.
  if (check.type !== parsed.data.diagram_type) return null
  return parsed.data
}

/** Valida un archivo generado: nombre, formato, extensión y tamaño. */
export function prepareFileProposal(raw: unknown) {
  const parsed = generateFileSchema.safeParse(raw)
  if (!parsed.success) return null
  const prepared = prepareGeneratedFile(parsed.data.file_name, parsed.data.format, parsed.data.content)
  if (!prepared.ok) return null
  return { ...parsed.data, file_name: prepared.name }
}

/** Prepara (valida y sanea) todas las propuestas de herramientas del turno. */
export function prepareToolProposals(proposals: AgentActionProposal[]): PreparedToolProposals {
  const valid: AgentActionProposal[] = []
  let dropped = 0
  for (const proposal of proposals) {
    if (proposal.type === 'propose_diagram') {
      const prepared = prepareDiagramProposal(proposal)
      if (prepared) valid.push(prepared)
      else dropped += 1
      continue
    }
    if (proposal.type === 'generate_file') {
      const prepared = prepareFileProposal(proposal)
      if (prepared) valid.push(prepared)
      else dropped += 1
      continue
    }
    valid.push(proposal)
  }
  return { valid, dropped }
}
