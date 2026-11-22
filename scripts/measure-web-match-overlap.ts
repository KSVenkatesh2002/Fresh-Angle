import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import * as fs from "fs";
import * as path from "path";
import * as cheerio from "cheerio";

const apiKey = process.env.TAVILY_API_KEY;

if (!apiKey) {
  console.error("❌ TAVILY_API_KEY missing");
  process.exit(1);
}

function cleanDraftTextForBaseline(contentMd: string): string {
  if (!contentMd) return "";
  return contentMd
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]+`/g, " ")
    .replace(/^[ \t]*>.*$/gm, " ")
    .replace(/^[ \t]*\|.*\|[ \t]*$/gm, " ")
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/https?:\/\/[^\s\)]+/g, " ")
    .replace(/^[ \t]*#{1,6}\s+.*$/gm, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getWordTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function getNGramShingles(words: string[], k: number): Set<string> {
  const shingles = new Set<string>();
  if (words.length < k) {
    if (words.length > 0) shingles.add(words.join(" "));
    return shingles;
  }
  for (let i = 0; i <= words.length - k; i++) {
    shingles.add(words.slice(i, i + k).join(" "));
  }
  return shingles;
}

function computeOverlap(postShingles: Set<string>, sourceShingles: Set<string>): number {
  if (postShingles.size === 0) return 0;
  let matches = 0;
  for (const s of postShingles) {
    if (sourceShingles.has(s)) matches++;
  }
  return matches / postShingles.size;
}

function findMaxConsecutiveMatchingWords(postWords: string[], sourceWords: string[]): number {
  if (postWords.length === 0 || sourceWords.length === 0) return 0;
  const sourceWordPositions = new Map<string, number[]>();
  for (let j = 0; j < sourceWords.length; j++) {
    const w = sourceWords[j];
    const list = sourceWordPositions.get(w);
    if (list) {
      list.push(j);
    } else {
      sourceWordPositions.set(w, [j]);
    }
  }

  let maxLen = 0;
  for (let i = 0; i < postWords.length; i++) {
    if (postWords.length - i <= maxLen) break;
    const w = postWords[i];
    const positions = sourceWordPositions.get(w);
    if (!positions) continue;

    for (const j of positions) {
      let len = 0;
      while (
        i + len < postWords.length &&
        j + len < sourceWords.length &&
        postWords[i + len] === sourceWords[j + len]
      ) {
        len++;
      }
      if (len > maxLen) {
        maxLen = len;
      }
    }
  }
  return maxLen;
}

async function quickFetchText(url: string): Promise<string> {
  if (url.endsWith(".pdf")) return "";
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(4000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) return "";
    const html = await res.text();
    const $ = cheerio.load(html);
    $("script, style, nav, footer, header, noscript, svg").remove();
    const text = $("p, article, main, h1, h2, h3").text().replace(/\s+/g, " ").trim();
    return text.length > 100 ? text : "";
  } catch {
    return "";
  }
}

const targetSlugs = [
  "how-researchers-use-claude-scientific-discovery",
  "nvidia-halts-h200-exports-china",
  "claude-models-trained-on-protein-sequences-at-scale",
  "goldman-sachs-restricts-claude-code-to-engineers",
  "scaling-laws-quadrillion-parameter-models",
];

async function run() {
  const backupPath = path.resolve("backups/backup-2026-11-22T17-09-45-646Z.json");
  const backupData = JSON.parse(fs.readFileSync(backupPath, "utf-8"));

  const targetPosts = (backupData.tables?.posts || []).filter((p: any) => targetSlugs.includes(p.slug));
  const primarySourcesByPostId = new Map<string, string>();
  for (const s of backupData.tables?.postSources || []) {
    if (!primarySourcesByPostId.has(s.postId)) {
      primarySourcesByPostId.set(s.postId, s.url);
    }
  }

  console.log("================================================================================");
  console.log("🔬 MEASURING REAL N-GRAM OVERLAP & MAX RUN AGAINST TOP 3 MATCHED WEB PAGES");
  console.log("================================================================================\n");

  const resultsTable: any[] = [];

  for (const p of targetPosts) {
    const primaryUrl = primarySourcesByPostId.get(p.id) || "none";
    let primaryHost = "";
    try {
      if (primaryUrl !== "none") primaryHost = new URL(primaryUrl).hostname.replace(/^www\./, "").toLowerCase();
    } catch {}

    const cleanedDraft = cleanDraftTextForBaseline(p.contentMd);
    const draftWords = getWordTokens(cleanedDraft);
    const draft3Grams = getNGramShingles(draftWords, 3);
    const draft4Grams = getNGramShingles(draftWords, 4);
    const draft5Grams = getNGramShingles(draftWords, 5);

    console.log(`\n📄 Post: "${p.title}" (${p.slug})`);
    console.log(`   Cleaned draft tokens: ${draftWords.length} words`);
    console.log(`   Primary Source URL: ${primaryUrl}`);

    // Take distinctive sentence to search
    const sentences = p.contentMd
      .split("\n")
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 70 && !l.startsWith("#") && !l.startsWith("|") && !l.startsWith("`"))
      .slice(1, 3);

    const query = sentences[0]?.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1").slice(0, 80) || p.title;

    let searchResults: Array<{ title: string; url: string }> = [];
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query: `"${query.slice(0, 65)}"`,
          search_depth: "basic",
          max_results: 5,
        }),
      });

      const data = (await res.json()) as { results?: Array<{ title: string; url: string }> };
      searchResults = data.results || [];
      if (searchResults.length === 0) {
        const broad = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: apiKey,
            query,
            search_depth: "basic",
            max_results: 5,
          }),
        });
        const broadData = (await broad.json()) as { results?: Array<{ title: string; url: string }> };
        searchResults = broadData.results || [];
      }
    } catch (err) {
      console.warn(`Search error: ${(err as Error).message}`);
    }

    const thirdPartyResults = searchResults
      .filter((r) => {
        try {
          const h = new URL(r.url).hostname.replace(/^www\./, "").toLowerCase();
          return primaryHost ? !h.includes(primaryHost) : true;
        } catch {
          return false;
        }
      })
      .slice(0, 3);

    console.log(`   Top ${thirdPartyResults.length} third-party pages analyzed:`);

    for (let idx = 0; idx < thirdPartyResults.length; idx++) {
      const hit = thirdPartyResults[idx];
      const pageText = await quickFetchText(hit.url);

      if (!pageText) {
        console.log(`   [Hit ${idx + 1}] ${hit.title} (${hit.url}) -> Could not fetch text (HTTP/Paywall/PDF)`);
        resultsTable.push({
          postSlug: p.slug,
          postTitle: p.title,
          hitTitle: hit.title,
          hitUrl: hit.url,
          wordsFetched: 0,
          overlap3: null,
          overlap4: null,
          overlap5: null,
          maxRun: null,
          status: "Not Comparable (Paywall / Blocked / Unfetchable)",
        });
        continue;
      }

      const hitWords = getWordTokens(pageText);
      const hit3Grams = getNGramShingles(hitWords, 3);
      const hit4Grams = getNGramShingles(hitWords, 4);
      const hit5Grams = getNGramShingles(hitWords, 5);

      const overlap3 = computeOverlap(draft3Grams, hit3Grams) * 100;
      const overlap4 = computeOverlap(draft4Grams, hit4Grams) * 100;
      const overlap5 = computeOverlap(draft5Grams, hit5Grams) * 100;
      const maxRun = findMaxConsecutiveMatchingWords(draftWords, hitWords);

      console.log(`   [Hit ${idx + 1}] ${hit.title}`);
      console.log(`       URL: ${hit.url} (${hitWords.length} words fetched)`);
      console.log(`       Measured Overlap: 3-gram: ${overlap3.toFixed(2)}%, 4-gram: ${overlap4.toFixed(2)}%, 5-gram: ${overlap5.toFixed(2)}%`);
      console.log(`       Max Consecutive Matching Words: ${maxRun} words`);

      resultsTable.push({
        postSlug: p.slug,
        postTitle: p.title,
        hitTitle: hit.title,
        hitUrl: hit.url,
        wordsFetched: hitWords.length,
        overlap3: Number(overlap3.toFixed(2)),
        overlap4: Number(overlap4.toFixed(2)),
        overlap5: Number(overlap5.toFixed(2)),
        maxRun,
        status: "Measured",
      });
    }
  }

  fs.mkdirSync(path.resolve("scripts/out"), { recursive: true });
  const rawPath = path.resolve("scripts/out/web-match-overlap-raw.json");
  fs.writeFileSync(rawPath, JSON.stringify(resultsTable, null, 2), "utf-8");
  console.log(`Saved raw JSON output to ${rawPath}`);

  let md = "# Web Match Overlap Measurement (Top 3 Third-Party Hits per Worst Post)\n\n";
  md += "| Post Slug | Matched Third-Party Title & URL | 3-Gram | 4-Gram | 5-Gram | Max Run | Status |\n";
  md += "| :--- | :--- | :---: | :---: | :---: | :---: | :--- |\n";
  for (const r of resultsTable) {
    const o3 = r.overlap3 === null ? "N/A" : `${r.overlap3.toFixed(2)}%`;
    const o4 = r.overlap4 === null ? "N/A" : `${r.overlap4.toFixed(2)}%`;
    const o5 = r.overlap5 === null ? "N/A" : `${r.overlap5.toFixed(2)}%`;
    const mr = r.maxRun === null ? "N/A" : `${r.maxRun} words`;
    const link = `[${r.hitTitle.replace(/\|/g, "\\|")}](${r.hitUrl})`;
    md += `| \`${r.postSlug}\` | ${link} | ${o3} | ${o4} | ${o5} | ${mr} | **${r.status}** |\n`;
  }
  const reportPath = path.resolve("scripts/out/web-match-overlap-report.md");
  fs.writeFileSync(reportPath, md, "utf-8");
  console.log(`Saved markdown report to ${reportPath}\n`);
  console.log(md);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
