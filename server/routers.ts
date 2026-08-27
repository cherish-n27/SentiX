import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { answerDataQuestion } from "./dataChat";
import { extractLegacyWordText } from "./documentExtraction";
import { addSentiXChatMessage, clearSentiXChatHistory, createSentiXWorkspace, listSentiXWorkspaces, loadSentiXWorkspace, replaceSentiXWorkspaceReviews } from "./db";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { analyzeReviews, buildInsights, searchReviews } from "./sentiment";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
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
      .input(z.object({ text: z.string().min(2).max(5000), author: z.string().optional(), source: z.string().optional(), rating: z.number().nullable().optional(), category: z.string().optional() }))
      .mutation(({ input }) => analyzeReviews([input]).then(results => results[0])),
    analyzeBatch: publicProcedure
      .input(z.object({ reviews: z.array(z.object({ text: z.string().min(1).max(5000), author: z.string().optional(), source: z.string().optional(), rating: z.number().nullable().optional(), category: z.string().optional(), timestamp: z.number().optional() })).min(1).max(100) }))
      .mutation(({ input }) => analyzeReviews(input.reviews)),
    liveSearch: publicProcedure
      .input(z.object({ keyword: z.string().min(3).max(180) }))
      .mutation(async ({ input }) => analyzeReviews(await searchReviews(input.keyword))),
    extractLegacyWord: publicProcedure
      .input(z.object({ fileName: z.string().regex(/\.doc$/i), contentBase64: z.string().min(1).max(12_000_000) }))
      .mutation(({ input }) => extractLegacyWordText(input.fileName, input.contentBase64)),
    insights: publicProcedure
      .input(z.object({ reviews: z.array(z.any()).max(100) }))
      .mutation(({ input }) => buildInsights(input.reviews)),
  }),
  workspace: router({
    list: protectedProcedure.query(({ ctx }) => listSentiXWorkspaces(ctx.user.id)),
    create: protectedProcedure.input(z.object({ name: z.string().min(2).max(160) })).mutation(({ ctx, input }) => createSentiXWorkspace(ctx.user.id, input.name)),
    load: protectedProcedure.input(z.object({ workspaceId: z.number().int().positive() })).query(({ ctx, input }) => loadSentiXWorkspace(ctx.user.id, input.workspaceId)),
    saveReviews: protectedProcedure.input(z.object({ workspaceId: z.number().int().positive(), reviews: z.array(z.object({ id: z.string().max(100), text: z.string().max(5000), author: z.string().optional(), source: z.string().optional(), rating: z.number().nullable().optional(), category: z.string().max(160), label: z.enum(["Positive", "Neutral", "Negative"]), compound: z.number(), confidence: z.number().int(), vaderCompound: z.number(), transformerConfidence: z.number().int().nullable(), transformerUsed: z.boolean(), actionTag: z.string().max(255), timestamp: z.number() })).max(100) })).mutation(({ ctx, input }) => replaceSentiXWorkspaceReviews(ctx.user.id, input.workspaceId, input.reviews)),
    ask: protectedProcedure.input(z.object({ workspaceId: z.number().int().positive(), question: z.string().min(2).max(1000) })).mutation(async ({ ctx, input }) => { const workspace = await loadSentiXWorkspace(ctx.user.id, input.workspaceId); const history = workspace.messages.map(message => ({ role: message.role, content: message.content })); const reply = await answerDataQuestion(input.question, workspace.reviews, history); await addSentiXChatMessage(ctx.user.id, input.workspaceId, { role: "user", content: input.question }); await addSentiXChatMessage(ctx.user.id, input.workspaceId, { role: "assistant", content: reply.answer, citations: reply.citations, followUps: reply.followUps }); return reply; }),
    clearHistory: protectedProcedure.input(z.object({ workspaceId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { await clearSentiXChatHistory(ctx.user.id, input.workspaceId); return { success: true } as const; }),
  }),
});

export type AppRouter = typeof appRouter;
