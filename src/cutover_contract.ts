import { z } from "zod";

export const cutoverRequestSchema = z.object({
  domain: z.string().min(1),
  hostname: z.string().min(1),
  recordType: z.enum(["A", "CNAME"]),
  newContent: z.string().min(1),
  rollbackContent: z.string().min(1),
  ttl: z.number().int().min(60).max(300),
  changeId: z.string().min(8),
  appointmentWindow: z.string().datetime(),
  patientNotice: z.object({
    scheduled: z.literal(true),
    channel: z.enum(["sms", "email", "status-page"]),
    message: z.string().min(12).max(240)
  })
});

export type CutoverRequest = z.infer<typeof cutoverRequestSchema>;

export type CutoverPlan = CutoverRequest & {
  rollback: {
    name: string;
    content: string;
    ttl: number;
  };
};

export function prepareCutover(input: CutoverRequest): CutoverPlan {
  if (input.newContent === input.rollbackContent) {
    throw new Error("The rollback target must differ from the new target");
  }

  return {
    ...input,
    rollback: {
      name: input.hostname,
      content: input.rollbackContent,
      ttl: input.ttl
    }
  };
}
