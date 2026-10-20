import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanupUser, createUser, hasTestDb } from '@/lib/testing/db'

vi.mock('server-only', () => ({}))

/**
 * Pruebas de INTEGRACIÓN de la bifurcación: continuar desde un nodo del historial de dudas.
 * Se saltean sin TEST_DATABASE_URL, igual que el resto (ver `lib/testing/integration.test.ts`).
 *
 * `branchForQuestionNode` escribe con el cliente global, así que se lo apunta a la base de
 * pruebas ANTES del primer import de `@/lib/db`: nunca toca la base de desarrollo.
 */
if (hasTestDb) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL

const { db } = await import('@/lib/db')
const { branchForQuestionNode, ensureRootNode, loadBranch, loadTree } = await import('@/lib/tree/branch')
const { composeContext } = await import('@/lib/tree/compose')
const { ALIAS_MAX, MAX_DEPTH } = await import('@/lib/tree/config')

const suite = hasTestDb ? describe : describe.skip

suite('branchForQuestionNode: continuar desde un nodo del historial', () => {
  let userId: string

  beforeAll(async () => {
    userId = await createUser(db)
  })

  afterAll(async () => {
    if (userId) await cleanupUser(db, userId)
    await db.$disconnect()
  })

  /** Sesión nueva con su rama raíz, para que cada caso quede aislado. */
  async function session() {
    const conv = await db.conversation.create({
      data: { userId, title: 'Árbol', mode: 'free' },
      select: { id: true },
    })
    return { id: conv.id, rootId: await ensureRootNode(conv.id, userId) }
  }

  const say = (conversationId: string, nodeId: string, role: string, content: string) =>
    db.message.create({
      data: { conversationId, userId, nodeId, role, content },
      select: { id: true, seq: true },
    })

  const dudaSobre = (conversationId: string, messageId: string | null, question: string) =>
    db.questionNode.create({
      data: { userId, conversationId, messageId, question },
      select: { id: true },
    })

  const fork = async (conversationId: string, questionNodeId: string) =>
    branchForQuestionNode(conversationId, userId, questionNodeId, await loadTree(conversationId, userId))

  const count = async (conversationId: string) => (await loadTree(conversationId, userId)).length

  it('sigue en la misma rama si el nodo es la última respuesta (no bifurca al aire)', async () => {
    const s = await session()
    await say(s.id, s.rootId, 'user', '¿Qué es una derivada?')
    const answer = await say(s.id, s.rootId, 'assistant', 'Es la tasa de cambio instantánea.')
    const duda = await dudaSobre(s.id, answer.id, 'Definición de derivada')

    expect(await fork(s.id, duda.id)).toEqual({ ok: true, nodeId: s.rootId })
    expect(await count(s.id)).toBe(1)
  })

  it('abre una rama anclada en la respuesta y deja afuera lo que se habló después', async () => {
    const s = await session()
    await say(s.id, s.rootId, 'user', '¿Qué es una derivada?')
    const answer = await say(s.id, s.rootId, 'assistant', 'Es la tasa de cambio instantánea.')
    const duda = await dudaSobre(s.id, answer.id, 'Definición de derivada')
    await say(s.id, s.rootId, 'user', '¿Y la regla de la cadena?')
    await say(s.id, s.rootId, 'assistant', 'Se deriva la externa por la interna.')

    const result = await fork(s.id, duda.id)
    expect(result.ok).toBe(true)
    const nodeId = result.ok ? result.nodeId! : ''
    expect(nodeId).not.toBe(s.rootId)

    const tree = await loadTree(s.id, userId)
    const branch = await loadBranch(s.id, userId, nodeId, tree)
    const context = composeContext(branch.path, branch.visible)
    const texts = context.messages.map((m) => m.content)
    expect(texts).toContain('¿Qué es una derivada?')
    expect(texts).toContain('Es la tasa de cambio instantánea.')
    expect(texts).not.toContain('¿Y la regla de la cadena?')

    // El alias sale de la duda y respeta el tope del mapa.
    const created = tree.find((n) => n.id === nodeId)
    expect(created?.alias).toBe('Definición de derivada')
    expect(created!.alias.length).toBeLessThanOrEqual(ALIAS_MAX)
  })

  it('reusa la rama si quedó vacía (el modelo falló y se reintenta)', async () => {
    const s = await session()
    const answer = await say(s.id, s.rootId, 'assistant', 'Es la tasa de cambio instantánea.')
    const duda = await dudaSobre(s.id, answer.id, 'Definición de derivada')
    await say(s.id, s.rootId, 'user', 'otra cosa')

    const first = await fork(s.id, duda.id)
    expect(await count(s.id)).toBe(2)
    expect(await fork(s.id, duda.id)).toEqual(first)
    expect(await count(s.id)).toBe(2)
  })

  it('vuelve a bifurcar si la rama anterior ya tiene mensajes (dos exploraciones del mismo punto)', async () => {
    const s = await session()
    const answer = await say(s.id, s.rootId, 'assistant', 'Es la tasa de cambio instantánea.')
    const duda = await dudaSobre(s.id, answer.id, 'Definición de derivada')
    await say(s.id, s.rootId, 'user', 'otra cosa')

    const first = await fork(s.id, duda.id)
    const firstId = first.ok ? first.nodeId! : ''
    await say(s.id, firstId, 'user', '¿Y la velocidad instantánea?')

    const second = await fork(s.id, duda.id)
    expect(second.ok && second.nodeId).not.toBe(firstId)
    expect(await count(s.id)).toBe(3)
  })

  it('no bifurca con un nodo de otra sesión ni con uno sin respuesta: queda solo como foco', async () => {
    const s = await session()
    const other = await session()
    await say(s.id, s.rootId, 'user', 'base')
    await say(s.id, s.rootId, 'assistant', 'respuesta')

    const ajeno = await dudaSobre(other.id, null, 'Duda de otra sesión')
    const sinMensaje = await dudaSobre(s.id, null, 'Duda sin respuesta')

    expect(await fork(s.id, ajeno.id)).toEqual({ ok: true, nodeId: null })
    expect(await fork(s.id, sinMensaje.id)).toEqual({ ok: true, nodeId: null })
    expect(await fork(s.id, '00000000-0000-0000-0000-000000000000')).toEqual({ ok: true, nodeId: null })
    expect(await fork(s.id, 'no-es-uuid')).toEqual({ ok: true, nodeId: null })
    expect(await count(s.id)).toBe(1)
  })

  it('avisa en lugar de bifurcar cuando se alcanzó la profundidad máxima', async () => {
    const s = await session()
    let parentId = s.rootId
    // Cadena de ramas hasta el tope: la última ya no admite hijos.
    for (let depth = 1; depth <= MAX_DEPTH; depth += 1) {
      const anchor = await say(s.id, parentId, 'assistant', `tramo ${depth}`)
      const node = await db.conversationNode.create({
        data: {
          conversationId: s.id,
          userId,
          parentId,
          anchorMessageId: anchor.id,
          alias: `rama ${depth}`,
          topic: `tema ${depth}`,
        },
        select: { id: true },
      })
      parentId = node.id
    }
    const answer = await say(s.id, parentId, 'assistant', 'última respuesta')
    const duda = await dudaSobre(s.id, answer.id, 'Duda al fondo del árbol')
    await say(s.id, parentId, 'user', 'y algo más')

    const result = await fork(s.id, duda.id)
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toMatch(/profundidad/i)
  })
})
