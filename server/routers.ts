import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
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
    insights: publicProcedure
      .input(z.object({ reviews: z.array(z.any()).max(100) }))
      .query(({ input }) => buildInsights(input.reviews)),
  }),
});

export type AppRouter = typeof appRouter;
