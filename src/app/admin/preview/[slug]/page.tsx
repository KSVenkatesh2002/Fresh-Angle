import { redirect, notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { isAuthenticated } from "@/lib/auth/session";
import { getPostBySlug } from "@/db/queries/posts";

export const dynamic = "force-dynamic";

export default async function AdminDraftPreviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<never> {
  noStore();
  const { slug } = await params;

  const authed = await isAuthenticated();
  if (!authed) {
    redirect(`/admin/login?from=${encodeURIComponent(`/admin/preview/${slug}`)}`);
  }

  const post = await getPostBySlug(slug);
  if (!post) {
    notFound();
  }

  redirect(`/blog/${post.slug}`);
}
