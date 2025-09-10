import { z } from "zod";

export const SegueRunSchema = z.object({
  id: z.string().uuid(),
  showId: z.string().uuid(),
  set: z.string(), // "S1", "S2", "E1", "E2" etc
  trackIds: z.array(z.string().uuid()),
  sequence: z.string(), // "Shimmy > Basis"
  length: z.number().int().positive(),
  searchText: z.string().nullable(),
  searchVector: z.any().nullable(), // tsvector type
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type SegueRun = z.infer<typeof SegueRunSchema>;

export const CreateSegueRunSchema = SegueRunSchema.omit({
  id: true,
  searchVector: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateSegueRun = z.infer<typeof CreateSegueRunSchema>;

export const UpdateSegueRunSchema = CreateSegueRunSchema.partial();

export type UpdateSegueRun = z.infer<typeof UpdateSegueRunSchema>;

// Search result variant with show details
export const SegueRunWithShowSchema = SegueRunSchema.extend({
  show: z.object({
    id: z.string().uuid(),
    date: z.string(),
    slug: z.string().nullable(),
    venue: z
      .object({
        id: z.string().uuid(),
        name: z.string().nullable(),
        city: z.string().nullable(),
        state: z.string().nullable(),
        country: z.string().nullable(),
      })
      .nullable(),
  }),
});

export type SegueRunWithShow = z.infer<typeof SegueRunWithShowSchema>;

// Search match details for display
export const SegueRunMatchSchema = z.object({
  segueRun: SegueRunWithShowSchema,
  matchScore: z.number(),
  matchedPortion: z.string().optional(), // The part of the sequence that matched
  matchPosition: z.number().optional(), // Where in the sequence the match starts
});

export type SegueRunMatch = z.infer<typeof SegueRunMatchSchema>;
