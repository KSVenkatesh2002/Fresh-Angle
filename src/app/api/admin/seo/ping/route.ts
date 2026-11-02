import { NextResponse } from "next/server";
import { getPublishedPosts } from "@/db/queries/posts";
import { pingIndexNow } from "@/services/seo/indexnow";

export async function POST(): Promise<NextResponse> {
  try {
    const { posts } = await getPublishedPosts({ page: 1, limit: 50 });
    const urls = posts.map((p) => `/blog/${p.slug}`);
    urls.push("/", "/blog", "/categories");

    const result = await pingIndexNow(urls);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { success: false, message: (err as Error).message },
      { status: 500 },
    );
  }
}
