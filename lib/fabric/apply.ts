import 'server-only'

import type { FolderProposal } from '@/lib/folder/schema'
import { runFabricSkill, type FabricResult } from '@/lib/fabric/server'
import type { FabricSkill } from '@/lib/fabric/config'
import type { JevMaterialKind } from '@/lib/jev/contract'

/**
 * Aplica una skill de Fabric al contenido de una propuesta de Carpeta.
 *
 * Reglas:
 * - No toca propuestas de solo relación (`relate_nodes`).
 * - Transforma `content_md` (y `solution_md` en ejercicios) con la MISMA skill,
 *   para que el apunte y su resolución queden consistentes.
 * - Conserva la referencia a las fuentes: agrega una línea con el origen al final,
 *   que la persona puede editar o borrar.
 * - Si la transformación viene vacía, deja el contenido original (nunca lo vacía).
 */

export type FabricAppliedProposal = {
  proposal: FolderProposal
  fabric: FabricResult | null
}

function withSourceNote(content: string, note: string | null): string {
  if (!note) return content
  return `${content.trimEnd()}\n\n> ${note}`
}

async function transform(
  skill: FabricSkill,
  content: string,
  title: string | undefined,
  sourceNote: string | null,
): Promise<{ text: string; result: FabricResult }> {
  const result = await runFabricSkill({ skill, text: content, title })
  const text = result.empty ? content : withSourceNote(result.output, sourceNote)
  return { text, result }
}

/**
 * Transforma una propuesta de Carpeta con la skill indicada. Devuelve la propuesta
 * (posiblemente con el contenido reescrito) junto con el resultado de Fabric, o
 * `fabric: null` si no se aplicó nada.
 */
export async function applyFabricToProposal(
  proposal: FolderProposal,
  skill: FabricSkill | null,
  opts: { material: JevMaterialKind; sourceNote: string | null },
): Promise<FabricAppliedProposal> {
  if (!skill) return { proposal, fabric: null }
  if (proposal.operation === 'relate_nodes') return { proposal, fabric: null }

  const note =
    opts.sourceNote ??
    (opts.material === 'practice' ? 'Referencia: ejercicio tratado en esta sesión.' : 'Referencia: explicación de esta sesión.')

  if (proposal.operation === 'create_exercise_with_solution') {
    const proposalContent = proposal.content_md ?? ''
    const proposalSolution = proposal.solution_md ?? ''
    const [content, solution] = await Promise.all([
      transform(skill, proposalContent, proposal.title ?? undefined, note),
      transform(skill, proposalSolution, proposal.title ?? undefined, note),
    ])
    return {
      proposal: {
        ...proposal,
        content_md: content.text || proposal.content_md,
        solution_md: solution.text || proposal.solution_md,
      },
      fabric: content.result,
    }
  }

  const content = proposal.content_md ?? ''
  const transformed = await transform(skill, content, proposal.title ?? undefined, note)
  return {
    proposal: { ...proposal, content_md: transformed.text || proposal.content_md },
    fabric: transformed.result,
  }
}

/** Aplica Fabric a todas las propuestas de Carpeta de un turno. */
export async function applyFabricToProposals(
  proposals: FolderProposal[],
  skill: FabricSkill | null,
  opts: { material: JevMaterialKind; sourceNote: string | null },
): Promise<{ proposals: FolderProposal[]; results: FabricResult[] }> {
  if (!skill || !proposals.length) return { proposals, results: [] }
  const applied = await Promise.all(
    proposals.map((p) => applyFabricToProposal(p, skill, opts)),
  )
  return {
    proposals: applied.map((a) => a.proposal),
    results: applied.flatMap((a) => (a.fabric ? [a.fabric] : [])),
  }
}
