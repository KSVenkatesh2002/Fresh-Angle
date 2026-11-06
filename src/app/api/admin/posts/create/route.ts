import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db/client";
import { topicQueue } from "@/db/schema";
import { slugify } from "@/lib/utils/slug";
import { runDailyPipeline } from "@/services/pipeline/run";
import { createPostWithRelations } from "@/db/queries/posts";

const createPostSchema = z.object({
  title: z.string().min(5),
  prompt: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  tags: z.string().optional(),
  tone: z.string().default("authoritative"),
  length: z.enum(["short", "medium", "long"]).default("medium"),
  sourceUrls: z.string().optional(),
  coverMode: z.enum(["ai", "pexels", "default", "none"]).default("ai"),
  action: z.enum([
    "generate_now",
    "save_draft",
    "schedule_publish",
    "schedule_generate",
  ]),
  scheduledAt: z.string().optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const json = await req.json();
    const parsed = createPostSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid form parameters", details: parsed.error.format() },
        { status: 400 },
      );
    }

    const { title, prompt, categoryId, action, scheduledAt } = parsed.data;
    const db = getDb();

    if (action === "generate_now") {
      const postId = await runDailyPipeline({ triggerSource: "manual" });
      return NextResponse.json({
        success: true,
        postId,
        message: "Post generated successfully!",
      });
    }

    if (action === "schedule_generate" && scheduledAt) {
      // Put in topic queue scheduled for that time
      const [queueItem] = await db
        .insert(topicQueue)
        .values({
          title,
          prompt: prompt || null,
          categoryId: categoryId || null,
          generateAt: new Date(scheduledAt),
          priority: 5,
          status: "queued",
        })
        .returning();

      return NextResponse.json({
        success: true,
        message: "Queued for generation at target date",
        queueId: queueItem.id,
      });
    }

    if (action === "save_draft" || action === "schedule_publish") {
      const slug = slugify(title);
      const isScheduled = action === "schedule_publish" && !!scheduledAt;

      const created = await createPostWithRelations({
        post: {
          title,
          slug,
          excerpt: prompt || title,
          contentMd: `## Overview\n\nDraft created manually on ${new Date().toLocaleDateString()}.\n\n${prompt || ""}`,
          metaTitle: `${title.slice(0, 55)} | Fresh Angle`,
          metaDescription: (prompt || title).slice(0, 150),
          status: isScheduled ? "scheduled" : "draft",
          scheduledFor: isScheduled ? new Date(scheduledAt) : null,
          categoryId: categoryId || null,
          origin: "manual",
          readingTimeMin: 3,
          aiProvider: "manual",
          aiModel: "human",
          topicKey: slug,
        },
        tagIds: [],
        sources: [],
      });

      return NextResponse.json({
        success: true,
        postId: created.id,
        message: isScheduled
          ? "Post scheduled for publication"
          : "Draft saved successfully",
      });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
