import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db/client';
import { postFeedback } from '@/db/schema';

const feedbackSchema = z.object({
  postId: z.string().uuid(),
  wasHelpful: z.boolean(),
  feedbackText: z.string().max(1000).optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const json = await req.json();
    const parsed = feedbackSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid feedback data' }, { status: 400 });
    }

    const db = getDb();
    await db.insert(postFeedback).values({
      postId: parsed.data.postId,
      wasHelpful: parsed.data.wasHelpful,
      feedbackText: parsed.data.feedbackText ?? null,
    });


    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to submit post feedback:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
