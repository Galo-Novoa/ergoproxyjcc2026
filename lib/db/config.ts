/**
 * Sin DATABASE_URL la app corre con el adaptador de demo (memoria, sin persistencia).
 *
 * El modo demo fabrica una identidad compartida sin sesión (`demo-user`), así que
 * sólo se habilita fuera de producción: un deploy sin DATABASE_URL NUNCA queda sin
 * login. En producción, sin base, las consultas devuelven vacío y las escrituras
 * fallan de forma limpia en vez de exponer datos entre visitantes.
 */
export const isDemoMode = !process.env.DATABASE_URL && process.env.NODE_ENV !== 'production'
export const isDatabaseConfigured = Boolean(process.env.DATABASE_URL)
