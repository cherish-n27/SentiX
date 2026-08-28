import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { answerDataQuestion } from "./dataChat";
import { extractLegacyWordText } from "./documentExtraction";
import { extractDocumentReviews } from "./documentReviewParsing";
import { addSentiXChatMessage, clearSentiXChatHistory, createLocalAccount, createSentiXWorkspace, getLocalAccountCredential, listSentiXQuickAnalyses, listSentiXWorkspaces, loadSentiXWorkspace, LocalAccountEmailTakenError, renameSentiXWorkspace, replaceSentiXWorkspaceReviews, saveSentiXQuickAnalyses, upsertUser } from "./db";
import { hashPassword, verifyPassword } from "./localAuth";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { analyzeReviews, buildInsights, searchReviews } from "./sentiment";
import { suggestWorkbenchName } from "./workbenchNaming";

const accountInput = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().min(10, "Use at least 10 characters.").max(128),
});

function publicUser(user: { id: number; name: string | null; email: string | null; loginMethod: string | null }) {
  return { id: user.id, name: user.name, email: user.email, loginMethod: user.loginMethod };
}

async function setLocalSession(ctx: { req: Parameters<typeof getSessionCookieOptions>[0]; res: { cookie: (name: string, value: string, options: Record<string, unknown>) => unknown } }, user: { openId: string; name: string | null }) {
  const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name || "SentiX user", expiresInMs: ONE_YEAR_MS });
  ctx.res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS });
}

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    register: publicProcedure
      .input(accountInput.extend({ name: z.string().trim().min(2, "Enter your name.").max(120) }))
      .mutation(async ({ ctx, input }) => {
        try {
          const user = await createLocalAccount({
            name: input.name,
            email: input.email,
            passwordHash: await hashPassword(input.password),
          });
          await setLocalSession(ctx, user);
          return { user: publicUser(user) };
        } catch (error) {
          if (error instanceof LocalAccountEmailTakenError) {
            throw new TRPCError({ code: "CONFLICT", message: "An account already exists for this email address. Sign in instead." });
          }
          throw error;
        }
      }),
    login: publicProcedure
      .input(accountInput)
      .mutation(async ({ ctx, input }) => {
        const account = await getLocalAccountCredential(input.email);
        const passwordMatches = account ? await verifyPassword(input.password, account.passwordHash) : false;
        if (!account || !passwordMatches) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Incorrect email or password." });
        }
        await upsertUser({ openId: account.user.openId, lastSignedIn: new Date() });
        await setLocalSession(ctx, account.user);
        return { user: publicUser(account.user) };
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  sentiment: router({
    analyzeText: publicProcedure
      .input(z.object({ id: z.string().max(100).optional(), date: z.string().max(100).optional(), text: z.string().min(2).max(5000), author: z.string().optional(), source: z.string().optional(), rating: z.number().nullable().optional(), category: z.string().optional(), timestamp: z.number().optional() }))
      .mutation(({ input }) => analyzeReviews([input]).then(results => results[0])),
    guestQuickAnalysis: publicProcedure
      .input(z.object({ text: z.string().min(2).max(5_000) }))
      .mutation(async ({ input }) => (await analyzeReviews([{ text: input.text, source: "Guest quick analysis", category: "Guest trial" }]))[0]),
    analyzeBatch: publicProcedure
      .input(z.object({ reviews: z.array(z.object({ id: z.string().max(100).optional(), date: z.string().max(100).optional(), text: z.string().min(1).max(5000), author: z.string().optional(), source: z.string().optional(), rating: z.number().nullable().optional(), category: z.string().optional(), timestamp: z.number().optional() })).min(1).max(100) }))
      .mutation(({ input }) => analyzeReviews(input.reviews)),
    liveSearch: publicProcedure
      .input(z.object({ keyword: z.string().min(3).max(180) }))
      .mutation(async ({ input }) => analyzeReviews(await searchReviews(input.keyword))),
    extractLegacyWord: publicProcedure
      .input(z.object({ fileName: z.string().regex(/\.doc$/i), contentBase64: z.string().min(1).max(12_000_000) }))
      .mutation(({ input }) => extractLegacyWordText(input.fileName, input.contentBase64)),
    extractDocumentReviews: publicProcedure
      .input(z.object({ text: z.string().min(1).max(60_000), source: z.string().min(1).max(255) }))
      .mutation(({ input }) => extractDocumentReviews(input.text, input.source)),
    insights: publicProcedure
      .input(z.object({ reviews: z.array(z.any()).max(100) }))
      .mutation(({ input }) => buildInsights(input.reviews)),
  }),
  workspace: router({
    list: protectedProcedure.query(({ ctx }) => listSentiXWorkspaces(ctx.user.id)),
    create: protectedProcedure.input(z.object({ name: z.string().min(2).max(160) })).mutation(({ ctx, input }) => createSentiXWorkspace(ctx.user.id, input.name)),
    createAuto: protectedProcedure.input(z.object({ seed: z.string().max(1_000).optional(), reviewSnippets: z.array(z.string().max(500)).max(8).optional() })).mutation(async ({ ctx, input }) => createSentiXWorkspace(ctx.user.id, await suggestWorkbenchName(input.seed, input.reviewSnippets))),
    rename: protectedProcedure.input(z.object({ workspaceId: z.number().int().positive(), name: z.string().min(2).max(160) })).mutation(({ ctx, input }) => renameSentiXWorkspace(ctx.user.id, input.workspaceId, input.name)),
    load: protectedProcedure.input(z.object({ workspaceId: z.number().int().positive() })).query(({ ctx, input }) => loadSentiXWorkspace(ctx.user.id, input.workspaceId)),
    saveReviews: protectedProcedure.input(z.object({ workspaceId: z.number().int().positive(), reviews: z.array(z.object({ id: z.string().max(100), date: z.string().max(100).optional(), text: z.string().max(5000), author: z.string().optional(), source: z.string().optional(), rating: z.number().nullable().optional(), category: z.string().max(160), label: z.enum(["Positive", "Neutral", "Negative"]), compound: z.number(), confidence: z.number().int(), vaderCompound: z.number(), transformerLabel: z.enum(["Positive", "Neutral", "Negative"]).nullable().optional(), transformerConfidence: z.number().int().nullable(), transformerUsed: z.boolean(), actionTag: z.string().max(255), timestamp: z.number() })).max(100) })).mutation(({ ctx, input }) => replaceSentiXWorkspaceReviews(ctx.user.id, input.workspaceId, input.reviews)),
    ask: protectedProcedure.input(z.object({ workspaceId: z.number().int().positive(), question: z.string().min(2).max(1000) })).mutation(async ({ ctx, input }) => { const workspace = await loadSentiXWorkspace(ctx.user.id, input.workspaceId); const history = workspace.messages.map(message => ({ role: message.role, content: message.content })); const reply = await answerDataQuestion(input.question, workspace.reviews, history); await addSentiXChatMessage(ctx.user.id, input.workspaceId, { role: "user", content: input.question }); await addSentiXChatMessage(ctx.user.id, input.workspaceId, { role: "assistant", content: reply.answer, citations: reply.citations, followUps: reply.followUps }); return reply; }),
    clearHistory: protectedProcedure.input(z.object({ workspaceId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { await clearSentiXChatHistory(ctx.user.id, input.workspaceId); return { success: true } as const; }),
  }),
  quickAnalysis: router({
    list: protectedProcedure.query(({ ctx }) => listSentiXQuickAnalyses(ctx.user.id)),
    run: protectedProcedure.input(z.object({ texts: z.array(z.string().min(2).max(5_000)).min(1).max(10) })).mutation(async ({ ctx, input }) => {
      const analyses = await analyzeReviews(input.texts.map(text => ({ text, source: "Personal quick analysis", category: "Personal" })));
      await saveSentiXQuickAnalyses(ctx.user.id, analyses);
      return analyses;
    }),
  }),
});

export type AppRouter = typeof appRouter;
