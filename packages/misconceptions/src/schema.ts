import { z } from "zod";

export const gradeBandSchema = z.enum(["K-5", "6-8", "9-12"]);

export const misconceptionEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  domain: z.enum(["physics", "biology", "math", "history"]),
  grade_band: gradeBandSchema,
  description: z.string().min(10),
  citation: z.string().min(1),
  probe_questions: z.array(z.string().min(1)).min(1),
  confrontation_scenarios: z.array(z.string().min(1)).min(1),
});

export const misconceptionLibrarySchema = z.array(misconceptionEntrySchema);

export type MisconceptionEntry = z.infer<typeof misconceptionEntrySchema>;
export type GradeBand = z.infer<typeof gradeBandSchema>;
