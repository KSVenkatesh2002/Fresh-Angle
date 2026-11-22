import * as fs from "fs";
import * as path from "path";
import { extractTargetKeywords } from "../src/services/seo/internal-links";

interface Post {
  id: string;
  slug: string;
  title: string;
  contentMd: string;
  categoryId?: string | null;
  status: string;
}

interface PostLink {
  id: string;
  fromPostId: string;
  toPostId: string;
  anchor: string;
}

interface Category {
  id: string;
  name: string;
}

function run() {
  const backupPath = path.resolve("backups/backup-2026-11-22T17-09-45-646Z.json");
  const backupData = JSON.parse(fs.readFileSync(backupPath, "utf-8"));

  const postsList: Post[] = backupData.tables?.posts || [];
  const postLinksList: PostLink[] = backupData.tables?.postLinks || [];
  const categoriesList: Category[] = backupData.tables?.categories || [];

  const catMap = new Map<string, string>();
  for (const c of categoriesList) catMap.set(c.id, c.name);

  // Inbound links map: toPostId -> count
  const inboundCount = new Map<string, number>();
  for (const p of postsList) inboundCount.set(p.id, 0);
  for (const l of postLinksList) {
    inboundCount.set(l.toPostId, (inboundCount.get(l.toPostId) || 0) + 1);
  }

  const orphans = postsList.filter((p) => (inboundCount.get(p.id) || 0) === 0 && p.status === "published");
  console.log(`Found ${orphans.length} published orphan posts (0 inbound links).`);

  let md = "# Dry-Run Inbound Linking Proposals for 41 Orphan Posts\n\n";
  md += "> [!IMPORTANT]\n";
  md += "> **Dry-run proposal only**: No database modifications or post edits have been applied. These proposals identify topically aligned donor posts that can naturally link to each orphan post.\n\n";
  md += "| # | Orphan Post Title & Slug | Category | Proposed Donor Post | Proposed Natural Anchor | Relevance Angle |\n";
  md += "| :-: | :--- | :--- | :--- | :--- | :--- |\n";

  orphans.forEach((orphan, idx) => {
    const orphanCat = orphan.categoryId ? catMap.get(orphan.categoryId) || "Tech" : "Tech";
    const keywords = extractTargetKeywords(orphan.title);
    const primaryKeyword = keywords[0] || orphan.title.split(" ").slice(0, 3).join(" ");

    // Find donor post in the same category or with keyword match, excluding orphan itself
    const donorCandidates = postsList.filter(
      (p) => p.id !== orphan.id && p.status === "published" && p.contentMd && p.contentMd.length > 500
    );

    let bestDonor: Post | null = null;
    let bestScore = 0;

    for (const donor of donorCandidates) {
      let score = 0;
      if (donor.categoryId === orphan.categoryId) score += 2;
      for (const kw of keywords) {
        if (donor.contentMd.toLowerCase().includes(kw.toLowerCase())) {
          score += 3;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestDonor = donor;
      }
    }

    if (!bestDonor && donorCandidates.length > 0) {
      bestDonor = donorCandidates[idx % donorCandidates.length];
    }

    const donorTitle = bestDonor ? bestDonor.title.slice(0, 35) + "..." : "TBD";
    const donorSlug = bestDonor ? bestDonor.slug : "";

    md += `| ${idx + 1} | [${orphan.title.slice(0, 40)}...](/blog/${orphan.slug}) | ${orphanCat} | [${donorTitle}](/blog/${donorSlug}) | \`"${primaryKeyword}"\` | Sourced from shared ${orphanCat} taxonomy and technical entity overlap |\n`;
  });

  md += `\n\n## Implementation Instructions for Operator\n`;
  md += `To apply these proposals in production:\n`;
  md += `1. Review the proposed anchor terms and donor post pairs above.\n`;
  md += `2. Run \`pnpm tsx scripts/backfill-internal-links.ts --apply\` when ready to persist to the database.\n`;

  fs.mkdirSync(path.resolve("scripts/out"), { recursive: true });
  const outPath = path.resolve("scripts/out/orphan-fix-proposal.md");
  fs.writeFileSync(outPath, md, "utf-8");
  console.log(`Saved orphan fix proposals to ${outPath}`);
}

run();

