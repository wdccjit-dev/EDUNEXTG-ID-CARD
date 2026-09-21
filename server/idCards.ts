import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import {
  getDb,
  approveIdCardRequest,
  listIdCardRequests,
  listIdCardTemplates,
  listSchools,
  requestChangesForIdCardRequest,
} from "./db";
import { idCardRequests } from "../drizzle/schema";
import { protectedProcedure, router } from "./_core/trpc";

export const idCardsRouter = router({
  requests: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role === "SUPER_ADMIN") {
        return listIdCardRequests();
      }
      if (!ctx.user.schoolId) return [];
      return listIdCardRequests(ctx.user.schoolId);
    }),

    approve: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        }
        const req = (await db.select().from(idCardRequests).where(eq(idCardRequests.id, input.id)))[0];
        if (!req) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Request not found" });
        }
        if (ctx.user.role !== "SUPER_ADMIN" && req.schoolId !== ctx.user.schoolId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "School access denied" });
        }
        await approveIdCardRequest(input.id);
        return { success: true } as const;
      }),

    requestChanges: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          note: z.string().min(1, "Add a note explaining what needs to change"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        }
        const req = (await db.select().from(idCardRequests).where(eq(idCardRequests.id, input.id)))[0];
        if (!req) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Request not found" });
        }
        if (ctx.user.role !== "SUPER_ADMIN" && req.schoolId !== ctx.user.schoolId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "School access denied" });
        }
        await requestChangesForIdCardRequest(input.id, input.note);
        return { success: true } as const;
      }),
  }),

  schools: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role === "SUPER_ADMIN") {
        return listSchools();
      }
      if (!ctx.user.schoolId) return [];
      return listSchools(ctx.user.schoolId);
    }),
  }),

  templates: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role === "SUPER_ADMIN") {
        return listIdCardTemplates();
      }
      return listIdCardTemplates(true);
    }),
  }),
});
