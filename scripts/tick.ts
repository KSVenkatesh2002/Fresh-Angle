import * as dotenv from "dotenv";
if (!process.env.CI && !process.env.IGNORE_DOTENV) {
  dotenv.config({ path: ".env" });
  dotenv.config({ path: ".env.local" });
}

import { runSchedulerTick } from "../src/services/scheduling/runner";
import { getDb } from "../src/db/client";
import { automationSettings, postSlots } from "../src/db/schema";
import { and, gte, lte, asc, or, eq } from "drizzle-orm";

function toIstString(date: Date): string {
  const istDate = new Date(date.getTime() + 5.5 * 3600 * 1000);
  return (
    istDate.toISOString().replace("T", " ").substring(11, 16) + " IST"
  );
}

function toUtcString(date: Date): string {
  return date.toISOString().replace("T", " ").substring(11, 16) + " UTC";
}

async function simulateSchedulerTick(simDate: Date): Promise<void> {
  const db = getDb();
  console.log("\n==========================================================================");
  console.log(`🧪 [Tick Simulation Mode] Evaluating Scheduler State`);
  console.log(`⏱️ Simulated Time: ${simDate.toISOString()} (${toIstString(simDate)})`);
  console.log("==========================================================================\n");

  const [settings] = await db.select().from(automationSettings).limit(1);
  if (!settings || !settings.enabled) {
    console.log("⚠️ Automation engine is disabled in database settings.");
    return;
  }

  const graceMinutes = settings.lateSlotGraceMinutes ?? 360;
  const graceWindowMs = graceMinutes * 60 * 1000;
  const maxPerRun = settings.maxPostsPerRun ?? 2;

  const simDayStr = simDate.toISOString().split("T")[0];
  const startOfDay = new Date(`${simDayStr}T00:00:00.000Z`);
  const endOfDay = new Date(`${simDayStr}T23:59:59.999Z`);

  // Fetch all slots for this day + any unexecuted planned slots from past
  const allSlots = await db.query.postSlots.findMany({
    where: or(
      and(gte(postSlots.plannedAt, startOfDay), lte(postSlots.plannedAt, endOfDay)),
      and(eq(postSlots.status, "planned"), lte(postSlots.plannedAt, simDate)),
    ),
    orderBy: [asc(postSlots.plannedAt)],
  });

  if (allSlots.length === 0) {
    console.log(`ℹ️ No slots found for date ${simDayStr}.`);
    console.log("--------------------------------------------------------------------------\n");
    return;
  }

  console.log(`Found ${allSlots.length} slot(s) for ${simDayStr}:\n`);
  console.log("Slot ID                              | Planned (UTC) | Planned (IST) | Origin | Status   | Age / Due in | Grace Evaluation        | Simulation Action");
  console.log("-------------------------------------+---------------+---------------+--------+----------+--------------+-------------------------+------------------");

  const dueSlots = [];
  const futureSlots = [];
  const processedSlots = [];

  for (const slot of allSlots) {
    const planned = new Date(slot.plannedAt);
    const diffMs = simDate.getTime() - planned.getTime();
    const diffMinutes = Math.round(diffMs / 60000);

    let ageDisplay = "";
    let graceEval = "-";
    let action = "-";

    if (slot.status !== "planned") {
      processedSlots.push(slot);
      ageDisplay = diffMinutes >= 0 ? `${diffMinutes}m ago` : `in ${Math.abs(diffMinutes)}m`;
      graceEval = "N/A (already " + slot.status + ")";
      action = `Already ${slot.status.toUpperCase()}`;
    } else if (diffMs >= 0) {
      // Due planned slot
      dueSlots.push(slot);
      ageDisplay = `${diffMinutes}m late`;

      if (diffMs > graceWindowMs) {
        graceEval = `EXPIRED (>${graceMinutes}m)`;
        action = `Mark MISSED (reason: >${graceMinutes}m late)`;
      } else {
        graceEval = `VALID (<= ${graceMinutes}m)`;
        action = "PENDING EXECUTION";
      }
    } else {
      // Future planned slot
      futureSlots.push(slot);
      ageDisplay = `in ${Math.abs(diffMinutes)}m`;
      graceEval = "Future slot";
      action = "Wait for planned time";
    }

    console.log(
      `${slot.id} | ${toUtcString(planned)}     | ${toIstString(planned)}     | ${slot.origin.padEnd(6)} | ${slot.status.padEnd(8)} | ${ageDisplay.padEnd(12)} | ${graceEval.padEnd(23)} | ${action}`,
    );
  }

  // Simulation execution plan
  console.log("\n--------------------------------------------------------------------------");
  console.log("📋 SIMULATION EXECUTION DECISION:");

  // Sort due slots oldest first
  const validDueSlots = dueSlots.filter(
    (s) => simDate.getTime() - new Date(s.plannedAt).getTime() <= graceWindowMs,
  );
  const expiredSlots = dueSlots.filter(
    (s) => simDate.getTime() - new Date(s.plannedAt).getTime() > graceWindowMs,
  );

  console.log(`  • Engine Settings: grace = ${graceMinutes}m, max_posts_per_run = ${maxPerRun}`);
  console.log(`  • Total Due Slots: ${dueSlots.length} (${validDueSlots.length} valid, ${expiredSlots.length} expired)`);

  if (expiredSlots.length > 0) {
    console.log(`  • Expired Slots Action:`);
    for (const exp of expiredSlots) {
      const elapsed = Math.round((simDate.getTime() - new Date(exp.plannedAt).getTime()) / 60000);
      console.log(`      ✕ Mark '${exp.id}' as MISSED: 'Slot expired: exceeded ${graceMinutes}m late grace window (${elapsed}m elapsed, planned: ${new Date(exp.plannedAt).toISOString()})'`);
    }
  }

  const slotsToExecute = validDueSlots.slice(0, maxPerRun);
  const remainingValid = validDueSlots.slice(maxPerRun);

  if (slotsToExecute.length > 0) {
    console.log(`  • Slots to Execute (Oldest Due First, max ${maxPerRun}):`);
    for (let i = 0; i < slotsToExecute.length; i++) {
      const s = slotsToExecute[i];
      const testTag = s.origin === "test" ? " [TEST DRAFT]" : "";
      console.log(`      ▶ [Run #${i + 1}] Slot ${s.id} (Planned: ${toUtcString(new Date(s.plannedAt))} / ${toIstString(new Date(s.plannedAt))})${testTag}`);
    }
  } else {
    console.log(`  • Slots to Execute: 0 (No valid due slots pending execution).`);
  }

  if (remainingValid.length > 0) {
    console.log(`  • Deferred Slots (${remainingValid.length} valid slots stay PLANNED for subsequent tick):`);
    for (const s of remainingValid) {
      console.log(`      ⏳ Slot ${s.id} (Planned: ${toUtcString(new Date(s.plannedAt))})`);
    }
  }

  console.log(`  • Future Slots Remaining Today: ${futureSlots.length} slot(s).`);

  console.log("\n🛡️ [SIMULATION COMPLETE] Read-only dry run. Zero database mutations or external API calls performed.\n");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const simIndex = args.findIndex((a) => a === "--simulate-at" || a === "-s");

  if (simIndex !== -1 && args[simIndex + 1]) {
    const rawIso = args[simIndex + 1];
    const simDate = new Date(rawIso);

    if (isNaN(simDate.getTime())) {
      console.error(`❌ [Error] Invalid ISO date string provided to --simulate-at: '${rawIso}'`);
      console.error(`   Example usage: pnpm run tick --simulate-at "2026-11-08T14:30:00Z"`);
      process.exit(1);
    }

    try {
      await simulateSchedulerTick(simDate);
      process.exit(0);
    } catch (err: unknown) {
      console.error("❌ [Simulation Error]:", (err as Error).message);
      process.exit(1);
    }
  }

  if (args.includes("--dry-run")) {
    console.log("🛡️ [Dry-Run Mode] Executing scheduler tick in dry-run mode (no database mutations).");
    try {
      await simulateSchedulerTick(new Date());
      console.log("✓ [Tick Runner] Dry-run completed successfully.");
      process.exit(0);
    } catch (err: unknown) {
      console.error("❌ [Tick Runner] Dry-run failed:", (err as Error).message);
      process.exit(1);
    }
  }

  // Normal live execution
  const timestamp = new Date().toISOString();
  console.log(`⏱️ [Tick Runner] Starting live tick execution at ${timestamp}...`);

  try {
    const result = await runSchedulerTick();
    console.log(`✓ [Tick Runner] ${result.message}`);
    process.exit(0);
  } catch (error) {
    console.error("❌ [Tick Runner] Live tick execution failed:", error);
    process.exit(1);
  }
}

void main();
