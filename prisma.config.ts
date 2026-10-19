import { defineConfig } from 'prisma/config'

// Las migraciones usan la conexión directa (sin pooler) de Neon.
// En runtime la app usa DATABASE_URL a través de @prisma/adapter-pg.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url:
      process.env.DATABASE_URL_UNPOOLED ??
      process.env.POSTGRES_URL_NON_POOLING ??
      process.env.DATABASE_URL ??
      '',
  },
})
