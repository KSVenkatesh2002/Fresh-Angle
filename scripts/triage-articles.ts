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

  const rows: BaselineRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const matches = line.match(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g);
    if (!matches) continue;
    const cols = matches.map((m) =>
      m.replace(/^,/, "").replace(/^"(.*)"$/, "$1").replace(/""/g, '"').trim(),
    );

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
        fetch_status: cols[cols.length - 1],
      });
    }
  }

  console.log(`Parsed ${rows.length} baseline articles directly from originality-baseline.csv.`);

  interface CategorizedArticle {
    slug: string;
    title: string;
    category: "Not Comparable" | "Keep" | "Regenerate" | "Noindex / High Risk";
    rule: string;
    overlap3Gram: number;
    overlap4Gram: number;
    overlap5Gram: number;
    maxRun: number;
    wordCount: number;
    fetchStatus: string;
  }

  const categorized: CategorizedArticle[] = rows.map((r) => {
    // Rule 1: Not Comparable (source unmeasured / unfetchable)
    if (r.fetch_status === "scrape_incomplete" || r.fetch_status !== "ok") {
      return {
        slug: r.slug,
        title: r.title,
        category: "Not Comparable",
        rule: "fetch_status === 'scrape_incomplete' (unfetchable or paywalled primary source)",
        overlap3Gram: r.overlap_3gram,
        overlap4Gram: r.overlap_4gram,
        overlap5Gram: r.overlap_5gram,
        maxRun: r.max_consecutive_words,
        wordCount: r.word_count,
        fetchStatus: r.fetch_status,
      };
    }

    // Rule 2: Keep (Low Risk, conforms to calibrated targets)
    if (r.overlap_3gram <= 6.0 && r.max_consecutive_words <= 8) {
      return {
        slug: r.slug,
        title: r.title,
        category: "Keep",
        rule: "fetch_status === 'ok' AND overlap_3gram <= 6.0% AND max_consecutive_words <= 8",
        overlap3Gram: r.overlap_3gram,
        overlap4Gram: r.overlap_4gram,
        overlap5Gram: r.overlap_5gram,
        maxRun: r.max_consecutive_words,
        wordCount: r.word_count,
        fetchStatus: r.fetch_status,
      };
    }

    // Rule 4: Noindex / High Risk (elevated phrase overlap or long word run)
    if (r.overlap_3gram > 12.0 || r.max_consecutive_words >= 15) {
      return {
        slug: r.slug,
        title: r.title,
        category: "Noindex / High Risk",
        rule: "fetch_status === 'ok' AND (overlap_3gram > 12.0% OR max_consecutive_words >= 15)",
        overlap3Gram: r.overlap_3gram,
        overlap4Gram: r.overlap_4gram,
        overlap5Gram: r.overlap_5gram,
        maxRun: r.max_consecutive_words,
        wordCount: r.word_count,
        fetchStatus: r.fetch_status,
      };
    }

    // Rule 3: Regenerate (Moderate Risk, phrase reuse above targets but under high-risk threshold)
    return {
      slug: r.slug,
      title: r.title,
      category: "Regenerate",
      rule: "fetch_status === 'ok' AND (overlap_3gram > 6.0% OR max_consecutive_words > 8) AND NOT (overlap_3gram > 12.0% OR max_consecutive_words >= 15)",
      overlap3Gram: r.overlap_3gram,
      overlap4Gram: r.overlap_4gram,
      overlap5Gram: r.overlap_5gram,
      maxRun: r.max_consecutive_words,
      wordCount: r.word_count,
      fetchStatus: r.fetch_status,
    };
  });

  const counts = {
    "Not Comparable": categorized.filter((c) => c.category === "Not Comparable").length,
    Keep: categorized.filter((c) => c.category === "Keep").length,
    Regenerate: categorized.filter((c) => c.category === "Regenerate").length,
    "Noindex / High Risk": categorized.filter((c) => c.category === "Noindex / High Risk").length,
  };

  fs.mkdirSync(path.resolve("scripts/out"), { recursive: true });

  // Output CSV
  let csvOut = "slug,title,category,rule,overlap_3gram_pct,overlap_4gram_pct,overlap_5gram_pct,max_run_words,word_count,fetch_status\n";
  categorized.forEach((c) => {
    const escapedTitle = `"${c.title.replace(/"/g, '""')}"`;
    const escapedRule = `"${c.rule.replace(/"/g, '""')}"`;
    csvOut += `"${c.slug}",${escapedTitle},"${c.category}",${escapedRule},${c.overlap3Gram}%,${c.overlap4Gram}%,${c.overlap5Gram}%,${c.maxRun},${c.wordCount},"${c.fetchStatus}"\n`;
  });

  const outCsvPath = path.resolve("scripts/out/triage.csv");
  fs.writeFileSync(outCsvPath, csvOut, "utf-8");
  console.log(`Saved triage CSV to ${outCsvPath}`);

  // Output Markdown summary
  let md = "# Article Originality Triage Proposals (Recomputed Empirical Baseline)\n\n";
  md += "> [!IMPORTANT]\n";
  md += "> **Proposal Only**: No database rows or posts have been updated, unpublished, or modified.\n";
  md += "> Recomputed strictly from `scripts/originality-baseline.csv` (81 articles total).\n\n";

  md += "## Category Rules & Distribution\n\n";
  md += "| Category | Empirical Rule | Count | Share |\n";
  md += "| :--- | :--- | :---: | :---: |\n";
  md += `| **Not Comparable** | \`fetch_status === 'scrape_incomplete'\` (unfetchable / paywalled primary source) | **${counts["Not Comparable"]}** | ${Math.round((counts["Not Comparable"] / rows.length) * 100)}% |\n`;
  md += `| **Keep** | \`fetch_status === 'ok'\` AND \`overlap_3gram <= 6.0%\` AND \`max_consecutive_words <= 8\` | **${counts.Keep}** | ${Math.round((counts.Keep / rows.length) * 100)}% |\n`;
  md += `| **Regenerate** | \`fetch_status === 'ok'\` AND (\`overlap_3gram > 6.0%\` OR \`max_consecutive_words > 8\`) AND NOT high risk | **${counts.Regenerate}** | ${Math.round((counts.Regenerate / rows.length) * 100)}% |\n`;
  md += `| **Noindex / High Risk** | \`fetch_status === 'ok'\` AND (\`overlap_3gram > 12.0%\` OR \`max_consecutive_words >= 15\`) | **${counts["Noindex / High Risk"]}** | ${Math.round((counts["Noindex / High Risk"] / rows.length) * 100)}% |\n`;
  md += `| **Total** | *All published articles in Fresh Angle database* | **${rows.length}** | **100%** |\n\n`;

  md += "## 5 Example Slugs per Category\n\n";

  const categories: Array<"Not Comparable" | "Keep" | "Regenerate" | "Noindex / High Risk"> = [
    "Not Comparable",
    "Keep",
    "Regenerate",
    "Noindex / High Risk",
  ];

  categories.forEach((cat) => {
    md += `### ${cat} (${counts[cat]} total)\n`;
    const samples = categorized.filter((c) => c.category === cat).slice(0, 5);
    samples.forEach((s, idx) => {
      if (cat === "Not Comparable") {
        md += `${idx + 1}. \`${s.slug}\` (Status: \`${s.fetchStatus}\`, Words: ${s.wordCount})\n`;
      } else {
        md += `${idx + 1}. \`${s.slug}\` (3-gram: ${s.overlap3Gram}%, 4-gram: ${s.overlap4Gram}%, Max Run: ${s.maxRun}w, Words: ${s.wordCount})\n`;
      }
    });
    md += "\n";
  });

  const outSummaryPath = path.resolve("scripts/out/triage-summary.md");
  fs.writeFileSync(outSummaryPath, md, "utf-8");
  console.log(`Saved triage summary to ${outSummaryPath}`);
}

run();
