import * as fs from "fs";
import * as path from "path";

interface PostRecord {
  id: string;
  slug: string;
  title: string;
  contentMd?: string;
  status?: string;
}

interface RepairProposal {
  slug: string;
  issueType: "nested_link" | "heading_link" | "blockquote_link" | "code_link" | "generic_one_word_anchor";
  beforeSnippet: string;
  afterSnippet: string;
}

const GENERIC_ANCHORS = new Set([
  "architecture",
  "training",
  "security",
  "inference",
  "gpu",
]);

function escapeCsvField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n") || field.includes("\r")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

async function run() {
  console.log("🔍 Scanning 81 posts for link anomalies and generating repair proposals...");

  const backupPath = path.resolve("backups/backup-2026-11-22T17-09-45-646Z.json");
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found at ${backupPath}`);
  }

  const rawData = fs.readFileSync(backupPath, "utf-8");
  const backup = JSON.parse(rawData);
  const posts: PostRecord[] = backup.tables?.posts || [];

  console.log(`Loaded ${posts.length} posts from backup.`);

  const proposals: RepairProposal[] = [];

  for (const post of posts) {
    if (!post.contentMd) continue;

    const lines = post.contentMd.split("\n");
    let inCodeBlock = false;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      let line = lines[lineIdx];
      const trimmed = line.trim();

      if (trimmed.startsWith("```")) {
        inCodeBlock = !inCodeBlock;
        continue;
      }

      // 1. Check code blocks if markdown links were injected inside
      if (inCodeBlock) {
        if (/\[([^\]]+)\]\([^\)]+\)/.test(line)) {
          const before = line;
          const after = line.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");
          proposals.push({
            slug: post.slug,
            issueType: "code_link",
            beforeSnippet: before.trim(),
            afterSnippet: after.trim(),
          });
        }
        continue;
      }

      // 2. Links inside headings (# ... [text](url))
      if (/^#{1,6}\s+/.test(trimmed) && /\[([^\]]+)\]\([^\)]+\)/.test(line)) {
        const before = line;
        const after = line.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");
        proposals.push({
          slug: post.slug,
          issueType: "heading_link",
          beforeSnippet: before.trim(),
          afterSnippet: after.trim(),
        });
        line = after;
      }

      // 3. Links inside blockquotes (> ... [text](url))
      if (/^>\s+/.test(trimmed) && /\[([^\]]+)\]\([^\)]+\)/.test(line)) {
        const before = line;
        const after = line.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");
        proposals.push({
          slug: post.slug,
          issueType: "blockquote_link",
          beforeSnippet: before.trim(),
          afterSnippet: after.trim(),
        });
        line = after;
      }

      // 4. Nested or malformed links: e.g. [A](/blog/[B](...)...) or ](/blog/...[...](...)
      if (/\]\([^)]*\[/.test(line) || /\[[^\]]*\[[^\]]+\]\([^)]+\)/.test(line)) {
        const before = line;
        // Clean out nested links by flattening inner links to plain text
        let repaired = line;
        while (/\]\([^)]*\[/.test(repaired) || /\[[^\]]*\[[^\]]+\]\([^)]+\)/.test(repaired)) {
          // Replace innermost [text](url) with just text when inside brackets or parens
          repaired = repaired.replace(/\[([^\]]+)\]\([^\)]+\)/g, (match, anchor) => {
            return anchor;
          });
        }
        proposals.push({
          slug: post.slug,
          issueType: "nested_link",
          beforeSnippet: before.trim(),
          afterSnippet: repaired.trim(),
        });
        line = repaired;
      }

      // 5. Generic one-word anchors pointing to unrelated posts: [architecture], [training], [security], [inference], [gpu]
      const genericRegex = /\[(architecture|training|security|inference|gpu)\]\(([^)]+)\)/gi;
      let genMatch: RegExpExecArray | null;
      while ((genMatch = genericRegex.exec(line)) !== null) {
        const matchedAnchor = genMatch[1];
        const matchedUrl = genMatch[2];
        const before = genMatch[0];
        const after = matchedAnchor; // strip link, restore plain word

        proposals.push({
          slug: post.slug,
          issueType: "generic_one_word_anchor",
          beforeSnippet: before,
          afterSnippet: after,
        });
      }
    }
  }

  // Write CSV proposal file
  const outDir = path.resolve("scripts/out");
  fs.mkdirSync(outDir, { recursive: true });
  const csvPath = path.join(outDir, "link-repair-proposal.csv");

  let csvContent = "slug,issue_type,before_snippet,after_snippet\n";
  for (const p of proposals) {
    csvContent += `${escapeCsvField(p.slug)},${escapeCsvField(p.issueType)},${escapeCsvField(p.beforeSnippet)},${escapeCsvField(p.afterSnippet)}\n`;
  }

  fs.writeFileSync(csvPath, csvContent, "utf-8");

  console.log(`\n================================================================================`);
  console.log(`✓ Generated Link Repair Proposal: ${csvPath}`);
  console.log(`  Total issues found across 81 posts: ${proposals.length}`);

  const counts: Record<string, number> = {};
  for (const p of proposals) {
    counts[p.issueType] = (counts[p.issueType] || 0) + 1;
  }
  for (const [k, v] of Object.entries(counts)) {
    console.log(`  - ${k}: ${v}`);
  }
  console.log(`================================================================================\n`);
}

run().catch((err) => {
  console.error("Error in propose-link-repairs:", err);
  process.exit(1);
});

