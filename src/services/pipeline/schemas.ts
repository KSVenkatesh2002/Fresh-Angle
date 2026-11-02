import { z } from "zod";
import { PIPELINE_CONFIG } from "@/config/pipeline";

// AI Call 1: Structured Outline Schema
export const outlineSchema = z.object({
  proposedTitle: z.string().min(5).max(PIPELINE_CONFIG.limits.titleMaxChars),
  thesis: z.string().min(10),
  targetCategory: z.string().min(3),
  sections: z
    .array(
      z.object({
        heading: z.string().min(3),
        keyPoints: z.array(z.string().min(5)).min(1),
      }),
    )
    .min(3)
    .max(PIPELINE_CONFIG.limits.maxOutlineHeadings),
});

export type OutlineOutput = z.infer<typeof outlineSchema>;

// AI Call 3: Final Reviewed Post Schema
export const postReviewSchema = z.object({
  title: z
    .string()
    .min(5)
    .max(PIPELINE_CONFIG.limits.titleMaxChars, "Title exceeds character limit"),
  excerpt: z.string().min(30).max(300),
  contentMd: z.string().min(400, "Content must be at least 400 characters"),
  metaTitle: z
    .string()
    .min(10)
    .max(
      PIPELINE_CONFIG.limits.metaTitleMaxChars,
      `metaTitle must not exceed ${PIPELINE_CONFIG.limits.metaTitleMaxChars} chars`,
    ),
  metaDescription: z
    .string()
    .min(40)
    .max(
      PIPELINE_CONFIG.limits.metaDescMaxChars,
      `metaDescription must not exceed ${PIPELINE_CONFIG.limits.metaDescMaxChars} chars`,
    ),
  category: z.string().min(2),
  tags: z
    .array(z.string().min(2))
    .min(PIPELINE_CONFIG.limits.minTagsPerPost)
    .max(PIPELINE_CONFIG.limits.maxTagsPerPost),
  slug: z.string().min(3),
  imagePrompt: z.string().min(15),
  imageAlt: z.string().min(10),
  faq: z
    .array(
      z.object({
        question: z.string().min(5),
        answer: z.string().min(15),
      }),
    )
    .min(2),
});

export type PostReviewOutput = z.infer<typeof postReviewSchema>;
