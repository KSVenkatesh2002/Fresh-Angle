import * as fs from "fs";
import * as path from "path";

interface BaselineRow {
  slug: string;
  title: string;
  source_url: string;
  word_count: number;
  source_chars: number;
  overlap_3gram: number;
  overlap_4gram: number;
  overlap_5gram: number;
  max_consecutive_words: number;
  fetch_status: string;
}

function parsePercent(val: string): number {
  if (!val) return 0;
  return parseFloat(val.replace("%", "").trim()) || 0;
}

function run() {
  const csvPath = path.resolve("scripts/originality-baseline.csv");
  const rawCsv = fs.readFileSync(csvPath, "utf-8");
  const lines = rawCsv.split("\n").filter((l) => l.trim().length > 0);

  const header = lines[0];
  const rows: BaselineRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    // Regex to parse CSV considering quotes
    const match = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
    // Simple split for standard format
    const cols = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((c) => c.replace(/^"|"$/g, "").trim());
    if (cols.length >= 14) {
      rows.push({
        slug: cols[0],
        title: cols[1],
        source_url: cols[2],
        word_count: parseInt(cols[3], 10) || 0,
        source_chars: parseInt(cols[4], 10) || 0,
        overlap_3gram: parsePercent(cols[5]),
        overlap_4gram: parsePercent(cols[6]),
        overlap_5gram: parsePercent(cols[7]),
        max_consecutive_words: parseInt(cols[8], 10) || 0,
        fetch_status: cols[13],
      });
    }
  }

  console.log(`Parsed ${rows.length} baseline articles for triage.`);

  interface TriageResult {
    slug: string;
    title: string;
    riskScore: number;
    riskTier: "CRITICAL" | "HIGH" | "MODERATE" | "LOW";
    proposedAction: "keep" | "regenerate through new pipeline" | "noindex" | "unpublish";
    overlap3Gram: number;
    maxRun: number;
    wordCount: number;
    reason: string;
  }

  const results: TriageResult[] = rows.map((r) => {
    // Calculate composite risk score (0 to 100)
    let risk = 0;
    if (r.fetch_status !== "ok") {
      risk += 35; // unverified source text
    } else {
      risk += Math.min(40, r.overlap_3gram * 2.0);
      risk += Math.min(25, r.overlap_5gram * 4.0);
      risk += Math.min(25, (r.max_consecutive_words / 15) * 25);
    }

    if (r.word_count < 400) {
      risk += 20; // thin content risk
    }

    risk = Math.min(100, Math.round(risk));

    let riskTier: "CRITICAL" | "HIGH" | "MODERATE" | "LOW" = "LOW";
    if (risk >= 65) riskTier = "CRITICAL";
    else if (risk >= 45) riskTier = "HIGH";
    else if (risk >= 25) riskTier = "MODERATE";

    let proposedAction: "keep" | "regenerate through new pipeline" | "noindex" | "unpublish" = "keep";
    let reason = "Low overlap and clean prose; meets quality standards.";

    if (r.word_count < 280 && r.fetch_status !== "ok") {
      proposedAction = "unpublish";
      reason = "Extremely thin content (<280 words) and unverified source text.";
    } else if (r.fetch_status !== "ok" || r.word_count < 380) {
      proposedAction = "noindex";
      reason = "Thin content or paywalled/unfetchable primary source; prevent indexing until multi-source research gathered.";
    } else if (r.overlap_3gram > 5.0 || r.max_consecutive_words > 7 || risk >= 40) {
      proposedAction = "regenerate through new pipeline";
      reason = `Substantial phrase reuse (3-gram: ${r.overlap_3gram}%, max run: ${r.max_consecutive_words}w); high-value topic justifies multi-source regeneration.`;
    }

    return {
      slug: r.slug,
      title: r.title,
      riskScore: risk,
      riskTier,
      proposedAction,
      overlap3Gram: r.overlap_3gram,
      maxRun: r.max_consecutive_words,
      wordCount: r.word_count,
      reason,
    };
  });

  // Sort by risk descending
  results.sort((a, b) => b.riskScore - a.riskScore);

  fs.mkdirSync(path.resolve("scripts/out"), { recursive: true });

  // Write triage.csv
  let csvOut = "rank,slug,title,risk_score,risk_tier,proposed_action,3gram_overlap_pct,max_run_words,word_count,reason\n";
  results.forEach((res, idx) => {
    const escapedTitle = `"${res.title.replace(/"/g, '""')}"`;
    const escapedReason = `"${res.reason.replace(/"/g, '""')}"`;
    csvOut += `${idx + 1},"${res.slug}",${escapedTitle},${res.riskScore},${res.riskTier},"${res.proposedAction}",${res.overlap3Gram}%,${res.maxRun},${res.wordCount},${escapedReason}\n`;
  });

  const triageCsvPath = path.resolve("scripts/out/triage.csv");
  fs.writeFileSync(triageCsvPath, csvOut, "utf-8");
  console.log(`Saved triage CSV to ${triageCsvPath}`);

  // Summary counts
  const actionCounts = {
    keep: results.filter((r) => r.proposedAction === "keep").length,
    "regenerate through new pipeline": results.filter((r) => r.proposedAction === "regenerate through new pipeline").length,
    noindex: results.filter((r) => r.proposedAction === "noindex").length,
    unpublish: results.filter((r) => r.proposedAction === "unpublish").length,
  };

  let mdOut = "# Existing 81 Articles Risk & Originality Triage Proposals\n\n";
  mdOut += `> [!IMPORTANT]\n`;
  mdOut += `> **Proposal Only**: No automated modifications, unpublishing, or deletions have been executed.\n\n`;
  mdOut += `## Action Breakdown\n`;
  mdOut += `- **Keep:** ${actionCounts.keep} articles (${Math.round((actionCounts.keep / results.length) * 100)}%)\n`;
  mdOut += `- **Regenerate through New Pipeline:** ${actionCounts["regenerate through new pipeline"]} articles (${Math.round((actionCounts["regenerate through new pipeline"] / results.length) * 100)}%)\n`;
  mdOut += `- **Noindex:** ${actionCounts.noindex} articles (${Math.round((actionCounts.noindex / results.length) * 100)}%)\n`;
  mdOut += `- **Unpublish:** ${actionCounts.unpublish} articles (${Math.round((actionCounts.unpublish / results.length) * 100)}%)\n\n`;

  mdOut += `## Top 20 Highest-Risk Articles\n\n`;
  mdOut += `| Rank | Post Slug | Risk Tier | Score | 3-Gram % | Max Run | Proposed Action | Rationale |\n`;
  mdOut += `| :-: | :--- | :---: | :---: | :---: | :---: | :---: | :--- |\n`;

  results.slice(0, 20).forEach((r, idx) => {
    mdOut += `| ${idx + 1} | \`${r.slug}\` | **${r.riskTier}** | ${r.riskScore}/100 | ${r.overlap3Gram}% | ${r.maxRun}w | \`${r.proposedAction}\` | ${r.reason} |\n`;
  });

  const summaryMdPath = path.resolve("scripts/out/triage-summary.md");
  fs.writeFileSync(summaryMdPath, mdOut, "utf-8");
  console.log(`Saved triage summary markdown to ${summaryMdPath}`);
}

run();
