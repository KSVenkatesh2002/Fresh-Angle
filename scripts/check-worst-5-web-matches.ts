import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import { getDb } from "../src/db/client";
import { posts, postSources } from "../src/db/schema";
import { inArray } from "drizzle-orm";

const apiKey = process.env.TAVILY_API_KEY;

if (!apiKey) {
  console.error("❌ TAVILY_API_KEY is missing from environment.");
  process.exit(1);
}

const targetSlugs = [
  "how-researchers-use-claude-scientific-discovery",
  "nvidia-halts-h200-exports-china",
  "claude-models-trained-on-protein-sequences-at-scale",
  "goldman-sachs-restricts-claude-code-to-engineers",
  "scaling-laws-quadrillion-parameter-models",
];

async function run() {
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

  const report: any[] = [];

  for (const p of targetPosts) {
    const primaryUrl = primarySourcesByPostId.get(p.id) || "none";
    let primaryHost = "";
    try {
      if (primaryUrl !== "none") {
        primaryHost = new URL(primaryUrl).hostname.replace(/^www\./, "").toLowerCase();
      }
    } catch {}

    // Extract distinctive sentences (length > 70 chars, plain text paragraph)
    const sentences = p.contentMd
      .split("\n")
      .map((l) => l.trim())
      .filter(
        (l) =>
          l.length > 70 &&
          !l.startsWith("#") &&
          !l.startsWith("|") &&
          !l.startsWith("```") &&
          !l.startsWith(">") &&
          !l.startsWith("-") &&
          !l.startsWith("*")
      )
      .slice(1, 4); // Take 3 distinctive sentences

    const sentenceChecks: any[] = [];

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      // Clean markdown links / asterisks
      const cleanSentence = sentence.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1").replace(/[*_`]/g, "").trim();
      const query = cleanSentence.slice(0, 120);

      // Search exact quote or top phrase
      try {
        const res = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: apiKey,
            query: `"${query.slice(0, 80)}"`,
            search_depth: "basic",
            max_results: 5,
          }),
        });

        const data = await res.json() as { results?: Array<{ title: string; url: string }> };
        let results = data.results || [];

        // If exact quote yielded 0, search without quotes to see syndicated and semantic web matches
        let isExact = true;
        if (results.length === 0) {
          isExact = false;
          const broadRes = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              api_key: apiKey,
              query: query,
              search_depth: "basic",
              max_results: 5,
            }),
          });
          const broadData = await broadRes.json() as { results?: Array<{ title: string; url: string }> };
          results = broadData.results || [];
        }

        const matches = results.map((r) => {
          let host = "";
          try {
            host = new URL(r.url).hostname.replace(/^www\./, "").toLowerCase();
          } catch {}
          return {
            title: r.title,
            url: r.url,
            domain: host,
            isPrimarySourceDomain: primaryHost ? host.includes(primaryHost) : false,
          };
        });

        sentenceChecks.push({
          sentence: cleanSentence.slice(0, 100) + "...",
          queryUsed: query.slice(0, 80),
          isExactMatch: isExact,
          matchCount: matches.length,
          matches,
        });
      } catch (err) {
        sentenceChecks.push({
          sentence: cleanSentence.slice(0, 100) + "...",
          error: (err as Error).message,
        });
      }
    }

    report.push({
      postSlug: p.slug,
      postTitle: p.title,
      primaryUrl,
      primaryHost,
      sentenceChecks,
    });
  }

  console.log(JSON.stringify(report, null, 2));
}

run();
