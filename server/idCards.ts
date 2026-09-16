import { z } from "zod";
import {
  approveIdCardRequest,
  listIdCardRequests,
  listIdCardTemplates,
  listSchools,
  requestChangesForIdCardRequest,
} from "./db";
import { protectedProcedure, router } from "./_core/trpc";

export const idCardsRouter = router({
  requests: router({
    list: protectedProcedure.query(() => listIdCardRequests()),

    approve: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
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
      .mutation(async ({ input }) => {
        await requestChangesForIdCardRequest(input.id, input.note);
        return { success: true } as const;
      }),
  }),

  schools: router({
    list: protectedProcedure.query(() => listSchools()),
  }),

  templates: router({
    list: protectedProcedure.query(() => listIdCardTemplates()),
  }),
});
