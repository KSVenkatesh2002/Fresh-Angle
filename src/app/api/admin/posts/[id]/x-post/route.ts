import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { isAuthenticated } from "@/lib/auth/session";
import { getDb } from "@/db/client";
import { posts } from "@/db/schema";
import { postArticleToX } from "@/services/notify/buffer";
import { recordAuditLog } from "@/services/audit/logger";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const confirm = Boolean((body as { confirm?: unknown }).confirm);

  const db = getDb();
  const [post] = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      status: posts.status,
      origin: posts.origin,
      xPostStatus: posts.xPostStatus,
    })
    .from(posts)
    .where(eq(posts.id, id))
    .limit(1);

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (post.status !== "published") {
    return NextResponse.json(
      { error: "Only published posts can be posted to X" },
      { status: 400 },
    );
  }

  if (post.xPostStatus === "posted" && !confirm) {
    return NextResponse.json(
      {
        error: "Post was already posted to X. Pass confirm: true to re-post.",
        alreadyPosted: true,
      },
      { status: 409 },
    );
  }

  const result = await postArticleToX(id, { force: true, confirm });

  await recordAuditLog({
    action: "X_POST_MANUAL_RETRY",
    entityType: "post",
    entityId: id,
    details: {
      slug: post.slug,
      confirm,
      result,
    },
  });

  return NextResponse.json(result, {
    status: result.success ? 200 : result.skipped ? 200 : 502,
  });
}
