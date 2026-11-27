import {
  sendPostPublishedNotification,
  sendDraftSavedNotification,
} from "@/services/notify/telegram";
import { postArticleToX } from "@/services/notify/buffer";
import { fetchWithRetry } from "@/lib/utils/http";
import { siteConfig } from "@/config/site";
import { slugify } from "@/lib/utils/slug";
import { Post } from "@/db/schema";

export interface PublishParams {
  post: Post;
  categoryName: string;
  provider: string;
  model: string;
  triggerSource?: string;
  slotTime?: string;
  warnings?: string[];
  isTest?: boolean;
}

export async function stepPublishAndNotify(
  params: PublishParams,
): Promise<void> {
  console.log(
    "📣 [Step 8/8: Notify & Revalidate] Revalidating cache and sending notifications...",
  );

  const postUrl = `${siteConfig.url}/blog/${params.post.slug}`;

  // If this is a test slot: never revalidate public cache or post to public channels
  if (params.isTest) {
    console.log("🧪 [Pipeline Test] Test slot detected. Bypassing public cache revalidation and IndexNow ping.");

    const testNoticeText =
      `[${siteConfig.name}] 🧪 <b>[TEST SLOT] Autonomous Pipeline Test</b>\n\n` +
      `📰 <b>${params.post.title}</b> (Saved as DRAFT)\n` +
      `🎯 <b>Trigger:</b> 🧪 Test Slot Execution${params.slotTime ? ` (${params.slotTime})` : ""}\n` +
      `📁 <b>Track:</b> ${params.categoryName}\n` +
      `🤖 <b>Model:</b> ${params.provider} (${params.model})\n` +
      `⏱️ <b>Reading Time:</b> ${params.post.readingTimeMin} min\n\n` +
      `🔒 <i>Safety Notice: Post status is draft. Never published publicly. Social pings skipped.</i>`;

    const { sendTelegramMessage } = await import("@/services/notify/telegram");
    await sendTelegramMessage(testNoticeText, { disableNotification: true });
    return;
  }

  // If saved as draft (autoPublish disabled or held by quality/citation gate):
  // NEVER broadcast to public Telegram channel or tell Admin it is published.
  if (params.post.status !== "published") {
    const adminPreviewUrl = `${siteConfig.url}/admin/preview/${params.post.slug}`;
    console.log(
      `📝 [Step 8/8: Notify] Post "${params.post.slug}" has status "${params.post.status}". Sending draft notification to admin only and skipping public broadcast & cache revalidation.`,
    );
    await sendDraftSavedNotification({
      title: params.post.title,
      previewUrl: adminPreviewUrl,
      category: params.categoryName,
      provider: params.provider,
      model: params.model,
      triggerSource: params.triggerSource,
      slotTime: params.slotTime,
      readingTimeMin: params.post.readingTimeMin,
      warnings: params.warnings,
    });
    return;
  }

  // 1. Revalidate Next.js cache via internal API
  const warnings = params.warnings || [];
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    const warnMsg = "⚠️ CRON_SECRET is not configured; cache revalidation skipped. Newly published post may not appear immediately on cached pages.";
    console.error(`🚨 [Publish Warning] ${warnMsg}`);
    warnings.push(warnMsg);
  } else {
    try {
      const revalidateUrl = `${siteConfig.url}/api/revalidate`;
      console.log(`🔄 Revalidating cache via ${revalidateUrl}...`);

      const res = await fetchWithRetry(
        revalidateUrl,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${cronSecret}`,
          },
          body: JSON.stringify({
            slug: params.post.slug,
            categorySlug: slugify(params.categoryName),
          }),
          timeoutMs: 10000,
        },
        { retries: 2, backoffMs: 1000 },
      );

      if (res.ok) {
        console.log("✓ Cache successfully revalidated for all pages.");
      } else {
        const errorText = await res.text().catch(() => "");
        const warnMsg = `⚠️ Cache revalidation failed for slug "${params.post.slug}" (HTTP ${res.status}): ${errorText.slice(0, 150)}`;
        console.error(`🚨 [Publish Warning] ${warnMsg}`);
        warnings.push(warnMsg);
      }
    } catch (err: unknown) {
      const warnMsg = `⚠️ Cache revalidation request failed: ${(err as Error).message}`;
      console.error(`🚨 [Publish Warning] ${warnMsg}`);
      warnings.push(warnMsg);
    }
  }

  // 2. Dispatch Telegram Notification
  await sendPostPublishedNotification({
    title: params.post.title,
    url: postUrl,
    category: params.categoryName,
    provider: params.provider,
    model: params.model,
    triggerSource: params.triggerSource,
    slotTime: params.slotTime,
    readingTimeMin: params.post.readingTimeMin,
    warnings: warnings.length > 0 ? warnings : undefined,
  });

  // 3. Dispatch X Auto-Post via Buffer (non-blocking, published & non-test only)
  await postArticleToX(params.post.id);

  console.log(
    "🎉 [Pipeline Complete] Daily post workflow finished successfully!",
  );
}
