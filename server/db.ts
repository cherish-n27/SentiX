import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, sentixChatMessages, sentixQuickAnalyses, sentixWorkspaceReviews, sentixWorkspaces, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export type StoredReview = { id: string; date?: string; text: string; author?: string; source?: string; rating?: number | null; category: string; label: "Positive" | "Neutral" | "Negative"; compound: number; confidence: number; vaderCompound: number; transformerLabel?: "Positive" | "Neutral" | "Negative" | null; transformerConfidence: number | null; transformerUsed: boolean; actionTag: string; timestamp: number };
export type StoredChatMessage = { role: "user" | "assistant"; content: string; citations?: unknown; followUps?: unknown; createdAt: number };
type RawWorkspaceReview = { clientReviewId: string; reviewDate: string | null; text: string; author: string | null; source: string | null; rating: number | null; category: string; label: "Positive" | "Neutral" | "Negative"; compound: string | number; confidence: number; vaderCompound: string | number; transformerLabel: string | null; transformerConfidence: number | null; transformerUsed: boolean; actionTag: string; reviewedAt: Date };
function toSentimentLabel(value: string | null): StoredReview["transformerLabel"] { return value === "Positive" || value === "Neutral" || value === "Negative" ? value : null; }
type RawWorkspaceMessage = { role: "user" | "assistant"; content: string; citations: unknown; followUps: unknown; createdAt: Date };

export function buildPersistedReviewRows(workspaceId: number, reviews: StoredReview[]) {
  return reviews.slice(0, 100).map(review => ({ workspaceId, clientReviewId: review.id, reviewDate: review.date, text: review.text, author: review.author, source: review.source, rating: review.rating ?? null, category: review.category, label: review.label, compound: String(review.compound), confidence: review.confidence, vaderCompound: String(review.vaderCompound), transformerLabel: review.transformerLabel ?? null, transformerConfidence: review.transformerConfidence, transformerUsed: review.transformerUsed, actionTag: review.actionTag, reviewedAt: new Date(review.timestamp) }));
}

export function hydrateWorkspaceState(reviews: RawWorkspaceReview[], messages: RawWorkspaceMessage[]) {
  return { reviews: reviews.map(review => ({ id: review.clientReviewId, date: review.reviewDate ?? undefined, text: review.text, author: review.author ?? undefined, source: review.source ?? undefined, rating: review.rating, category: review.category, label: review.label, compound: Number(review.compound), confidence: review.confidence, vaderCompound: Number(review.vaderCompound), transformerLabel: toSentimentLabel(review.transformerLabel), transformerConfidence: review.transformerConfidence, transformerUsed: review.transformerUsed, actionTag: review.actionTag, timestamp: review.reviewedAt.getTime() })), messages: messages.map(message => ({ role: message.role, content: message.content, citations: message.citations, followUps: message.followUps, createdAt: message.createdAt.getTime() })) };
}

async function ownedWorkspace(userId: number, workspaceId: number) {
  const db = await getDb();
  if (!db) throw new Error("Workspace storage is unavailable.");
  const rows = await db.select().from(sentixWorkspaces).where(and(eq(sentixWorkspaces.id, workspaceId), eq(sentixWorkspaces.userId, userId))).limit(1);
  if (!rows[0]) throw new Error("Workspace not found or access denied.");
  return { db, workspace: rows[0] };
}

export async function listSentiXWorkspaces(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sentixWorkspaces).where(eq(sentixWorkspaces.userId, userId)).orderBy(desc(sentixWorkspaces.updatedAt));
}

export async function createSentiXWorkspace(userId: number, name: string) {
  const db = await getDb();
  if (!db) throw new Error("Workspace storage is unavailable.");
  const result = await db.insert(sentixWorkspaces).values({ userId, name });
  const id = Number(result[0].insertId);
  const rows = await db.select().from(sentixWorkspaces).where(eq(sentixWorkspaces.id, id)).limit(1);
  return rows[0]!;
}

export async function renameSentiXWorkspace(userId: number, workspaceId: number, name: string) {
  const { db } = await ownedWorkspace(userId, workspaceId);
  await db.update(sentixWorkspaces).set({ name, updatedAt: new Date() }).where(eq(sentixWorkspaces.id, workspaceId));
  const rows = await db.select().from(sentixWorkspaces).where(eq(sentixWorkspaces.id, workspaceId)).limit(1);
  return rows[0]!;
}

export async function loadSentiXWorkspace(userId: number, workspaceId: number) {
  const { db, workspace } = await ownedWorkspace(userId, workspaceId);
  const [reviews, messages] = await Promise.all([
    db.select().from(sentixWorkspaceReviews).where(eq(sentixWorkspaceReviews.workspaceId, workspaceId)).orderBy(desc(sentixWorkspaceReviews.id)),
    db.select().from(sentixChatMessages).where(eq(sentixChatMessages.workspaceId, workspaceId)).orderBy(sentixChatMessages.id),
  ]);
  return { workspace, ...hydrateWorkspaceState(reviews, messages) };
}

export async function replaceSentiXWorkspaceReviews(userId: number, workspaceId: number, reviews: StoredReview[]) {
  const { db } = await ownedWorkspace(userId, workspaceId);
  await db.delete(sentixWorkspaceReviews).where(eq(sentixWorkspaceReviews.workspaceId, workspaceId));
  const rows = buildPersistedReviewRows(workspaceId, reviews);
  if (rows.length) await db.insert(sentixWorkspaceReviews).values(rows);
  await db.update(sentixWorkspaces).set({ updatedAt: new Date() }).where(eq(sentixWorkspaces.id, workspaceId));
}

export async function addSentiXChatMessage(userId: number, workspaceId: number, message: Omit<StoredChatMessage, "createdAt">) {
  const { db } = await ownedWorkspace(userId, workspaceId);
  await db.insert(sentixChatMessages).values({ workspaceId, role: message.role, content: message.content, citations: message.citations, followUps: message.followUps });
  await db.update(sentixWorkspaces).set({ updatedAt: new Date() }).where(eq(sentixWorkspaces.id, workspaceId));
}

export async function clearSentiXChatHistory(userId: number, workspaceId: number) {
  const { db } = await ownedWorkspace(userId, workspaceId);
  await db.delete(sentixChatMessages).where(eq(sentixChatMessages.workspaceId, workspaceId));
  await db.update(sentixWorkspaces).set({ updatedAt: new Date() }).where(eq(sentixWorkspaces.id, workspaceId));
}

export async function saveSentiXQuickAnalyses(userId: number, analyses: StoredReview[]) {
  const db = await getDb();
  if (!db) throw new Error("Quick-analysis storage is unavailable.");
  const rows = analyses.slice(0, 10).map(analysis => ({ userId, text: analysis.text, analysis }));
  if (rows.length) await db.insert(sentixQuickAnalyses).values(rows);
  return rows;
}

export async function listSentiXQuickAnalyses(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sentixQuickAnalyses).where(eq(sentixQuickAnalyses.userId, userId)).orderBy(desc(sentixQuickAnalyses.createdAt)).limit(30);
}
