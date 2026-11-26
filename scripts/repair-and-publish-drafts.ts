import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import * as fs from "fs";
import * as path from "path";
import { eq, desc } from "drizzle-orm";
import { getDb } from "../src/db/client";
import {
  posts,
  postSources,
  postTags,
  postLinks,
  redirects,
} from "../src/db/schema";
import { extractArticleContent } from "../src/services/research/sources";
import { stepResearch } from "../src/services/pipeline/steps/research";
import { stepOutline } from "../src/services/pipeline/steps/outline";
import { stepDraft } from "../src/services/pipeline/steps/draft";
import { stepReview } from "../src/services/pipeline/steps/review";
import { upsertCategory } from "../src/db/queries/categories";
import { getOrCreateTags } from "../src/db/queries/tags";
import { calculateReadingTime } from "../src/lib/utils/reading-time";
import { slugify, generateTopicKey } from "../src/lib/utils/slug";
import {
  fetchPublishedLinkTargets,
  injectContextualInternalLinks,
  recordPostLinks,
} from "../src/services/seo/internal-links";
import { pingIndexNow } from "../src/services/seo/indexnow";

const BROKEN_SLUGS_TO_REPLACE = new Set([
  "audit-rl-unlearning-draft",
  "arxivlabs-open-community-ai-framework",
]);

function isArxivUrl(url?: string): boolean {
  return Boolean(url && url.includes("arxiv.org/"));
}

