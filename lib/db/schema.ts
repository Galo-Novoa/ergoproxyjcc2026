import { relations } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

// --- Better Auth (nombres de columna en camelCase: no renombrar) -----------

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
})

// --- Dominio académico -----------------------------------------------------
// Todas las tablas llevan `userId` (sin FK) y cada consulta debe filtrar por él.
// Las relaciones se declaran a nivel ORM con `relations()`.

export type FileStatus = 'pending' | 'processing' | 'ready' | 'error'
export type DocumentKind = 'note' | 'summary'
export type MessageRole = 'user' | 'assistant' | 'system'
export type QuestionStatus = 'open' | 'resolved'

export const subjects = pgTable(
  'subjects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('userId').notNull(),
    name: text('name').notNull(),
    code: text('code'),
    description: text('description'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (t) => [index('subjects_user_idx').on(t.userId)],
)

export const files = pgTable(
  'files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('userId').notNull(),
    subjectId: uuid('subjectId'),
    name: text('name').notNull(),
    mimeType: text('mimeType').notNull(),
    sizeBytes: integer('sizeBytes').notNull().default(0),
    storageUrl: text('storageUrl'),
    status: text('status').$type<FileStatus>().notNull().default('pending'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (t) => [
    index('files_user_idx').on(t.userId),
    index('files_subject_idx').on(t.subjectId),
  ],
)

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('userId').notNull(),
    subjectId: uuid('subjectId'),
    sourceFileId: uuid('sourceFileId'),
    title: text('title').notNull(),
    kind: text('kind').$type<DocumentKind>().notNull().default('note'),
    contentMd: text('contentMd').notNull().default(''),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (t) => [
    index('documents_user_idx').on(t.userId),
    index('documents_subject_idx').on(t.subjectId),
  ],
)

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('userId').notNull(),
    subjectId: uuid('subjectId'),
    title: text('title').notNull().default('Nueva conversación'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (t) => [
    index('conversations_user_idx').on(t.userId),
    index('conversations_subject_idx').on(t.subjectId),
  ],
)

export const conversationFiles = pgTable(
  'conversation_files',
  {
    conversationId: uuid('conversationId').notNull(),
    fileId: uuid('fileId').notNull(),
    userId: text('userId').notNull(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.conversationId, t.fileId] }),
    index('conversation_files_user_idx').on(t.userId),
  ],
)

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversationId').notNull(),
    userId: text('userId').notNull(),
    role: text('role').$type<MessageRole>().notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (t) => [
    index('messages_conversation_idx').on(t.conversationId),
    index('messages_user_idx').on(t.userId),
  ],
)

// Nodos del mapa conceptual: cada duda es un nodo; `parentId` arma el árbol.
export const questionNodes = pgTable(
  'question_nodes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('userId').notNull(),
    subjectId: uuid('subjectId'),
    conversationId: uuid('conversationId'),
    messageId: uuid('messageId'),
    fileId: uuid('fileId'),
    parentId: uuid('parentId'),
    question: text('question').notNull(),
    answerSummary: text('answerSummary'),
    status: text('status').$type<QuestionStatus>().notNull().default('open'),
    posX: real('posX').notNull().default(0),
    posY: real('posY').notNull().default(0),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (t) => [
    index('question_nodes_user_idx').on(t.userId),
    index('question_nodes_subject_idx').on(t.subjectId),
    index('question_nodes_parent_idx').on(t.parentId),
  ],
)

// --- Relaciones ORM --------------------------------------------------------

export const subjectsRelations = relations(subjects, ({ many }) => ({
  files: many(files),
  documents: many(documents),
  conversations: many(conversations),
  questionNodes: many(questionNodes),
}))

export const filesRelations = relations(files, ({ one, many }) => ({
  subject: one(subjects, {
    fields: [files.subjectId],
    references: [subjects.id],
  }),
  conversationLinks: many(conversationFiles),
}))

export const documentsRelations = relations(documents, ({ one }) => ({
  subject: one(subjects, {
    fields: [documents.subjectId],
    references: [subjects.id],
  }),
  sourceFile: one(files, {
    fields: [documents.sourceFileId],
    references: [files.id],
  }),
}))

export const conversationsRelations = relations(
  conversations,
  ({ one, many }) => ({
    subject: one(subjects, {
      fields: [conversations.subjectId],
      references: [subjects.id],
    }),
    messages: many(messages),
    fileLinks: many(conversationFiles),
  }),
)

export const conversationFilesRelations = relations(
  conversationFiles,
  ({ one }) => ({
    conversation: one(conversations, {
      fields: [conversationFiles.conversationId],
      references: [conversations.id],
    }),
    file: one(files, {
      fields: [conversationFiles.fileId],
      references: [files.id],
    }),
  }),
)

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}))

export const questionNodesRelations = relations(
  questionNodes,
  ({ one, many }) => ({
    subject: one(subjects, {
      fields: [questionNodes.subjectId],
      references: [subjects.id],
    }),
    conversation: one(conversations, {
      fields: [questionNodes.conversationId],
      references: [conversations.id],
    }),
    file: one(files, {
      fields: [questionNodes.fileId],
      references: [files.id],
    }),
    parent: one(questionNodes, {
      fields: [questionNodes.parentId],
      references: [questionNodes.id],
      relationName: 'node_parent',
    }),
    children: many(questionNodes, { relationName: 'node_parent' }),
  }),
)
