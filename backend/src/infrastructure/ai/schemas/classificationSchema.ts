import { z } from 'zod';

export const decisionScoreAnswerSchema = z.object({
  type: z.literal('score').optional(),
  score: z.number().min(0).max(5),
  confidence: z.number().min(0).max(1),
  probabilities: z.record(z.string(), z.number().min(0).max(1)).optional(),
  legend: z.record(z.string(), z.string()).optional(),
});

export const decisionsApiResponseSchema = z.object({
  answers: z.record(z.string(), decisionScoreAnswerSchema),
});

export type DecisionsApiResponse = z.infer<typeof decisionsApiResponseSchema>;
