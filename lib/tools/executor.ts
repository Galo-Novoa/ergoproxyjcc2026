import 'server-only'

import { db } from '@/lib/db'
import {
  TOOL_KIND_BY_NAME,
  TOOL_LABELS,
  isToolName,
  type ToolKind,
  type ToolName,
} from '@/lib/tools/config'
import { callSignature } from '@/lib/tools/signature'
import { runWebSearch, type WebSearchOutcome } from '@/lib/tools/web-search'

/**
 * Ejecutor de herramientas del lado del servidor. Toda llamada pasa por acá:
 *  1. Se valida que la herramienta exista (contrato explícito).
 *  2. Se calcula una firma (herramienta + argumentos) para no repetirla por reintentos.
 *  3. Se aplican permisos: las de escritura NUNCA se ejecutan acá (van a propuesta);
 *     las de lectura solo tocan datos del propio usuario.
 *  4. Se registra el resultado o el error en `ToolCall`.
 */

export { callSignature }

/** ¿Esta misma llamada ya se ejecutó antes? Evita repetirla por reintentos (y nunca cruza usuarios). */
export async function alreadyExecuted(
  signature: string,
  userId: string,
  conversationId: string | null,
): Promise<boolean> {
  const existing = await db.toolCall.findFirst({
    where: { signature, userId, ...(conversationId ? { conversationId } : {}) },
    select: { id: true },
  })
  return Boolean(existing)
}

export type ToolCallLog = {
  userId: string
  conversationId: string | null
  messageId: string | null
  tool: ToolName
  kind: ToolKind
  status: 'ok' | 'error' | 'skipped_duplicate' | 'not_configured'
  signature: string
  args?: unknown
  result?: unknown
  error?: string | null
}

/** Registra una llamada. Nunca interrumpe el flujo por un problema de auditoría. */
export async function logToolCall(entry: ToolCallLog): Promise<void> {
  try {
    await db.toolCall.create({
      data: {
        userId: entry.userId,
        conversationId: entry.conversationId,
        messageId: entry.messageId,
        tool: entry.tool,
        kind: entry.kind,
        status: entry.status,
        signature: entry.signature,
        args: (entry.args ?? undefined) as never,
        result: (entry.result ?? undefined) as never,
        error: entry.error ?? null,
      },
    })
  } catch (error) {
    console.error('[tools] no se pudo registrar la llamada:', error instanceof Error ? error.message : error)
  }
}

export type ReadToolOutcome = {
  tool: ToolName
  label: string
  status: 'ok' | 'error' | 'skipped_duplicate' | 'not_configured'
  web?: WebSearchOutcome
  error?: string | null
}

/**
 * Ejecuta una herramienta de lectura. Solo `web_search` se ejecuta acá; el RAG y la
 * lectura de la Carpeta se resuelven en sus propios módulos (necesitan contexto de
 * sesión que ya está en `chat.ts`). Igual quedan registradas en el mismo log.
 */
export async function executeReadTool(input: {
  tool: ToolName
  args: unknown
  userId: string
  conversationId: string | null
  messageId: string | null
}): Promise<ReadToolOutcome> {
  const { tool, userId, conversationId, messageId } = input
  const label = isToolName(tool) ? TOOL_LABELS[tool] : tool
  const kind = isToolName(tool) ? TOOL_KIND_BY_NAME[tool] : 'read'
  const signature = callSignature(tool, input.args)

  if (await alreadyExecuted(signature, userId, conversationId)) {
    await logToolCall({ ...input, kind, status: 'skipped_duplicate', signature })
    return { tool, label, status: 'skipped_duplicate' }
  }

  if (tool === 'web_search') {
    const outcome = await runWebSearch(input.args)
    const status = !outcome.configured ? 'not_configured' : outcome.error ? 'error' : 'ok'
    await logToolCall({
      userId,
      conversationId,
      messageId,
      tool,
      kind,
      status,
      signature,
      args: input.args,
      result: outcome.results,
      error: outcome.error,
    })
    return { tool, label, status, web: outcome, error: outcome.error }
  }

  // Asentamos la llamada aunque la resolución real viva en otro módulo.
  await logToolCall({ ...input, kind, status: 'ok', signature })
  return { tool, label, status: 'ok' }
}

/** Etiqueta legible de una herramienta por su nombre. */
export function toolLabel(tool: string): string {
  return isToolName(tool) ? TOOL_LABELS[tool] : tool
}