async function run() {
  const applyMode = process.argv.includes("--apply");
  const dryRun = !applyMode;

  console.log("================================================================================");
  console.log(`🔧 REPAIR & PUBLISH DRAFTS (${dryRun ? "DRY RUN - NO DB WRITES" : "APPLY MODE"})`);
  console.log("================================================================================\n");

  const db = getDb();
  const drafts = await db.query.posts.findMany({
    where: eq(posts.status, "draft"),
    orderBy: [desc(posts.createdAt)],
    with: { sources: true, category: true, tags: { with: { tag: true } } },
  });

  console.log(`Found ${drafts.length} draft post(s) in database.\n`);

  const reportLines: string[] = [
    `# Draft Repair & Publish Report (${dryRun ? "DRY RUN" : "APPLIED"})`,
    `Executed at: ${new Date().toISOString()}`,
    `Total drafts scanned: ${drafts.length}`,
    "",
  ];

  const publishedPaths: string[] = [];

  for (const draft of drafts) {
    const primarySourceUrl = draft.sources?.[0]?.url;
    const isArxiv = isArxivUrl(primarySourceUrl);

    console.log(`\n--------------------------------------------------------------------------------`);
    console.log(`📄 Post: ${draft.slug} (Created: ${draft.createdAt.toISOString()})`);
    console.log(`   Source: ${primarySourceUrl || "none"} | Type: ${isArxiv ? "arXiv (Regenerate)" : "Non-arXiv (Verify & Publish)"}`);

    if (!isArxiv) {
      // Verified non-arXiv draft: promote directly preserving original createdAt as publishedAt
      if (dryRun) {
        console.log(`   [DRY RUN] Would set status='published', publishedAt=${draft.createdAt.toISOString()}`);
        reportLines.push(`- **PUBLISH EXISTING:** \`${draft.slug}\` (publishedAt: ${draft.createdAt.toISOString()})`);
      } else {
        await db
          .update(posts)
          .set({
            status: "published",
            publishedAt: draft.publishedAt ?? draft.createdAt,
            updatedAt: new Date(),
          })
          .where(eq(posts.id, draft.id));

        publishedPaths.push(`/blog/${draft.slug}`);
        console.log(`   ✅ Published "${draft.title}" at /blog/${draft.slug}`);
        reportLines.push(`- **PUBLISHED EXISTING:** \`/blog/${draft.slug}\` (${draft.title})`);
      }
      continue;
    }

    // Regenerate arXiv post from real abstract/paper content
    if (!primarySourceUrl) {
      console.warn(`   ⚠️ Skipping arXiv post with missing source URL`);
      continue;
    }

    const extracted = await extractArticleContent(primarySourceUrl, undefined, { maxChars: 0 });
    const realTitle = extracted.title;
    console.log(`   Real arXiv title: "${realTitle}" (extracted ${extracted.content.length} chars)`);

    if (dryRun) {
      const willRename = BROKEN_SLUGS_TO_REPLACE.has(draft.slug);
      console.log(`   [DRY RUN] Would regenerate from "${realTitle}" -> status='published', publishedAt=${draft.createdAt.toISOString()}${willRename ? " (+ rename slug & add 301 redirect)" : ""}`);
      reportLines.push(`- **WOULD REGENERATE & PUBLISH:** \`${draft.slug}\` from real title "${realTitle}" (${extracted.content.length} chars extracted)${willRename ? " + 301 redirect" : ""}`);
      continue;
    }

    // Full regeneration pipeline using real arXiv content
    const categoryName = draft.category?.name || "AI Research";
    const topicCandidate = {
      title: realTitle,
      url: primarySourceUrl,
      sourceFeed: "ArXiv Computer Science AI",
      category: categoryName,
      pubDate: draft.createdAt.toISOString(),
      relevanceScore: 100,
    };

    const researchRes = await stepResearch(topicCandidate);
    const outlineRes = await stepOutline(topicCandidate.title, researchRes.formattedSourcesText);
    const draftRes = await stepDraft(topicCandidate.title, outlineRes.outline, researchRes.formattedSourcesText);
    const reviewRes = await stepReview(
      topicCandidate.title,
      draftRes.draftMarkdown,
      researchRes.formattedSourcesText,
      { availableSourcesCount: researchRes.sources.length },
    );

    const reviewed = reviewRes.post;
    let finalSlug = draft.slug;
    if (BROKEN_SLUGS_TO_REPLACE.has(draft.slug)) {
      const candidateSlug = slugify(reviewed.slug || reviewed.title);
      const existingConflict = await db.query.posts.findFirst({
        where: eq(posts.slug, candidateSlug),
      });
      finalSlug = existingConflict && existingConflict.id !== draft.id
        ? `${candidateSlug}-${draft.id.slice(0, 6)}`
        : candidateSlug;
    }

    // Internal links injection using current published posts
    let finalContentMd = reviewed.contentMd;
    let injectedLinks: Array<{ toPostId: string; targetSlug: string; anchor: string }> = [];
    try {
      const targets = await fetchPublishedLinkTargets(finalSlug);
      if (targets.length > 0) {
        const linkRes = injectContextualInternalLinks(finalContentMd, finalSlug, targets, 4);
        finalContentMd = linkRes.enrichedMd;
        injectedLinks = linkRes.injectedLinks;
      }
    } catch (linkErr) {
      console.warn(`   ⚠️ Link injection skipped: ${(linkErr as Error).message}`);
    }

    const catSlug = slugify(reviewed.category || categoryName);
    const category = await upsertCategory({
      slug: catSlug,
      name: reviewed.category || categoryName,
      description: `Articles and dispatches on ${reviewed.category || categoryName}.`,
    });

    const tagRecords = await getOrCreateTags(reviewed.tags);
    const tagIds = tagRecords.map((t) => t.id);
    const readingTimeMin = calculateReadingTime(finalContentMd);
    const topicKey = generateTopicKey(reviewed.title);
    const wordCount = finalContentMd.split(/\s+/).filter(Boolean).length;

    await db.transaction(async (tx) => {
      await tx
        .update(posts)
        .set({
          slug: finalSlug,
          title: reviewed.title,
          excerpt: reviewed.excerpt,
          contentMd: finalContentMd,
          metaTitle: reviewed.metaTitle,
          metaDescription: reviewed.metaDescription,
          categoryId: category.id,
          status: "published",
          publishedAt: draft.createdAt,
          updatedAt: new Date(),
          readingTimeMin,
          wordCount,
          aiProvider: reviewRes.provider,
          aiModel: reviewRes.model,
          topicKey,
          researchDepth: researchRes.researchDepth,
        })
        .where(eq(posts.id, draft.id));

      await tx.delete(postTags).where(eq(postTags.postId, draft.id));
      if (tagIds.length > 0) {
        await tx.insert(postTags).values(
          tagIds.map((tagId) => ({ postId: draft.id, tagId })),
        );
      }

      await tx.delete(postSources).where(eq(postSources.postId, draft.id));
      if (researchRes.sources.length > 0) {
        await tx.insert(postSources).values(
          researchRes.sources.map((s) => ({
            postId: draft.id,
            url: s.url,
            title: s.title,
            publisher: s.publisher,
          })),
        );
      }

      await tx.delete(postLinks).where(eq(postLinks.fromPostId, draft.id));

      if (finalSlug !== draft.slug) {
        await tx
          .insert(redirects)
          .values({
            fromPath: `/blog/${draft.slug}`,
            toPath: `/blog/${finalSlug}`,
            statusCode: 301,
          })
          .onConflictDoUpdate({
            target: redirects.fromPath,
            set: { toPath: `/blog/${finalSlug}`, statusCode: 301 },
          });
      }
    });

    if (injectedLinks.length > 0) {
      await recordPostLinks(draft.id, injectedLinks).catch(() => {});
    }

    publishedPaths.push(`/blog/${finalSlug}`);
    console.log(`   ✅ Regenerated & Published "${reviewed.title}" -> /blog/${finalSlug} (Orig: ${reviewRes.originality.originalityScore}%, Depth: ${researchRes.researchDepth})`);
    reportLines.push(
      `- **REGENERATED & PUBLISHED:** \`/blog/${finalSlug}\` (was \`${draft.slug}\`) — "${reviewed.title}" | Sources: ${researchRes.sources.length} (${researchRes.researchDepth}) | Originality: ${reviewRes.originality.originalityScore}%`,
    );
  }

  if (!dryRun && publishedPaths.length > 0) {
    console.log(`\n🌐 Pinging IndexNow for ${publishedPaths.length} newly published URLs...`);
    await pingIndexNow(publishedPaths).catch((err) => {
      console.warn(`⚠️ IndexNow batch ping warning: ${(err as Error).message}`);
    });
  }

  const outDir = path.resolve("scripts/out");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "draft-repair-report.md");
  fs.writeFileSync(outPath, reportLines.join("\n") + "\n", "utf-8");
  console.log(`\n📝 Report written to ${outPath}`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Fatal error:", err);
    process.exit(1);
  });

