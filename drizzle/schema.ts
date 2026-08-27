import { boolean, decimal, index, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const sentixWorkspaces = mysqlTable("sentixWorkspaces", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("sentix_workspace_user_idx").on(table.userId)]);

export const sentixWorkspaceReviews = mysqlTable("sentixWorkspaceReviews", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(),
  clientReviewId: varchar("clientReviewId", { length: 100 }).notNull(),
  reviewDate: varchar("reviewDate", { length: 100 }),
  text: text("text").notNull(),
  author: varchar("author", { length: 255 }),
  source: varchar("source", { length: 255 }),
  rating: int("rating"),
  category: varchar("category", { length: 160 }).notNull(),
  label: mysqlEnum("label", ["Positive", "Neutral", "Negative"]).notNull(),
  compound: decimal("compound", { precision: 5, scale: 3 }).notNull(),
  confidence: int("confidence").notNull(),
  vaderCompound: decimal("vaderCompound", { precision: 5, scale: 3 }).notNull(),
  transformerLabel: varchar("transformerLabel", { length: 20 }),
  transformerConfidence: int("transformerConfidence"),
  transformerUsed: boolean("transformerUsed").notNull().default(false),
  actionTag: varchar("actionTag", { length: 255 }).notNull(),
  reviewedAt: timestamp("reviewedAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("sentix_review_workspace_idx").on(table.workspaceId)]);

export const sentixChatMessages = mysqlTable("sentixChatMessages", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  citations: json("citations"),
  followUps: json("followUps"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("sentix_chat_workspace_idx").on(table.workspaceId)]);

export const sentixQuickAnalyses = mysqlTable("sentixQuickAnalyses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  text: text("text").notNull(),
  analysis: json("analysis").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("sentix_quick_analysis_user_idx").on(table.userId)]);

export type SentiXWorkspace = typeof sentixWorkspaces.$inferSelect;
export type InsertSentiXWorkspace = typeof sentixWorkspaces.$inferInsert;
export type SentiXWorkspaceReview = typeof sentixWorkspaceReviews.$inferSelect;
export type InsertSentiXWorkspaceReview = typeof sentixWorkspaceReviews.$inferInsert;
export type SentiXChatMessage = typeof sentixChatMessages.$inferSelect;
export type SentiXQuickAnalysis = typeof sentixQuickAnalyses.$inferSelect;
