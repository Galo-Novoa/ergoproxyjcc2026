import { FABRIC_MAX_INPUT, FABRIC_MAX_OUTPUT, type FabricSkill } from '@/lib/fabric/config'

/**
 * Transformación determinística de respaldo cuando no hay LLM ni servicio Fabric.
 * No pretende ser un buen resumen: garantiza que la skill devuelva algo útil y
 * predecible (recorte + viñetas) en vez de fallar.
 */

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function bulletize(items: string[], limit: number): string {
  return items
    .slice(0, limit)
    .map((s) => `- ${s}`)
    .join('\n')
}

export function fabricFallbackTransform(skill: FabricSkill, text: string): string {
  const clipped = text.slice(0, FABRIC_MAX_INPUT).trim()
  if (!clipped) return ''
  const sentences = splitSentences(clipped)

  switch (skill) {
    case 'summarize':
    case 'summarize_answer': {
      const head = sentences.slice(0, 4).join(' ')
      return head.length > FABRIC_MAX_OUTPUT ? `${head.slice(0, FABRIC_MAX_OUTPUT)}…` : head
    }
    case 'extract_concepts':
    case 'extract_key_points':
      return bulletize(sentences, 8)
    case 'study_steps':
      return sentences
        .slice(0, 10)
        .map((s, i) => `${i + 1}. ${s}`)
        .join('\n')
  }
}
