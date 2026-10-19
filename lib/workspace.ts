import {
  Atom,
  BookOpen,
  Brain,
  Calculator,
  ChartLine,
  Code,
  Cpu,
  FlaskConical,
  Globe,
  Hammer,
  Landmark,
  Languages,
  type LucideIcon,
  Ruler,
  Scale,
  Dna,
} from 'lucide-react'

/** Identificador reservado del workspace fijo. No existe como fila en la base. */
export const GENERAL_WORKSPACE_ID = 'general'

// Las clases se escriben completas para que Tailwind las detecte en el build.
export const WORKSPACE_COLORS = [
  { key: 'azul', label: 'Azul', swatch: 'bg-ws-azul', tile: 'bg-ws-azul', card: 'border-ws-azul/30 bg-ws-azul/10' },
  { key: 'turquesa', label: 'Turquesa', swatch: 'bg-ws-turquesa', tile: 'bg-ws-turquesa', card: 'border-ws-turquesa/30 bg-ws-turquesa/10' },
  { key: 'verde', label: 'Verde', swatch: 'bg-ws-verde', tile: 'bg-ws-verde', card: 'border-ws-verde/30 bg-ws-verde/10' },
  { key: 'ambar', label: 'Ámbar', swatch: 'bg-ws-ambar', tile: 'bg-ws-ambar', card: 'border-ws-ambar/30 bg-ws-ambar/10' },
  { key: 'terracota', label: 'Terracota', swatch: 'bg-ws-terracota', tile: 'bg-ws-terracota', card: 'border-ws-terracota/30 bg-ws-terracota/10' },
  { key: 'rosa', label: 'Rosa', swatch: 'bg-ws-rosa', tile: 'bg-ws-rosa', card: 'border-ws-rosa/30 bg-ws-rosa/10' },
  { key: 'violeta', label: 'Violeta', swatch: 'bg-ws-violeta', tile: 'bg-ws-violeta', card: 'border-ws-violeta/30 bg-ws-violeta/10' },
  { key: 'pizarra', label: 'Pizarra', swatch: 'bg-ws-pizarra', tile: 'bg-ws-pizarra', card: 'border-ws-pizarra/30 bg-ws-pizarra/10' },
] as const

export const WORKSPACE_ICONS = [
  { key: 'book-open', label: 'Libro', icon: BookOpen },
  { key: 'calculator', label: 'Cálculo', icon: Calculator },
  { key: 'chart-line', label: 'Estadística', icon: ChartLine },
  { key: 'atom', label: 'Física', icon: Atom },
  { key: 'flask-conical', label: 'Química', icon: FlaskConical },
  { key: 'dna', label: 'Biología', icon: Dna },
  { key: 'cpu', label: 'Electrónica', icon: Cpu },
  { key: 'code', label: 'Programación', icon: Code },
  { key: 'ruler', label: 'Dibujo', icon: Ruler },
  { key: 'hammer', label: 'Mecánica', icon: Hammer },
  { key: 'scale', label: 'Derecho', icon: Scale },
  { key: 'languages', label: 'Idiomas', icon: Languages },
  { key: 'globe', label: 'Geografía', icon: Globe },
  { key: 'brain', label: 'Psicología', icon: Brain },
] as const

export type WorkspaceColorKey = (typeof WORKSPACE_COLORS)[number]['key']
export type WorkspaceIconKey = (typeof WORKSPACE_ICONS)[number]['key']

export const COLOR_KEYS = WORKSPACE_COLORS.map((c) => c.key) as [
  WorkspaceColorKey,
  ...WorkspaceColorKey[],
]
export const ICON_KEYS = WORKSPACE_ICONS.map((i) => i.key) as [
  WorkspaceIconKey,
  ...WorkspaceIconKey[],
]

export const DEFAULT_COLOR: WorkspaceColorKey = 'azul'
export const DEFAULT_ICON: WorkspaceIconKey = 'book-open'

export function getWorkspaceColor(key: string) {
  return WORKSPACE_COLORS.find((c) => c.key === key) ?? WORKSPACE_COLORS[0]
}

export function getWorkspaceIcon(key: string): LucideIcon {
  return WORKSPACE_ICONS.find((i) => i.key === key)?.icon ?? BookOpen
}

/** Landmark identifica al workspace General. */
export const GeneralIcon: LucideIcon = Landmark
