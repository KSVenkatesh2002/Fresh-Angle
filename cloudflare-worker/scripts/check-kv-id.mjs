#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const wranglerJsoncPath = path.resolve(__dirname, "../wrangler.jsonc");

if (!fs.existsSync(wranglerJsoncPath)) {
  console.error(`❌ [Deployment Error] Missing wrangler.jsonc at: ${wranglerJsoncPath}`);
  process.exit(1);
}

const content = fs.readFileSync(wranglerJsoncPath, "utf-8");

// Simple pattern match for ALERT_KV binding and its id
const placeholderPatterns = [
  /REPLACE_WITH_ALERT_KV_NAMESPACE_ID/i,
  /<PASTE_ALERT_KV_ID_HERE>/i,
  /PASTE_YOUR_KV_NAMESPACE_ID_HERE/i,
  /<[^>]+>/,
];

let hasPlaceholder = false;
let matchedPattern = "";

for (const pattern of placeholderPatterns) {
  if (pattern.test(content)) {
    hasPlaceholder = true;
    matchedPattern = pattern.source;
    break;
  }
}

// Also check json parse if possible (strip comments)
try {
  const strippedJson = content.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const parsed = JSON.parse(strippedJson);
  const alertKv = parsed.kv_namespaces?.find((kv) => kv.binding === "ALERT_KV");
  if (alertKv) {
    if (!alertKv.id || alertKv.id.length < 20 || alertKv.id.includes("REPLACE") || alertKv.id.includes("PASTE")) {
      hasPlaceholder = true;
    }
  }
} catch {
  // If parsing fails, regex check is the fallback
}

if (hasPlaceholder) {
  console.error("\n" + "=".repeat(80));
  console.error("❌ [Cloudflare Worker Deployment Blocked]");
  console.error("The ALERT_KV namespace ID in wrangler.jsonc is still an unconfigured placeholder!");
  console.error("Pattern detected: " + matchedPattern);
  console.error("\nTo deploy this Worker, create the KV namespace and update wrangler.jsonc:\n");
  console.error("  1. Run command:");
  console.error("     npx wrangler kv namespace create ALERT_KV\n");
  console.error("  2. Copy the resulting ID (32 hex characters) from the terminal output.\n");
  console.error("  3. Open cloudflare-worker/wrangler.jsonc and replace the placeholder:");
  console.error("     \"kv_namespaces\": [");
  console.error("       {");
  console.error("         \"binding\": \"ALERT_KV\",");
  console.error("         \"id\": \"<your-actual-kv-namespace-id>\"");
  console.error("       }");
  console.error("     ]\n");
  console.error("=".repeat(80) + "\n");
  process.exit(1);
}

console.log("✓ [Pre-Deploy Check] ALERT_KV namespace ID is configured.");

