import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  index,
  customType,
} from 'drizzle-orm/pg-core';

// Custom vector type for pgvector (1024 dims for Voyage AI voyage-3)
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(1024)';
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    return value
      .slice(1, -1)
      .split(',')
      .map(Number);
  },
});

// ─── products ────────────────────────────────────────────────────────────────
// One row per product/feature. Each product maps to a vector namespace.
export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  description: text('description').notNull().default(''),
  systemPrompt: text('system_prompt').notNull().default(''),
  createdBy: text('created_by'),  // Supabase Auth user ID
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── documents ───────────────────────────────────────────────────────────────
// One row per uploaded file.
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  storagePath: text('storage_path').notNull(),
  mimeType: text('mime_type').notNull().default('application/octet-stream'),
  // Ingestion status: pending | processing | completed | failed
  status: text('status').notNull().default('pending'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── chunks ──────────────────────────────────────────────────────────────────
// Chunked document content with embeddings. product_id is the namespace.
export const chunks = pgTable(
  'chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    embedding: vector('embedding'),
    // Rich metadata for context preservation
    metadata: text('metadata').notNull().default('{}'), // JSON stored as text
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    productIdIdx: index('chunks_product_id_idx').on(table.productId),
    documentIdIdx: index('chunks_document_id_idx').on(table.documentId),
  }),
);

// ─── profiles ─────────────────────────────────────────────────────────────────
// One row per authenticated user (extends auth.users).
export const profiles = pgTable('profiles', {
  id: text('id').primaryKey(),  // Supabase auth.users UUID stored as text
  displayName: text('display_name'),
  orgName: text('org_name'),
  industry: text('industry'),
  employeeCount: text('employee_count'),
  role: text('role').notNull().default('member'),
  onboardingCompleted: boolean('onboarding_completed').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── invitations ──────────────────────────────────────────────────────────────
// Admin-created email invitations for team members.
export const invitations = pgTable('invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  invitedBy: text('invited_by'),  // auth user ID
  orgName: text('org_name'),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Type exports ─────────────────────────────────────────────────────────────
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type Chunk = typeof chunks.$inferSelect;
export type NewChunk = typeof chunks.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
