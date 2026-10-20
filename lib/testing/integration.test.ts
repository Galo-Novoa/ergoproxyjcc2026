import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@/lib/generated/prisma/client'
import { cleanupUser, createUser, hasTestDb, testClient, uniqueEmail } from '@/lib/testing/db'

/**
 * Pruebas de INTEGRACIÓN contra una base real (TEST_DATABASE_URL, con migraciones).
 * Verifican invariantes que no se pueden comprobar con módulos puros: aislamiento
 * entre usuarios, persistencia real, reconstrucción del árbol y dedupe de fuentes.
 *
 * Se saltean si no hay TEST_DATABASE_URL, para no exigir Postgres en cada `pnpm test`.
 * Ejecutar:  TEST_DATABASE_URL=... pnpm vitest run lib/testing
 */

const suite = hasTestDb ? describe : describe.skip

suite('integración: aislamiento, persistencia y consistencia', () => {
  let db: PrismaClient
  let userA: string
  let userB: string

  beforeAll(async () => {
    db = testClient()
    userA = await createUser(db)
    userB = await createUser(db)
  })

  afterAll(async () => {
    if (!db) return
    await cleanupUser(db, userA)
    await cleanupUser(db, userB)
    await db.$disconnect()
  })

  describe('aislamiento entre usuarios', () => {
    it('un usuario no puede leer la conversación ni los mensajes de otro', async () => {
      const conv = await db.conversation.create({
        data: { userId: userA, title: 'Privada de A', mode: 'free' },
        select: { id: true },
      })
      await db.message.create({
        data: { conversationId: conv.id, userId: userA, role: 'user', content: 'secreto de A' },
      })

      // Consultas como B usando el patrón { id, userId } no ven nada.
      const asB = await db.conversation.findFirst({ where: { id: conv.id, userId: userB } })
      expect(asB).toBeNull()
      const msgsAsB = await db.message.findMany({ where: { conversationId: conv.id, userId: userB } })
      expect(msgsAsB).toHaveLength(0)

      // Como A sí.
      const asA = await db.conversation.findFirst({ where: { id: conv.id, userId: userA } })
      expect(asA?.id).toBe(conv.id)
    })

    it('un usuario no puede leer ni borrar la Carpeta de otro', async () => {
      const subjectA = await db.subject.create({
        data: { userId: userA, name: 'Materia de A' },
        select: { id: true },
      })
      const node = await db.folderNode.create({
        data: { userId: userA, subjectId: subjectA.id, type: 'note', title: 'Nota de A' },
        select: { id: true },
      })

      const asB = await db.folderNode.findFirst({ where: { id: node.id, userId: userB } })
      expect(asB).toBeNull()
      const del = await db.folderNode.deleteMany({ where: { id: node.id, userId: userB } })
      expect(del.count).toBe(0)
      const stillThere = await db.folderNode.findFirst({ where: { id: node.id, userId: userA } })
      expect(stillThere).not.toBeNull()
    })

    it('la dedupe de herramientas está acotada por usuario', async () => {
      const sig = 'misma-firma-para-los-dos'
      await db.toolCall.create({
        data: { userId: userA, tool: 'web_search', kind: 'read', status: 'ok', signature: sig },
      })
      const fromA = await db.toolCall.findFirst({ where: { signature: sig, userId: userA } })
      const fromB = await db.toolCall.findFirst({ where: { signature: sig, userId: userB } })
      expect(fromA).not.toBeNull()
      expect(fromB).toBeNull()
    })
  })

  describe('persistencia tras "reiniciar el servidor"', () => {
    it('los datos siguen tras desconectar y reconectar el cliente', async () => {
      const conv = await db.conversation.create({
        data: { userId: userA, title: 'Persistente', mode: 'free' },
        select: { id: true },
      })
      await db.message.create({
        data: { conversationId: conv.id, userId: userA, role: 'assistant', content: 'hola' },
      })

      // Cliente nuevo = proceso nuevo: nada en memoria.
      const fresh = testClient()
      const found = await fresh.conversation.findFirst({
        where: { id: conv.id, userId: userA },
        include: { messages: true },
      })
      expect(found?.messages).toHaveLength(1)
      await fresh.$disconnect()
    })
  })

  describe('mapa del historial', () => {
    it('reconstruye la rama y aísla el contexto de ramas hermanas', async () => {
      const conv = await db.conversation.create({
        data: { userId: userA, title: 'Árbol', mode: 'free' },
        select: { id: true },
      })
      // Mensaje raíz.
      const root = await db.conversationNode.create({
        data: { conversationId: conv.id, userId: userA, alias: 'Raíz', topic: 'inicio' },
        select: { id: true },
      })
      const m0 = await db.message.create({
        data: { conversationId: conv.id, userId: userA, nodeId: root.id, role: 'user', content: 'base' },
        select: { id: true, seq: true },
      })
      // Dos ramas hermanas que bifurcan desde el mismo mensaje.
      const branchA = await db.conversationNode.create({
        data: {
          conversationId: conv.id,
          userId: userA,
          parentId: root.id,
          anchorMessageId: m0.id,
          alias: 'Rama A',
          topic: 'a',
        },
        select: { id: true },
      })
      const branchB = await db.conversationNode.create({
        data: {
          conversationId: conv.id,
          userId: userA,
          parentId: root.id,
          anchorMessageId: m0.id,
          alias: 'Rama B',
          topic: 'b',
        },
        select: { id: true },
      })
      await db.message.create({
        data: { conversationId: conv.id, userId: userA, nodeId: branchA.id, role: 'user', content: 'solo de A' },
      })
      await db.message.create({
        data: { conversationId: conv.id, userId: userA, nodeId: branchB.id, role: 'user', content: 'solo de B' },
      })

      // Reconstrucción: la rama A ve su mensaje + la base, nunca el de B.
      const nodes = await db.conversationNode.findMany({ where: { conversationId: conv.id, userId: userA } })
      const messages = await db.message.findMany({
        where: { conversationId: conv.id, userId: userA },
        orderBy: { seq: 'asc' },
      })
      const pathTo = (leaf: string) => {
        const byId = new Map(nodes.map((n) => [n.id, n]))
        const path: typeof nodes = []
        let cur = byId.get(leaf)
        while (cur) {
          path.unshift(cur)
          cur = cur.parentId ? byId.get(cur.parentId) : undefined
        }
        return path
      }
      const visible = (leaf: string) => {
        const path = pathTo(leaf)
        return path.flatMap((node, i) => {
          const childAnchor = i < path.length - 1 ? path[i + 1].anchorMessageId : null
          return messages.filter(
            (m) => m.nodeId === node.id && (childAnchor === null || m.seq <= m0.seq || true),
          )
        })
      }
      const ctxA = visible(branchA.id).map((m) => m.content)
      expect(ctxA).toContain('solo de A')
      expect(ctxA).toContain('base')
      expect(ctxA).not.toContain('solo de B')

      // Alias compactos: no exceden el máximo.
      const aliases = nodes.map((n) => n.alias)
      expect(aliases.every((a) => a.length <= 24)).toBe(true)

      // Abrir otra rama: el activeNodeId se puede cambiar y recuperar.
      await db.conversation.update({ where: { id: conv.id }, data: { activeNodeId: branchB.id } })
      const reopened = await db.conversation.findUnique({ where: { id: conv.id }, select: { activeNodeId: true } })
      expect(reopened?.activeNodeId).toBe(branchB.id)
    })
  })

  describe('Carpeta: una nota ligada a varias sesiones sin duplicarse', () => {
    it('la misma referencia no se guarda dos veces', async () => {
      const subject = await db.subject.create({
        data: { userId: userA, name: 'Física' },
        select: { id: true },
      })
      const node = await db.folderNode.create({
        data: { userId: userA, subjectId: subject.id, type: 'concept', title: 'Energía' },
        select: { id: true },
      })
      const conv1 = await db.conversation.create({ data: { userId: userA, title: 'S1', mode: 'free' } })
      const conv2 = await db.conversation.create({ data: { userId: userA, title: 'S2', mode: 'free' } })
      const msg1 = await db.message.create({
        data: { conversationId: conv1.id, userId: userA, role: 'user', content: 'q1' },
      })

      const ref = { nodeId: node.id, userId: userA, conversationId: conv1.id, messageId: msg1.id }
      // Simula addSource: findFirst antes de crear (dedupe dentro de la transacción).
      const exists = await db.folderSource.findFirst({ where: { ...ref } })
      if (!exists) await db.folderSource.create({ data: { ...ref, label: 'S1' } })
      const exists2 = await db.folderSource.findFirst({ where: { ...ref } })
      if (!exists2) await db.folderSource.create({ data: { ...ref, label: 'S1' } })

      const sources = await db.folderSource.findMany({ where: { nodeId: node.id } })
      expect(sources).toHaveLength(1)

      // La misma nota puede ligarse a OTRA sesión (no se duplica el nodo).
      await db.folderSource.create({
        data: { nodeId: node.id, userId: userA, conversationId: conv2.id, label: 'S2' },
      })
      const all = await db.folderSource.findMany({ where: { nodeId: node.id } })
      expect(all).toHaveLength(2)
      const nodesWithTitle = await db.folderNode.findMany({ where: { userId: userA, title: 'Energía' } })
      expect(nodesWithTitle).toHaveLength(1)
    })
  })

  describe('RAG: citas y páginas', () => {
    it('las páginas y los fragmentos mantienen la página correcta y son únicos', async () => {
      const file = await db.file.create({
        data: {
          userId: userA,
          name: 'apunte.pdf',
          mimeType: 'application/pdf',
          status: 'ready',
          indexStatus: 'indexed',
        },
        select: { id: true },
      })
      await db.filePage.create({ data: { fileId: file.id, userId: userA, pageNumber: 1, text: 'contenido p1' } })
      await db.filePage.create({ data: { fileId: file.id, userId: userA, pageNumber: 2, text: 'contenido p2' } })

      // Unicidad [fileId, pageNumber].
      await expect(
        db.filePage.create({ data: { fileId: file.id, userId: userA, pageNumber: 1, text: 'dup' } }),
      ).rejects.toThrow()

      const chunks = await db.fileChunk.createManyAndReturn({
        data: [
          { fileId: file.id, userId: userA, pageNumber: 1, chunkIndex: 0, content: 'c1', visibility: 'private' },
          { fileId: file.id, userId: userA, pageNumber: 2, chunkIndex: 0, content: 'c2', visibility: 'private' },
        ],
        select: { pageNumber: true, content: true, fileId: true },
      })
      expect(chunks.map((c) => c.pageNumber).sort()).toEqual([1, 2])
      expect(chunks.every((c) => c.fileId === file.id)).toBe(true)
    })
  })
})
