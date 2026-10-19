import 'server-only'
import { cache } from 'react'
import { db } from '@/lib/db'
import { isDatabaseConfigured } from '@/lib/db/config'

/**
 * Reglas de acceso a recursos compartibles (Subject, File, Document).
 *
 * - Lectura: lo propio, más lo que una organización de la persona comparte
 *   (visibility = 'organization').
 * - Escritura: lo propio, más lo de organizaciones donde la persona es 'admin'.
 * - Un recurso 'private' solo lo ve su dueño. Conversaciones, mensajes y mapa de
 *   dudas son siempre privados y se filtran únicamente por `userId`.
 *
 * Los filtros devueltos se combinan con el resto del `where` usando AND.
 */

export type OrgRole = 'admin' | 'member'

type Scope = {
  OR: (
    | { userId: string }
    | { visibility: string; organizationId: { in: string[] } }
    | { organizationId: { in: string[] } }
  )[]
}

const loadMemberships = cache(async (userId: string) => {
  if (!isDatabaseConfigured) return []
  const rows = await db.membership.findMany({
    where: { userId },
    select: { organizationId: true, role: true },
  })
  return rows.map((row) => ({
    organizationId: row.organizationId,
    role: row.role as OrgRole,
  }))
})

export async function readScope(userId: string): Promise<Scope> {
  const memberships = await loadMemberships(userId)
  const organizationIds = memberships.map((m) => m.organizationId)
  return {
    OR: [
      { userId },
      ...(organizationIds.length
        ? [{ visibility: 'organization', organizationId: { in: organizationIds } }]
        : []),
    ],
  }
}

export async function writeScope(userId: string): Promise<Scope> {
  const memberships = await loadMemberships(userId)
  const adminOrganizationIds = memberships
    .filter((m) => m.role === 'admin')
    .map((m) => m.organizationId)
  return {
    OR: [
      { userId },
      ...(adminOrganizationIds.length
        ? [{ organizationId: { in: adminOrganizationIds } }]
        : []),
    ],
  }
}
