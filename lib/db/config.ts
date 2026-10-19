/** Sin DATABASE_URL la app corre con el adaptador de demo (memoria, sin persistencia). */
export const isDatabaseConfigured = Boolean(process.env.DATABASE_URL)
