import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import { runDailyPipeline } from "../src/services/pipeline/run";

async function main(): Promise<void> {
  console.log("⏰ Starting Daily Post Automation CLI...");
  try {
    const postId = await runDailyPipeline();
    console.log(`✅ Success! Created post with ID: ${postId}`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Pipeline run terminated with error:", error);
    process.exit(1);
  }
}

main();
