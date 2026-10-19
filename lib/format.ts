const rtf = new Intl.RelativeTimeFormat('es-AR', { numeric: 'auto' })

const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
]

/** "hace 3 horas", "ayer", "hace un momento". Se calcula en el servidor. */
export function formatRelative(date: Date, now = new Date()) {
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000)
  if (Math.abs(seconds) < 60) return 'hace un momento'
  for (const [unit, size] of STEPS) {
    if (Math.abs(seconds) >= size) {
      return rtf.format(Math.round(seconds / size), unit)
    }
  }
  return 'hace un momento'
}

export function pluralize(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`
}
