import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth/session";
import { updatePostStatus, deletePost } from "@/db/queries/posts";
import { pingIndexNow } from "@/services/seo/indexnow";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const status = body.status as "draft" | "published" | "archived";

  if (!["draft", "published", "archived"].includes(status)) {
    return NextResponse.json({ error: "Invalid post status" }, { status: 400 });
  }

  try {
    const updated = await updatePostStatus(id, status);
    if (status === "published" && updated?.slug) {
      pingIndexNow([`/blog/${updated.slug}`]).catch((err) => {
        console.warn(`⚠️ [IndexNow] Manual publish ping failed for ${updated.slug}:`, (err as Error).message);
      });
    }
    return NextResponse.json({ success: true, post: updated });
  } catch (error) {
    return NextResponse.json(
      { error: `Update failed: ${(error as Error).message}` },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const deleted = await deletePost(id);
    return NextResponse.json({ success: deleted });
  } catch (error) {
    return NextResponse.json(
      { error: `Deletion failed: ${(error as Error).message}` },
      { status: 500 },
    );
  }
}
