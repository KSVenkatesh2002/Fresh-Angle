import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import crypto from 'node:crypto';

function secureCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured on server' },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  if (!token || !secureCompare(token, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized: Invalid secret token' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const slug = body.slug as string | undefined;

    // Revalidate listings and feed routes
    revalidatePath('/', 'page');
    revalidatePath('/blog', 'page');
    revalidatePath('/sitemap.xml');
    revalidatePath('/feed.xml');

    if (slug) {
      revalidatePath(`/blog/${slug}`, 'page');
    }

    return NextResponse.json({
      revalidated: true,
      timestamp: new Date().toISOString(),
      slug: slug ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Revalidation failed: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
