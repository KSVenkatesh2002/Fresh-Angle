import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import { getDb } from "../src/db/client";
import { posts, postSources } from "../src/db/schema";
import { eq, inArray } from "drizzle-orm";
import { fetchWithRetry } from "../src/lib/utils/http";

const apiKey = process.env.TAVILY_API_KEY;

if (!apiKey) {
  console.error("❌ TAVILY_API_KEY is not in environment.");
  process.exit(1);
}

const failedUrls = [
  "https://www.reuters.com/world/us/us-faa-says-it-will-phase-out-floppy-disks-air-traffic-control-by-2028-2026-11-05/",
  "https://apiiro.com/blog/coding-agents-leaking-secrets-github-dont-ask-again",
  "https://www.axios.com/2026/11/08/nvidia-ceo-jensen-huang-affair-email-to-company",
  "https://ketchup3d.github.io/app/",
  "https://www.worldhistory.org/Ur-Nammu/",
  "https://www.wsj.com/business/nvidia-is-preparing-to-oust-nvidia-ceo-jensen-huang-30f421ad",
  "https://status.claude.com/incidents/nn11wk485zfn",
  "https://atg.science/careers",
  "https://www.techpowerup.com/354814/nvidia-allegedly-engineered-scarcity-by-funding-ai-startups-to-buy-its-gpus",
  "https://www.techspot.com/news/114558-nvidia-deliberately-kept-gpu-prices-high-through-circular.html",
  "https://www.ft.com/content/dbde7a30-548c-4f9d-a4be-7898a0c24dcf",
  "https://news.ycombinator.com/item?id=50363461",
  "https://longcat.ai/blog/longcat-2.5/",
];

async function testTavilyExtract(urls: string[]) {
  console.log("================================================================================");
  console.log("🧪 TESTING TAVILY EXTRACT ON 13 CHEERIO-UNFETCHABLE SOURCES");
  console.log("================================================================================");

  try {
    const res = await fetch("https://api.tavily.com/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        urls,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Tavily Extract API returned HTTP ${res.status}: ${errText}`);
      return;
    }

    const data = await res.json() as {
      results?: Array<{ url: string; raw_content?: string }>;
      failed_results?: Array<{ url: string; error?: string }>;
    };

    const succeeded = data.results || [];
    const failed = data.failed_results || [];

    console.log(`Results: ${succeeded.length} Succeeded, ${failed.length} Failed\n`);

    console.log("✅ SUCCEEDED EXTRACTS:");
    for (const s of succeeded) {
      console.log(`  * [${(s.raw_content || "").length} chars] ${s.url}`);
    }

    console.log("\n❌ FAILED EXTRACTS:");
    for (const f of failed) {
      console.log(`  * [${f.error || "failed"}] ${f.url}`);
    }
  } catch (err) {
    console.error("Error calling Tavily Extract:", err);
  }
}

async function testWebMatchesOnDistinctiveSentences() {
  console.log("\n================================================================================");
  console.log("🔍 TESTING WEB MATCHES FOR 5 WORST OVERLAP ARTICLES (Tavily Search)");
  console.log("================================================================================");

  const targetSlugs = [
    "how-researchers-use-claude-scientific-discovery",
    "nvidia-halts-h200-exports-china",
    "claude-models-trained-on-protein-sequences-at-scale",
    "goldman-sachs-restricts-claude-code-to-engineers",
    "scaling-laws-quadrillion-parameter-models",
  ];

  const db = getDb();
  const targetPosts = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      contentMd: posts.contentMd,
    })
    .from(posts)
    .where(inArray(posts.slug, targetSlugs));

  const sourcesRows = await db.select().from(postSources);
  const primarySourcesByPostId = new Map<string, string>();
  for (const s of sourcesRows) {
    if (!primarySourcesByPostId.has(s.postId)) {
      primarySourcesByPostId.set(s.postId, s.url);
    }
  }

  for (const p of targetPosts) {
    const primaryUrl = primarySourcesByPostId.get(p.id) || "none";
    console.log(`\n📄 Article: "${p.title}" (${p.slug})`);
    console.log(`   Recorded Primary Source: ${primaryUrl}`);

    // Extract 2 distinctive body sentences (excluding headings, code, tables)
    const cleanLines = p.contentMd
      .split("\n")
      .map((l) => l.trim())
      .filter(
        (l) =>
          l.length > 60 &&
          !l.startsWith("#") &&
          !l.startsWith("|") &&
          !l.startsWith("```") &&
          !l.startsWith(">"),
      );

    const candidateSentences = cleanLines.slice(1, 3);

    for (let sIdx = 0; sIdx < candidateSentences.length; sIdx++) {
      const sentence = candidateSentences[sIdx];
      // Take first 120 chars for search query
      const query = sentence.replace(/[\[\]\(\)\*]/g, "").slice(0, 140).trim();
      console.log(`   🔎 Query sentence ${sIdx + 1}: "${query}"`);

      try {
        const res = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: apiKey,
            query: `"${query}"`, // Exact phrase search
            search_depth: "basic",
            max_results: 5,
          }),
        });

        if (res.ok) {
          const data = await res.json() as { results?: Array<{ title: string; url: string }> };
          const results = data.results || [];
          if (results.length === 0) {
            // Try unquoted search to see close semantic matches
            const broadRes = await fetch("https://api.tavily.com/search", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                api_key: apiKey,
                query: query,
                search_depth: "basic",
                max_results: 4,
              }),
            });
            const broadData = await broadRes.json() as { results?: Array<{ title: string; url: string }> };
            const broadResults = broadData.results || [];
            console.log(`      Found 0 exact quote matches. Top semantic matches on the web:`);
            broadResults.slice(0, 3).forEach((r) => {
              const isPrimary = primaryUrl && r.url.includes(new URL(primaryUrl).hostname.replace(/^www\./, ""));
              console.log(`      * [${isPrimary ? "PRIMARY DOMAIN" : "THIRD-PARTY WEB"}] ${r.title} -> ${r.url}`);
            });
          } else {
            console.log(`      ⚠️ Found ${results.length} EXACT matches on the web:`);
            results.forEach((r) => {
              const isPrimary = primaryUrl && r.url.includes(new URL(primaryUrl).hostname.replace(/^www\./, ""));
              console.log(`      * [${isPrimary ? "PRIMARY DOMAIN" : "THIRD-PARTY WEB"}] ${r.title} -> ${r.url}`);
            });
          }
        }
      } catch (err) {
        console.warn(`      Failed search: ${(err as Error).message}`);
      }
    }
  }
  console.log("================================================================================\n");
}

async function main() {
  await testTavilyExtract(failedUrls);
  await testWebMatchesOnDistinctiveSentences();
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
