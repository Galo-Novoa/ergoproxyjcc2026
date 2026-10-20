import 'server-only'

import { db } from '@/lib/db'
import { isDatabaseConfigured } from '@/lib/db/config'

/**
 * Recupera los fragmentos del material de la materia que mejor responden a una
 * pregunta, para pasárselos al tutor.
 *
 * La búsqueda es por coincidencia de palabras, sin embeddings ni base vectorial:
 * el material de una materia son unos pocos apuntes, así que alcanza y no suma
 * dependencias. Si el corpus crece, el reemplazo natural es búsqueda de texto
 * completo en Postgres sobre documents.contentMd.
 */

const CHUNK_CHARS = 1200
const MAX_DOCUMENTS = 20
const DEFAULT_LIMIT = 4
/** Palabras demasiado comunes para discriminar: no aportan al puntaje. */
const STOP_WORDS = new Set([
  'para',
  'como',
  'esta',
  'este',
  'esto',
  'pero',
  'porque',
  'cuando',
  'donde',
  'sobre',
  'entre',
  'desde',
  'hasta',
  'tiene',
  'tengo',
  'puedo',
  'cual',
  'cuales',
  'todo',
  'toda',
  'algo',
  'hace',
  'hacer',
  'decir',
  'sirve',
  'quiero',
  'entender',
])

export type MaterialExcerpt = { title: string; text: string }

/** Minúsculas y sin acentos: así "integración" matchea con "integracion". */
function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

function terms(query: string) {
  return [
    ...new Set(
      normalize(query)
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length > 3 && !STOP_WORDS.has(word)),
    ),
  ]
}

/** Corta en trozos de ~CHUNK_CHARS respetando los párrafos. */
function chunk(text: string): string[] {
  const paragraphs = text.split(/\n{2,}/)
  const chunks: string[] = []
  let current = ''
  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length > CHUNK_CHARS) {
      chunks.push(current.trim())
      current = ''
    }
    // Un párrafo más largo que un chunk se parte a lo bruto.
    if (paragraph.length > CHUNK_CHARS) {
      for (let index = 0; index < paragraph.length; index += CHUNK_CHARS) {
        chunks.push(paragraph.slice(index, index + CHUNK_CHARS).trim())
      }
      continue
    }
    current += (current ? '\n\n' : '') + paragraph
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks.filter(Boolean)
}

export async function findRelevantMaterial(
  userId: string,
  subjectId: string | null,
  query: string,
  limit = DEFAULT_LIMIT,
): Promise<MaterialExcerpt[]> {
  if (!isDatabaseConfigured || !subjectId) return []
  const words = terms(query)
  if (words.length === 0) return []

  const documents = await db.document.findMany({
    where: { userId, subjectId, kind: 'source' },
    select: { title: true, contentMd: true },
    orderBy: { createdAt: 'desc' },
    take: MAX_DOCUMENTS,
  })
  if (documents.length === 0) return []

  const scored: { title: string; text: string; score: number }[] = []
  for (const document of documents) {
    for (const piece of chunk(document.contentMd)) {
      const haystack = normalize(piece)
      let score = 0
      for (const word of words) {
        // Cada aparición suma, pero se corta en 3 para que repetir no gane solo por volumen.
        const matches = haystack.split(word).length - 1
        if (matches > 0) score += Math.min(matches, 3)
      }
      if (score > 0) scored.push({ title: document.title, text: piece, score })
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ title, text }) => ({ title, text }))
}
