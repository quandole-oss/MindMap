import { z } from "zod";

export const gradeBandSchema = z.enum(["K-5", "6-8", "9-12"]);

export const themeSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "Theme IDs must be kebab-case slugs"),
  name: z.string().min(1),
  naive_theory: z.string().min(10),
  description: z.string().min(20),
  citation: z.string().min(1),
});
export const themeLibrarySchema = z.array(themeSchema);
export type Theme = z.infer<typeof themeSchema>;

export const misconceptionEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  domain: z.string().min(1),
  grade_band: gradeBandSchema,
  description: z.string().min(10),
  citation: z.string().min(1),
  probe_questions: z.array(z.string().min(1)).min(1),
  confrontation_scenarios: z.array(z.string().min(1)).min(1),
  themes: z.array(z.string().min(1)).min(1),
  naive_theory: z.string().min(1).optional(),
});

export const misconceptionLibrarySchema = z.array(misconceptionEntrySchema);

export type MisconceptionEntry = z.infer<typeof misconceptionEntrySchema>;
export type GradeBand = z.infer<typeof gradeBandSchema>;
