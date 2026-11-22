import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import * as fs from "fs";
import * as path from "path";

const apiKey = process.env.TAVILY_API_KEY;

if (!apiKey) {
  console.error("❌ TAVILY_API_KEY is missing from environment.");
  process.exit(1);
}

const urls = [
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

async function run() {
  console.log("Calling Tavily Extract (https://api.tavily.com/extract) for 13 URLs...\n");
  fs.mkdirSync(path.resolve("scripts/out"), { recursive: true });

  const results: Array<{
    url: string;
    success: boolean;
    chars: number;
    usability: "usable full text" | "not comparable (paywall / teaser)" | "not comparable (stub / failed)";
    first100: string;
    error?: string;
  }> = [];

  for (const url of urls) {
    try {
      const res = await fetch("https://api.tavily.com/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          urls: [url],
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        results.push({
          url,
          success: false,
          chars: 0,
          usability: "not comparable (stub / failed)",
          first100: "",
          error: `HTTP ${res.status}: ${txt.slice(0, 100)}`,
        });
        continue;
      }

      const data = (await res.json()) as {
        results?: Array<{ url: string; raw_content?: string }>;
        failed_results?: Array<{ url: string; error?: string }>;
      };

      const item = data.results?.find((r) => r.url === url);
      const fail = data.failed_results?.find((f) => f.url === url);

      if (item && item.raw_content && item.raw_content.length >= 1200) {
        results.push({
          url,
          success: true,
          chars: item.raw_content.length,
          usability: "usable full text",
          first100: item.raw_content.replace(/\s+/g, " ").trim().slice(0, 100),
        });
      } else if (item && item.raw_content && item.raw_content.length > 0) {
        const textSample = item.raw_content.toLowerCase();
        const isPaywall =
          textSample.includes("subscribe") ||
          textSample.includes("subscription") ||
          textSample.includes("sign in to read") ||
          textSample.includes("paywall");
        results.push({
          url,
          success: true,
          chars: item.raw_content.length,
          usability: isPaywall ? "not comparable (paywall / teaser)" : "not comparable (stub / failed)",
          first100: item.raw_content.replace(/\s+/g, " ").trim().slice(0, 100),
          error: isPaywall ? "Subscription/Paywall teaser" : "Insufficient body text (<1200 chars)",
        });
      } else {
        results.push({
          url,
          success: false,
          chars: 0,
          usability: "not comparable (stub / failed)",
          first100: "",
          error: fail?.error || "Empty response from extract endpoint",
        });
      }
    } catch (err) {
      results.push({
        url,
        success: false,
        chars: 0,
        usability: "not comparable (stub / failed)",
        first100: "",
        error: (err as Error).message,
      });
    }
  }

  const rawOutPath = path.resolve("scripts/out/tavily-extract-raw.json");
  fs.writeFileSync(rawOutPath, JSON.stringify(results, null, 2), "utf-8");
  console.log(`Saved raw JSON output to ${rawOutPath}`);

  let md = "# Tavily Extract Verification Across 13 Unfetchable URLs\n\n";
  md += "| URL | Status | Characters | Usability Label | First 100 Chars / Error |\n";
  md += "| :--- | :---: | :---: | :---: | :--- |\n";
  for (const r of results) {
    const detail = r.success ? r.first100.replace(/\|/g, "\\|") : `ERR: ${r.error?.replace(/\|/g, "\\|")}`;
    md += `| \`${r.url}\` | ${r.success ? "SUCCESS" : "FAILED"} | ${r.chars.toLocaleString()} | **${r.usability}** | ${detail} |\n`;
  }
  const reportPath = path.resolve("scripts/out/tavily-extract-report.md");
  fs.writeFileSync(reportPath, md, "utf-8");
  console.log(`Saved markdown report to ${reportPath}\n`);
  console.log(md);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

run();
