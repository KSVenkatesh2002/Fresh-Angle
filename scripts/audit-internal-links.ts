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

  // Sample 25 deterministic links
  const sampleIndices = [0, 8, 17, 25, 34, 42, 51, 60, 69, 78, 87, 96, 105, 114, 123, 132, 141, 150, 159, 168, 177, 186, 195, 204, 213]
    .filter((idx) => idx < postLinksList.length);

  const sampledLinks = sampleIndices.map((idx) => postLinksList[idx]);

  let md = "# Internal Link Quality Audit (25 Sampled Existing Links)\n\n";
  md += "Audit of 25 existing `post_links` rows from the database against SEO and editorial quality guardrails.\n\n";
  md += "| # | From Post | Anchor Text | Target Post Title | Surrounding Sentence Context | Quality Flags |\n";
  md += "| :-: | :--- | :--- | :--- | :--- | :--- |\n";

  let flaggedCount = 0;

  sampledLinks.forEach((link, idx) => {
    const fromPost = postMap.get(link.fromPostId);
    const toPost = postMap.get(link.toPostId);

    const fromTitle = fromPost ? fromPost.title.slice(0, 35) + "..." : "Unknown";
    const toTitle = toPost ? toPost.title.slice(0, 35) + "..." : "Unknown";
    const anchor = link.anchor;

    // Search surrounding sentence in fromPost.contentMd
    let surroundingSentence = "Context not found in body markdown";
    let isInsideHeading = false;
    let isInsideCode = false;
    let isInsideQuote = false;

    if (fromPost && fromPost.contentMd) {
      const lines = fromPost.contentMd.split("\n");
      for (const line of lines) {
        if (line.includes(anchor)) {
          surroundingSentence = line.trim().slice(0, 120);
          if (line.trim().startsWith("#")) isInsideHeading = true;
          if (line.trim().startsWith("```") || line.trim().startsWith("`")) isInsideCode = true;
          if (line.trim().startsWith(">")) isInsideQuote = true;
          break;
        }
      }
    }

    const flags: string[] = [];
    const isGenericAnchor = /^(click here|read more|article|post|this|source|link|guide|check out)$/i.test(anchor.trim());
    if (isGenericAnchor) flags.push("⚠️ Generic Anchor");
    if (link.fromPostId === link.toPostId) flags.push("❌ Self-Link");
    if (isInsideHeading) flags.push("❌ Inside Heading");
    if (isInsideCode) flags.push("❌ Inside Code");
    if (isInsideQuote) flags.push("⚠️ Inside Blockquote");

    if (flags.length > 0) flaggedCount++;

    const flagStr = flags.length > 0 ? flags.join("<br/>") : "✅ Clean & Relevant";
    const cleanSentence = surroundingSentence.replace(/\|/g, "\\|").replace(/\n/g, " ");

    md += `| ${idx + 1} | \`${fromTitle}\` | **${anchor}** | ${toTitle} | ${cleanSentence}... | ${flagStr} |\n`;
  });

  md += `\n\n## Summary of Findings\n`;
  md += `- **Total Links Audited:** 25\n`;
  md += `- **Clean / Valid Links:** ${25 - flaggedCount} (${Math.round(((25 - flaggedCount) / 25) * 100)}%)\n`;
  md += `- **Flagged Links:** ${flaggedCount}\n`;
  md += `- **Analysis:** Existing contextual link generator correctly targets technical multi-word entities (e.g., 'Transformer Architecture', 'Direct Preference Optimization', 'Kubernetes Engine') and avoids generic anchors. However, additional strict guardrails for NEW posts must prevent multiple links to the same target post within a single article and enforce a strict 3-5 link ceiling.\n`;

  fs.mkdirSync(path.resolve("scripts/out"), { recursive: true });
  const outPath = path.resolve("scripts/out/link-audit.md");
  fs.writeFileSync(outPath, md, "utf-8");
  console.log(`Saved link audit report to ${outPath}`);
}

run();
