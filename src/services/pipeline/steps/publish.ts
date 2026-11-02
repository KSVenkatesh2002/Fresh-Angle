import { sendPostPublishedNotification } from '@/services/notify/telegram';
import { fetchWithRetry } from '@/lib/utils/http';
import { siteConfig } from '@/config/site';
import { Post } from '@/db/schema';

export interface PublishParams {
  post: Post;
  categoryName: string;
  provider: string;
  model: string;
  warnings?: string[];
}

export async function stepPublishAndNotify(params: PublishParams): Promise<void> {
  console.log('📣 [Step 8/8: Notify & Revalidate] Revalidating cache and sending notifications...');

  const postUrl = `${siteConfig.url}/blog/${params.post.slug}`;

  // 1. Revalidate Next.js cache via internal API
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    try {
      const revalidateUrl = `${siteConfig.url}/api/revalidate`;
      console.log(`🔄 Revalidating cache via ${revalidateUrl}...`);

      const res = await fetchWithRetry(
        revalidateUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cronSecret}`,
          },
          body: JSON.stringify({ slug: params.post.slug }),
          timeoutMs: 10000,
        },
        { retries: 2, backoffMs: 1000 }
      );

      if (res.ok) {
        console.log('✓ Cache successfully revalidated for all pages.');
      } else {
        console.warn(`⚠️ Revalidation returned status ${res.status}`);
      }
    } catch (err: unknown) {
      console.warn(`⚠️ Cache revalidation failed: ${(err as Error).message}`);
    }
  }

  // 2. Dispatch Telegram Notification
  await sendPostPublishedNotification({
    title: params.post.title,
    url: postUrl,
    category: params.categoryName,
    provider: params.provider,
    model: params.model,
    readingTimeMin: params.post.readingTimeMin,
    warnings: params.warnings,
  });

  console.log('🎉 [Pipeline Complete] Daily post workflow finished successfully!');
}
