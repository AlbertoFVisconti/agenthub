import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  integer,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ─────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────

export const modelProviderEnum = pgEnum('model_provider', [
  'anthropic',
  'openai',
  'google',
])

export const toolStatusEnum = pgEnum('tool_status', [
  'draft',
  'pending',
  'published',
  'rejected',
])

export const eventTypeEnum = pgEnum('event_type', [
  'install',
  'uninstall',
  'invoke',
  'error',
])

export const oauthProviderEnum = pgEnum('oauth_provider', ['github'])

// ─────────────────────────────────────────────────────────────
// Users
// No password_hash — auth is anonymous session or GitHub OAuth only.
// ─────────────────────────────────────────────────────────────

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email'),
    oauthProvider: oauthProviderEnum('oauth_provider'),
    oauthId: text('oauth_id'),
    isAnonymous: boolean('is_anonymous').notNull().default(true),
    avatarUrl: text('avatar_url'),
    displayName: text('display_name'),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex('users_email_idx').on(t.email),
    oauthIdx: uniqueIndex('users_oauth_idx').on(t.oauthProvider, t.oauthId),
  }),
)

// ─────────────────────────────────────────────────────────────
// API Keys
// Only populated for GitHub-authed users.
// encrypted_key stores "iv:authTag:ciphertext" (all hex, AES-256-GCM).
// ─────────────────────────────────────────────────────────────

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: modelProviderEnum('provider').notNull(),
    // Format: "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
    encryptedKey: text('encrypted_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userProviderIdx: uniqueIndex('api_keys_user_provider_idx').on(
      t.userId,
      t.provider,
    ),
  }),
)

// ─────────────────────────────────────────────────────────────
// Tools
// ─────────────────────────────────────────────────────────────

export const tools = pgTable(
  'tools',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description').notNull(),
    // Full MCP manifest JSON
    manifestJson: jsonb('manifest_json').notNull(),
    // URL to the uploaded package (zip or npm package)
    packageUrl: text('package_url'),
    status: toolStatusEnum('status').notNull().default('draft'),
    // Denormalized for fast listing queries
    installCount: integer('install_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    slugIdx: uniqueIndex('tools_slug_idx').on(t.slug),
    ownerIdx: index('tools_owner_idx').on(t.ownerId),
    statusIdx: index('tools_status_idx').on(t.status),
  }),
)

// ─────────────────────────────────────────────────────────────
// Tool Versions
// ─────────────────────────────────────────────────────────────

export const toolVersions = pgTable(
  'tool_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    toolId: uuid('tool_id')
      .notNull()
      .references(() => tools.id, { onDelete: 'cascade' }),
    version: text('version').notNull(),
    manifestJson: jsonb('manifest_json').notNull(),
    packageUrl: text('package_url').notNull(),
    changelog: text('changelog'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    toolVersionIdx: uniqueIndex('tool_versions_tool_version_idx').on(
      t.toolId,
      t.version,
    ),
    toolIdx: index('tool_versions_tool_idx').on(t.toolId),
  }),
)

// ─────────────────────────────────────────────────────────────
// Installs
// ─────────────────────────────────────────────────────────────

export const installs = pgTable(
  'installs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    toolId: uuid('tool_id')
      .notNull()
      .references(() => tools.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    installedAt: timestamp('installed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userToolIdx: uniqueIndex('installs_user_tool_idx').on(t.userId, t.toolId),
    toolIdx: index('installs_tool_idx').on(t.toolId),
    userIdx: index('installs_user_idx').on(t.userId),
  }),
)

// ─────────────────────────────────────────────────────────────
// Tool Events (install / invoke / error — feeds creator dashboard)
// ─────────────────────────────────────────────────────────────

export const toolEvents = pgTable(
  'tool_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    toolId: uuid('tool_id')
      .notNull()
      .references(() => tools.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'set null' }),
    sessionId: uuid('session_id'),
    eventType: eventTypeEnum('event_type').notNull(),
    // Arbitrary metadata: error message, function name invoked, latency, etc.
    metadataJson: jsonb('metadata_json'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    toolIdx: index('tool_events_tool_idx').on(t.toolId),
    toolTypeIdx: index('tool_events_tool_type_idx').on(t.toolId, t.eventType),
    createdAtIdx: index('tool_events_created_at_idx').on(t.createdAt),
  }),
)

// ─────────────────────────────────────────────────────────────
// Sessions
// ─────────────────────────────────────────────────────────────

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    modelProvider: modelProviderEnum('model_provider').notNull(),
    modelName: text('model_name').notNull(),
    title: text('title'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index('sessions_user_idx').on(t.userId),
  }),
)

// ─────────────────────────────────────────────────────────────
// Session Tools (which tools are enabled in a session)
// ─────────────────────────────────────────────────────────────

export const sessionTools = pgTable(
  'session_tools',
  {
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    toolId: uuid('tool_id')
      .notNull()
      .references(() => tools.id, { onDelete: 'cascade' }),
    enabled: boolean('enabled').notNull().default(true),
  },
  (t) => ({
    pk: uniqueIndex('session_tools_pk').on(t.sessionId, t.toolId),
  }),
)

// ─────────────────────────────────────────────────────────────
// Relations (for Drizzle's relational query API)
// ─────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  apiKeys: many(apiKeys),
  tools: many(tools),
  installs: many(installs),
  sessions: many(sessions),
}))

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, { fields: [apiKeys.userId], references: [users.id] }),
}))

export const toolsRelations = relations(tools, ({ one, many }) => ({
  owner: one(users, { fields: [tools.ownerId], references: [users.id] }),
  versions: many(toolVersions),
  installs: many(installs),
  events: many(toolEvents),
  sessionTools: many(sessionTools),
}))

export const toolVersionsRelations = relations(toolVersions, ({ one }) => ({
  tool: one(tools, { fields: [toolVersions.toolId], references: [tools.id] }),
}))

export const installsRelations = relations(installs, ({ one }) => ({
  tool: one(tools, { fields: [installs.toolId], references: [tools.id] }),
  user: one(users, { fields: [installs.userId], references: [users.id] }),
}))

export const toolEventsRelations = relations(toolEvents, ({ one }) => ({
  tool: one(tools, { fields: [toolEvents.toolId], references: [tools.id] }),
  user: one(users, { fields: [toolEvents.userId], references: [users.id] }),
}))

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
  sessionTools: many(sessionTools),
}))

export const sessionToolsRelations = relations(sessionTools, ({ one }) => ({
  session: one(sessions, {
    fields: [sessionTools.sessionId],
    references: [sessions.id],
  }),
  tool: one(tools, {
    fields: [sessionTools.toolId],
    references: [tools.id],
  }),
}))


