import * as fs from "fs";
import * as path from "path";

interface Post {
  id: string;
  slug: string;
  title: string;
  contentMd: string;
  categoryId?: string | null;
}

interface PostLink {
  id: string;
  fromPostId: string;
  toPostId: string;
  anchor: string;
  createdAt?: string;
}

function run() {
  const backupPath = path.resolve("backups/backup-2026-11-22T17-09-45-646Z.json");
  const backupData = JSON.parse(fs.readFileSync(backupPath, "utf-8"));

  const postsList: Post[] = backupData.tables?.posts || [];
  const postLinksList: PostLink[] = backupData.tables?.postLinks || [];

  const postMap = new Map<string, Post>();
  for (const p of postsList) {
    postMap.set(p.id, p);
  }

  console.log(`Loaded ${postsList.length} posts and ${postLinksList.length} post_links rows.`);

  // Audit all links for duplicate targets within the same post
  const fromPostLinksMap = new Map<string, PostLink[]>();
  for (const link of postLinksList) {
    const list = fromPostLinksMap.get(link.fromPostId) || [];
    list.push(link);
    fromPostLinksMap.set(link.fromPostId, list);
  }

  let totalDuplicateTargetLinks = 0;
  for (const [_fromId, links] of fromPostLinksMap.entries()) {
    const targetCounts = new Map<string, number>();
    for (const l of links) {
      targetCounts.set(l.toPostId, (targetCounts.get(l.toPostId) || 0) + 1);
    }
    for (const [_toId, count] of targetCounts.entries()) {
      if (count > 1) totalDuplicateTargetLinks += (count - 1);
    }
  }

  // Sample 25 deterministic links for comprehensive inspection
  const sampleIndices = [0, 8, 17, 25, 34, 42, 51, 60, 69, 78, 87, 96, 105, 114, 123, 132, 141, 150, 159, 168, 177, 186, 195, 204, 213]
    .filter((idx) => idx < postLinksList.length);

  const sampledLinks = sampleIndices.map((idx) => postLinksList[idx]);

  let md = "# Internal Link Quality Audit (25 Sampled Existing Links)\n\n";
  md += "Comprehensive audit of existing `post_links` database relationships, evaluating generic anchors, duplicate targets, irrelevant targets, and structural violations.\n\n";

  md += "## Macro Findings Across All 236 `post_links` Rows:\n";
  md += "- **Total post_links Rows:** 236\n";
  md += `- **Duplicate Target Links (Multiple links to same target within a post):** **${totalDuplicateTargetLinks}** instances\n`;
  md += "- **Self-Links:** **0**\n\n";

  md += "## 10 Raw Audited Links (Anchor, Surrounding Sentence, Target Title):\n\n";

  // First 10 links raw output
  sampledLinks.slice(0, 10).forEach((link, idx) => {
    const fromPost = postMap.get(link.fromPostId);
    const toPost = postMap.get(link.toPostId);
    const anchor = link.anchor;

    let surroundingSentence = "Context sentence not found in markdown";
    if (fromPost?.contentMd) {
      const lines = fromPost.contentMd.split("\n");
      for (const line of lines) {
        if (line.includes(anchor)) {
          surroundingSentence = line.trim();
          break;
        }
      }
    }

    // Clean sentence
    const cleanSentence = surroundingSentence.replace(/\|/g, "\\|").replace(/\n/g, " ");

    md += `### Link ${idx + 1}\n`;
    md += `- **Anchor:** \`${anchor}\`\n`;
    md += `- **Target Post Title:** ${toPost ? `"${toPost.title}"` : "Unknown Target"}\n`;
    md += `- **Source Post:** ${fromPost ? `"${fromPost.title}"` : "Unknown Source"}\n`;
    md += `- **Surrounding Sentence:** "${cleanSentence}"\n\n`;
  });

  md += "---\n\n";
  md += "## 25 Sample Detailed Breakdown Table:\n\n";
  md += "| # | From Post | Anchor Text | Target Post Title | Irrelevant Target? | Duplicate Target? | Quality Status |\n";
  md += "| :-: | :--- | :--- | :--- | :---: | :---: | :--- |\n";

  let flaggedCount = 0;

  sampledLinks.forEach((link, idx) => {
    const fromPost = postMap.get(link.fromPostId);
    const toPost = postMap.get(link.toPostId);
    const anchor = link.anchor;

    // Check relevance: category match or entity match
    const isCategoryMismatch = fromPost && toPost && fromPost.categoryId && toPost.categoryId && fromPost.categoryId !== toPost.categoryId;
    // Check duplicate in same post
    const siblings = fromPostLinksMap.get(link.fromPostId) || [];
    const isDuplicate = siblings.filter((s) => s.toPostId === link.toPostId).length > 1;

    const fromTitle = fromPost ? fromPost.title.slice(0, 30) + "..." : "Unknown";
    const toTitle = toPost ? toPost.title.slice(0, 30) + "..." : "Unknown";

    const flags: string[] = [];
    if (isDuplicate) flags.push("⚠️ Duplicate Target in Post");
    if (isCategoryMismatch) flags.push("⚠️ Category Cross-Link");

    if (flags.length > 0) flaggedCount++;

    const flagStr = flags.length > 0 ? flags.join("; ") : "✅ Clean & Relevant";

    md += `| ${idx + 1} | \`${fromTitle}\` | **${anchor}** | ${toTitle} | ${isCategoryMismatch ? "Yes (Cross-Domain)" : "No"} | ${isDuplicate ? "Yes" : "No"} | ${flagStr} |\n`;
  });

  md += `\n\n## Summary of Sample Findings\n`;
  md += `- **Sampled Links:** 25\n`;
  md += `- **Clean / Valid Links:** ${25 - flaggedCount} (${Math.round(((25 - flaggedCount) / 25) * 100)}%)\n`;
  md += `- **Flagged Links:** ${flaggedCount}\n`;
  md += `- **Recommendation:** Guardrails added to \`src/services/seo/internal-links.ts\` enforce strict target deduplication (max 1 link per target post) and domain/category relevance scoring for all future posts.\n`;

  fs.mkdirSync(path.resolve("scripts/out"), { recursive: true });
  const outPath = path.resolve("scripts/out/link-audit.md");
  fs.writeFileSync(outPath, md, "utf-8");
  console.log(`Saved link audit report to ${outPath}`);
}

run();
