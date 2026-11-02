import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import { runSchedulerTick } from "../src/services/scheduling/runner";

async function main(): Promise<void> {
  const timestamp = new Date().toISOString();
  console.log(`⏱️ [Tick Runner] Starting tick execution at ${timestamp}...`);

  try {
    const result = await runSchedulerTick();
    console.log(`✓ [Tick Runner] ${result.message}`);
    process.exit(0);
  } catch (error) {
    console.error("❌ [Tick Runner] Tick execution failed:", error);
    process.exit(1);
  }
}

void main();
