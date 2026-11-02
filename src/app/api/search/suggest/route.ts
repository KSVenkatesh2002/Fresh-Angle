import { NextResponse } from 'next/server';
import { getSearchSuggestions } from '@/db/queries/posts';

export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q')?.trim() || '';

  if (query.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const suggestions = await getSearchSuggestions(query, 6);
    return NextResponse.json(
      { suggestions },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (err) {
    console.warn(`⚠️ [Suggest] Failed to fetch suggestions: ${(err as Error).message}`);
    return NextResponse.json({ suggestions: [] });
  }
}
