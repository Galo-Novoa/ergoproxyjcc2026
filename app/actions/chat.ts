'use server'

import { and, asc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { conversations, messages } from '@/lib/db/schema'
import { getLlmServerConfig } from '@/lib/llm/config'
import { getUserId } from '@/lib/session'
import type { ActionResult } from '@/lib/types'

const contentSchema = z
  .string()
  .trim()
  .min(1, 'Escribí un mensaje.')
  .max(4000, 'El mensaje admite hasta 4000 caracteres.')

const DEMO_REPLY =
  'Modo demo: todavía no hay un modelo de lenguaje configurado, así que no puedo responder sobre tu material. Guardé tu pregunta en la conversación; podés pasarla al mapa de dudas y retomarla cuando el asistente esté activo.'

async function askModel(
  history: { role: string; content: string }[],
): Promise<string | null> {
  const { apiKey, model, baseUrl } = getLlmServerConfig()
  if (!apiKey || !model) return null

  const endpoint = `${(baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '')}/chat/completions`
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content:
              'Sos un tutor para estudiantes de ingeniería y ciencias exactas de la FCEIA (UNR). Respondé en español rioplatense, con claridad y paso a paso.',
          },
          ...history,
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    })
    if (!response.ok) return null
    const json = (await response.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    return json.choices?.[0]?.message?.content?.trim() || null
  } catch {
    return null
  }
}

export async function sendMessage(
  conversationId: string,
  rawContent: string,
): Promise<ActionResult<{ demo: boolean }>> {
  const userId = await getUserId()
  const parsed = contentSchema.safeParse(rawContent)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const content = parsed.data

  const [conversation] = await db
    .select({ id: conversations.id, title: conversations.title })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
  if (!conversation) return { ok: false, error: 'No encontramos la conversación.' }

  await db.insert(messages).values({ conversationId, userId, role: 'user', content })

  const history = await db
    .select({ role: messages.role, content: messages.content })
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), eq(messages.userId, userId)))
    .orderBy(asc(messages.createdAt))

  const reply = await askModel(history.slice(-20))
  const demo = reply === null

  await db.insert(messages).values({
    conversationId,
    userId,
    role: 'assistant',
    content: reply ?? DEMO_REPLY,
  })

  await db
    .update(conversations)
    .set({
      updatedAt: new Date(),
      title:
        conversation.title === 'Nueva conversación'
          ? content.slice(0, 60)
          : conversation.title,
    })
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))

  revalidatePath('/chat', 'layout')
  return { ok: true, data: { demo } }
}
