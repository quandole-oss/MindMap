import { z } from "zod";

export const MisconceptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  domain: z.enum(["physics", "biology", "math", "history"]),
  grade_band: z.enum(["K-2", "3-5", "6-8", "9-12"]),
  description: z.string(),
  citation: z.string().optional(),
  probe_questions: z.array(z.string()),
  confrontation: z.string().optional(),
});

export type Misconception = z.infer<typeof MisconceptionSchema>;

const LibrarySchema = z.array(MisconceptionSchema);

export function loadLibrary(entries: unknown[]): Misconception[] {
  return LibrarySchema.parse(entries);
}
