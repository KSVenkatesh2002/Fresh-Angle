import { NextResponse } from "next/server";
import { checkDuplicateCandidate } from "@/services/research/dedupe";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const json = await req.json();
    const title = json.title?.trim();

    if (!title || title.length < 5) {
      return NextResponse.json({ isDuplicate: false });
    }

    const dedupeResult = await checkDuplicateCandidate(title);
    return NextResponse.json(dedupeResult);
  } catch (err) {
    return NextResponse.json({
      isDuplicate: false,
      error: (err as Error).message,
    });
  }
}
