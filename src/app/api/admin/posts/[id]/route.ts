import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth/session';
import { updatePostStatus, deletePost } from '@/db/queries/posts';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const status = body.status as 'draft' | 'published' | 'archived';

  if (!['draft', 'published', 'archived'].includes(status)) {
    return NextResponse.json({ error: 'Invalid post status' }, { status: 400 });
  }

  try {
    const updated = await updatePostStatus(id, status);
    return NextResponse.json({ success: true, post: updated });
  } catch (error) {
    return NextResponse.json(
      { error: `Update failed: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const deleted = await deletePost(id);
    return NextResponse.json({ success: deleted });
  } catch (error) {
    return NextResponse.json(
      { error: `Deletion failed: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
